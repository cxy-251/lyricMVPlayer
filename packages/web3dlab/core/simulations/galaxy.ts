import * as THREE from "three";
import type { EffectFrameContext, EffectViewport, VisualEffectAtom, VisualEffectLayer } from "../../types";
import { createSeededRandom } from "../../runtime/random";
import { createLayerTarget } from "./config";
import { clamp, record, resizeTarget, disposeScene, disposeSceneObject, controls } from "./utils";

type GalaxyConfig = {
  particleCount: number;
  particleSize: number;
  rotationSpeed: number;
  interactionStrength: number;
  glowStrength: number;
  audioReactivity: number;
};

const galaxyDefaults: GalaxyConfig = {
  particleCount: 32000,
  particleSize: 1,
  rotationSpeed: 0.16,
  interactionStrength: 0.82,
  glowStrength: 0.78,
  audioReactivity: 0.7,
};

const sanitizeGalaxy = (value: unknown): GalaxyConfig => {
  const source = record(value);
  return {
    particleCount: Math.round(clamp(source.particleCount, galaxyDefaults.particleCount, 8000, 60000) / 500) * 500,
    particleSize: clamp(source.particleSize, galaxyDefaults.particleSize, 0.45, 2),
    rotationSpeed: clamp(source.rotationSpeed, galaxyDefaults.rotationSpeed, 0.02, 0.75),
    interactionStrength: clamp(source.interactionStrength, galaxyDefaults.interactionStrength, 0, 2),
    glowStrength: clamp(source.glowStrength, galaxyDefaults.glowStrength, 0.2, 3),
    audioReactivity: clamp(source.audioReactivity, galaxyDefaults.audioReactivity, 0, 2),
  };
};

const galaxyVertexShader = `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uParticleSize;
  uniform float uPixelRatio;
  uniform float uInteractionStrength;
  uniform float uAudio;
  uniform vec2 uPointer;
  attribute float aScale;
  attribute float aPhase;
  attribute float aRandom;
  attribute float aRadius;
  varying float vAlpha;
  varying float vColorMix;
  varying float vHot;
  mat2 rotate2d(float angle) { float s = sin(angle); float c = cos(angle); return mat2(c, -s, s, c); }
  void main() {
    vec3 p = position;
    float radius = max(length(p.xy), 0.001);
    float time = uTime * uSpeed;
    p.xy = rotate2d(time * (0.24 + 2.4 / (radius + 2.0))) * p.xy;
    vec2 pointer = uPointer * vec2(7.2, 4.2);
    float hover = smoothstep(5.8, 0.0, distance(p.xy, pointer));
    float interaction = hover * uInteractionStrength;
    vec2 direction = normalize(p.xy - pointer + vec2(0.001));
    float pulse = sin(time * 8.0 + aPhase * 6.283185 + radius * 0.72) * 0.5 + 0.5;
    p.xy += direction * interaction * (0.35 + pulse * 0.58);
    p.z += interaction * sin(aPhase * 13.0 + time * 5.0) * 0.7;
    p.z += sin(radius * 0.75 - time * 2.0 + aPhase * 6.283185) * (0.08 + aRandom * 0.11);
    p.z += sin(aPhase * 31.0 + time * 6.0) * uAudio * 0.12;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float perspective = 8.0 / max(-mvPosition.z, 0.001);
    gl_PointSize = aScale * uParticleSize * perspective * uPixelRatio * (1.0 + interaction + uAudio * 0.32);
    vAlpha = clamp(0.72 - aRadius * 0.036 + interaction * 0.38, 0.1, 0.86);
    vColorMix = clamp(aRandom * 0.72 + aRadius * 0.035, 0.0, 1.0);
    vHot = clamp(interaction + uAudio * 0.45 + (1.0 - aRadius * 0.12), 0.0, 1.0);
  }
`;

const galaxyFragmentShader = `
  precision highp float;
  uniform float uGlow;
  varying float vAlpha;
  varying float vColorMix;
  varying float vHot;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.5, 0.0, d);
    float spark = smoothstep(0.16, 0.0, d);
    vec3 color = mix(vec3(0.28, 0.92, 1.0), vec3(1.0, 0.34, 0.78), vColorMix);
    color = mix(color, vec3(1.0, 0.78, 0.34), vHot * 0.42);
    float alpha = core * vAlpha * (0.62 + uGlow * 0.1);
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(color * (0.34 + spark * (0.82 + uGlow * 0.24) + vHot * 0.2), alpha);
  }
`;

const createGalaxyGeometry = (count: number, seed: number) => {
  const random = createSeededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);
  const randoms = new Float32Array(count);
  const radii = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const cursor = index * 3;
    const branchAngle = ((index % 5) / 5) * Math.PI * 2;
    const radius = Math.pow(random(), 0.62) * 5.8;
    const spread = Math.pow(random(), 2.4) * (0.22 + radius * 0.065);
    const spreadAngle = random() * Math.PI * 2;
    positions[cursor] = Math.cos(branchAngle + radius * 0.62) * radius + Math.cos(spreadAngle) * spread;
    positions[cursor + 1] = Math.sin(branchAngle + radius * 0.62) * radius + Math.sin(spreadAngle) * spread;
    positions[cursor + 2] = (random() - 0.5) * Math.pow(random(), 2.8) * 0.72;
    scales[index] = THREE.MathUtils.lerp(1.15, 4.6, Math.pow(random(), 2.1));
    phases[index] = random();
    randoms[index] = random();
    radii[index] = radius;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));
  geometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
  return geometry;
};

class SignatureGalaxyLayer implements VisualEffectLayer<GalaxyConfig> {
  private readonly target = createLayerTarget();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(54, 1, 0.1, 60);
  private readonly points = new THREE.Points();
  private readonly material = new THREE.ShaderMaterial({
    vertexShader: galaxyVertexShader,
    fragmentShader: galaxyFragmentShader,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    uniforms: {
      uTime: {value: 0}, uSpeed: {value: 0.16}, uParticleSize: {value: 1}, uPixelRatio: {value: 1},
      uInteractionStrength: {value: 0.82}, uAudio: {value: 0}, uGlow: {value: 0.78}, uPointer: {value: new THREE.Vector2()},
    },
  });
  private geometry: THREE.BufferGeometry;
  private config: GalaxyConfig;
  private seed: number;

  constructor(seed: number, config: GalaxyConfig) {
    this.seed = seed;
    this.config = config;
    this.geometry = createGalaxyGeometry(config.particleCount, seed);
    this.points.geometry = this.geometry;
    this.points.material = this.material;
    this.points.frustumCulled = false;
    this.points.rotation.x = -Math.PI / 2.7;
    this.scene.add(this.points);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), new THREE.MeshBasicMaterial({color: "#fff2b2", transparent: true, opacity: 0.8}));
    this.scene.add(core);
    this.camera.position.set(0, 0.85, 8.4);
    this.camera.lookAt(0, 0, 0);
  }

  setConfig(config: GalaxyConfig) {
    if (config.particleCount !== this.config.particleCount) {
      this.geometry.dispose();
      this.geometry = createGalaxyGeometry(config.particleCount, this.seed);
      this.points.geometry = this.geometry;
    }
    this.config = config;
  }

  resize(viewport: EffectViewport) {
    resizeTarget(this.target, viewport);
    this.camera.aspect = viewport.width / Math.max(1, viewport.height);
    this.camera.updateProjectionMatrix();
  }

  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const audio = (context.audio.energy * 0.45 + context.audio.bass * 0.35 + context.audio.onset * 0.2) * this.config.audioReactivity;
    this.material.uniforms.uTime.value = context.time;
    this.material.uniforms.uSpeed.value = this.config.rotationSpeed;
    this.material.uniforms.uParticleSize.value = this.config.particleSize;
    this.material.uniforms.uPixelRatio.value = Math.min(1.75, context.viewport.pixelRatio);
    this.material.uniforms.uInteractionStrength.value = this.config.interactionStrength;
    this.material.uniforms.uAudio.value = audio;
    this.material.uniforms.uGlow.value = this.config.glowStrength;
    this.material.uniforms.uPointer.value.set(context.pointer.x, context.pointer.y);
    this.points.rotation.z = context.time * (0.025 + this.config.rotationSpeed * 0.18);
    this.points.rotation.y = -context.pointer.x * 0.08;
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(this.scene, this.camera);
    return this.target.texture;
  }

  dispose() { disposeScene(this.scene); this.material.dispose(); this.target.dispose(); }
}
export const signatureGalaxyAtom: VisualEffectAtom<GalaxyConfig> = {
  id: "galaxy-particles", title: "Particle Galaxy", description: "Five shader-driven spiral arms with pointer and song response.", tags: ["particles", "galaxy", "signature"], defaultConfig: galaxyDefaults,
  controls: controls([["particleCount", "Particles", 8000, 60000, 500], ["particleSize", "Particle size", 0.45, 2, 0.01], ["rotationSpeed", "Rotation", 0.02, 0.75, 0.01], ["interactionStrength", "Interaction", 0, 2, 0.01], ["glowStrength", "Glow", 0.2, 3, 0.01], ["audioReactivity", "Audio", 0, 2, 0.01]]),
  capabilities: {audio: true, pointer: true, gpuHeavy: true}, sanitizeConfig: sanitizeGalaxy, createLayer: ({seed, config}) => new SignatureGalaxyLayer(seed, config),
};

