import * as THREE from "three";
import type { EffectFrameContext, EffectViewport, VisualEffectAtom, VisualEffectLayer } from "../../types";
import { createSeededRandom } from "../../runtime/random";
import { createLayerTarget } from "./config";
import { clamp, record, resizeTarget, disposeScene, disposeSceneObject, controls } from "./utils";

type FluidConfig = {distortionStrength: number; trailPersistence: number; rippleRadius: number; fluidDecay: number; backgroundScale: number; glowStrength: number; audioReactivity: number};
const fluidDefaults: FluidConfig = {distortionStrength: 1.05, trailPersistence: 0.72, rippleRadius: 0.105, fluidDecay: 0.82, backgroundScale: 2.2, glowStrength: 1.05, audioReactivity: 0.75};
const sanitizeFluid = (value: unknown): FluidConfig => {
  const source = record(value);
  return {
    distortionStrength: clamp(source.distortionStrength, fluidDefaults.distortionStrength, 0, 2.5), trailPersistence: clamp(source.trailPersistence, fluidDefaults.trailPersistence, 0, 1),
    rippleRadius: clamp(source.rippleRadius, fluidDefaults.rippleRadius, 0.025, 0.24), fluidDecay: clamp(source.fluidDecay, fluidDefaults.fluidDecay, 0, 2.5),
    backgroundScale: clamp(source.backgroundScale, fluidDefaults.backgroundScale, 0.8, 4), glowStrength: clamp(source.glowStrength, fluidDefaults.glowStrength, 0, 2.5),
    audioReactivity: clamp(source.audioReactivity, fluidDefaults.audioReactivity, 0, 2),
  };
};

const fullScreenVertex = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const fluidFragment = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uTime;
  uniform float uAudio;
  uniform float uDistortion;
  uniform float uRippleRadius;
  uniform float uDecay;
  uniform float uScale;
  uniform float uGlow;
  uniform vec4 uImpulses[18];
  float lineField(vec2 uv) { vec2 grid = abs(fract(uv) - 0.5); return 1.0 - smoothstep(0.0, 0.018, min(grid.x, grid.y)); }
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main() {
    vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    vec2 uv = (vUv - 0.5) * aspect;
    vec2 offset = vec2(0.0);
    float light = 0.0;
    for (int i = 0; i < 18; i++) {
      vec4 impulse = uImpulses[i];
      vec2 center = (impulse.xy - 0.5) * aspect;
      vec2 toPoint = uv - center;
      float dist = length(toPoint);
      float life = exp(-impulse.z * (1.2 + uDecay));
      float radius = max(uRippleRadius, 0.001) * (1.0 + impulse.z * 1.4);
      float ring = exp(-pow((dist - radius) / (radius * 0.42 + 0.035), 2.0));
      float swirl = exp(-dist * (2.8 + uDecay));
      vec2 tangent = vec2(-toPoint.y, toPoint.x) / max(dist, 0.001);
      offset += (tangent * swirl * 0.045 + normalize(toPoint + 0.0001) * ring * 0.028) * impulse.w * life * uDistortion;
      light += (ring * 0.8 + swirl * 0.35) * impulse.w * life;
    }
    vec2 warped = uv + offset + vec2(sin(uv.y * 8.0 + uTime * 0.55), cos(uv.x * 7.0 - uTime * 0.45)) * 0.018 * uDistortion;
    float gridA = lineField(warped * (6.0 * uScale));
    float gridB = lineField((warped + vec2(0.12, -0.08)) * (2.7 * uScale));
    float pointerGlow = exp(-length(vUv - (uPointer * 0.5 + 0.5)) * 6.0);
    vec3 base = mix(vec3(0.012, 0.017, 0.035), vec3(0.035, 0.02, 0.072), smoothstep(-0.7, 0.75, warped.y));
    vec3 cyan = vec3(0.12, 0.95, 1.0);
    vec3 magenta = vec3(1.0, 0.18, 0.65);
    vec3 color = base + cyan * gridA * 0.13 + magenta * gridB * 0.08;
    color += mix(cyan, magenta, sin(uTime * 0.2 + warped.x * 2.0) * 0.5 + 0.5) * light * (0.42 + uGlow * 0.32 + uAudio * 0.45);
    color += vec3(0.45, 0.85, 1.0) * pointerGlow * 0.08;
    color += (hash(floor(vUv * uResolution * 0.35) + uTime) - 0.5) * 0.012;
    color *= 1.0 - smoothstep(0.55, 1.25, length((vUv - 0.5) * aspect));
    gl_FragColor = vec4(color, 0.96);
  }
`;

class SignatureFluidLayer implements VisualEffectLayer<FluidConfig> {
  private readonly target = createLayerTarget();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly impulses = Array.from({length: 18}, () => new THREE.Vector4());
  private readonly material = new THREE.ShaderMaterial({vertexShader: fullScreenVertex, fragmentShader: fluidFragment, transparent: true, depthWrite: false, uniforms: {
    uResolution: {value: new THREE.Vector2(1, 1)}, uPointer: {value: new THREE.Vector2()}, uTime: {value: 0}, uAudio: {value: 0}, uDistortion: {value: 1},
    uRippleRadius: {value: 0.1}, uDecay: {value: 0.8}, uScale: {value: 2.2}, uGlow: {value: 1}, uImpulses: {value: this.impulses},
  }});
  private config: FluidConfig;
  private readonly phases: Array<{x: number; y: number; phase: number}>;
  constructor(seed: number, config: FluidConfig) {
    this.config = config;
    const random = createSeededRandom(seed);
    this.phases = this.impulses.map(() => ({x: random(), y: random(), phase: random() * 7}));
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }
  setConfig(config: FluidConfig) { this.config = config; }
  resize(viewport: EffectViewport) { resizeTarget(this.target, viewport); this.material.uniforms.uResolution.value.set(viewport.width, viewport.height); }
  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const audio = (context.audio.energy * 0.5 + context.audio.mid * 0.25 + context.audio.onset * 0.25) * this.config.audioReactivity;
    this.impulses.forEach((impulse, index) => {
      const item = this.phases[index];
      const cycle = ((context.time * (0.22 + index * 0.003) + item.phase) % 4 + 4) % 4;
      const pointerMix = index < 3 ? 0.86 : 0;
      const x = THREE.MathUtils.lerp(item.x, context.pointer.x * 0.5 + 0.5, pointerMix);
      const y = THREE.MathUtils.lerp(item.y, context.pointer.y * 0.5 + 0.5, pointerMix);
      impulse.set(x, y, cycle, ((index < 3 ? 0.34 : 0.18) + audio * 0.85 + context.pointer.pressed * 0.72) * (1 - cycle / 4));
    });
    this.material.uniforms.uPointer.value.set(context.pointer.x, context.pointer.y);
    this.material.uniforms.uTime.value = context.time;
    this.material.uniforms.uAudio.value = audio;
    this.material.uniforms.uDistortion.value = this.config.distortionStrength;
    this.material.uniforms.uRippleRadius.value = this.config.rippleRadius;
    this.material.uniforms.uDecay.value = this.config.fluidDecay + (1 - this.config.trailPersistence) * 0.4;
    this.material.uniforms.uScale.value = this.config.backgroundScale;
    this.material.uniforms.uGlow.value = this.config.glowStrength;
    renderer.setRenderTarget(this.target); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); renderer.render(this.scene, this.camera);
    return this.target.texture;
  }
  dispose() { disposeScene(this.scene); this.material.dispose(); this.target.dispose(); }
}

export const signatureFluidAtom: VisualEffectAtom<FluidConfig> = {
  id: "fluid-surface", title: "Fluid Cursor Field", description: "A full-frame ripple field with deterministic impulse memory.", tags: ["fluid", "shader", "signature"], defaultConfig: fluidDefaults,
  controls: controls([["distortionStrength", "Distortion", 0, 2.5, 0.01], ["trailPersistence", "Trail", 0, 1, 0.01], ["rippleRadius", "Ripple radius", 0.025, 0.24, 0.001], ["fluidDecay", "Decay", 0, 2.5, 0.01], ["backgroundScale", "Grid scale", 0.8, 4, 0.01], ["glowStrength", "Glow", 0, 2.5, 0.01], ["audioReactivity", "Audio", 0, 2, 0.01]]),
  capabilities: {audio: true, pointer: true}, sanitizeConfig: sanitizeFluid, createLayer: ({seed, config}) => new SignatureFluidLayer(seed, config),
};

