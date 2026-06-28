import * as THREE from "three";
import type { EffectFrameContext, EffectViewport, VisualEffectAtom, VisualEffectLayer } from "../../types";
import { createSeededRandom } from "../../runtime/random";
import { createLayerTarget } from "./config";
import { clamp, record, resizeTarget, disposeScene, disposeSceneObject, controls } from "./utils";

type ClothConfig = {windStrength: number; damping: number; clothResolution: number; interactionRadius: number; interactionStrength: number; glowStrength: number; audioReactivity: number};
const clothDefaults: ClothConfig = {windStrength: 0.82, damping: 0.965, clothResolution: 32, interactionRadius: 0.62, interactionStrength: 1.1, glowStrength: 1.05, audioReactivity: 0.55};
const sanitizeCloth = (value: unknown): ClothConfig => { const source = record(value); return {
  windStrength: clamp(source.windStrength, clothDefaults.windStrength, 0, 2.2), damping: clamp(source.damping, clothDefaults.damping, 0.9, 0.995),
  clothResolution: Math.round(clamp(source.clothResolution, clothDefaults.clothResolution, 14, 48)), interactionRadius: clamp(source.interactionRadius, clothDefaults.interactionRadius, 0.25, 1.4),
  interactionStrength: clamp(source.interactionStrength, clothDefaults.interactionStrength, 0, 2.5), glowStrength: clamp(source.glowStrength, clothDefaults.glowStrength, 0, 2.5),
  audioReactivity: clamp(source.audioReactivity, clothDefaults.audioReactivity, 0, 2),
}; };

const clothVertex = `
  uniform float uTime; uniform float uWind; uniform float uInteraction; uniform float uRadius; uniform float uAudio; uniform vec2 uPointer;
  varying vec2 vUv; varying float vWave;
  void main() {
    vUv = uv; vec3 p = position; float pin = smoothstep(1.0, 0.04, uv.y);
    float wind = sin(p.x * 1.7 + uTime * 1.8) * 0.17 + sin(p.y * 2.7 - uTime * 1.25) * 0.08;
    vec2 pointerWorld = uPointer * vec2(2.4, 1.45); float influence = exp(-length(p.xy - pointerWorld) / max(0.08, uRadius));
    float ripple = sin(length(p.xy - pointerWorld) * 11.0 - uTime * 4.0) * influence * uInteraction;
    p.z += (wind * uWind + ripple * 0.22 + sin(p.x * 3.0 + uTime * 3.0) * uAudio * 0.12) * pin;
    p.y -= pin * pin * 0.14; vWave = wind + ripple + uAudio * 0.3;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const clothFragment = `
  precision highp float; varying vec2 vUv; varying float vWave; uniform float uGlow;
  void main() {
    vec2 gridUv = abs(fract(vUv * vec2(32.0, 21.0)) - 0.5); float wire = 1.0 - smoothstep(0.43, 0.49, max(gridUv.x, gridUv.y));
    float edge = smoothstep(0.08, 0.0, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    vec3 base = mix(vec3(0.025, 0.08, 0.12), vec3(0.12, 0.9, 1.0), clamp(vWave * 0.8 + 0.45, 0.0, 1.0));
    vec3 color = base * (0.46 + wire * (0.45 + uGlow * 0.22)) + vec3(1.0, 0.2, 0.64) * edge * 0.45;
    gl_FragColor = vec4(color, 0.34 + wire * 0.5 + edge * 0.16);
  }
`;

class SignatureClothLayer implements VisualEffectLayer<ClothConfig> {
  private readonly target = createLayerTarget(); private readonly scene = new THREE.Scene(); private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60);
  private geometry: THREE.PlaneGeometry; private readonly material: THREE.ShaderMaterial; private readonly sparks: THREE.Points; private config: ClothConfig;
  constructor(seed: number, config: ClothConfig) {
    this.config = config; this.geometry = new THREE.PlaneGeometry(4.8, 2.9, config.clothResolution - 1, Math.round(config.clothResolution * 0.64) - 1);
    this.material = new THREE.ShaderMaterial({vertexShader: clothVertex, fragmentShader: clothFragment, side: THREE.DoubleSide, transparent: true, depthWrite: false, uniforms: {
      uTime: {value: 0}, uWind: {value: 0.82}, uInteraction: {value: 1.1}, uRadius: {value: 0.62}, uAudio: {value: 0}, uPointer: {value: new THREE.Vector2()}, uGlow: {value: 1},
    }});
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
    const random = createSeededRandom(seed); const positions = new Float32Array(180 * 3);
    for (let index = 0; index < 180; index += 1) positions.set([(random() > 0.5 ? 1 : -1) * (2.25 + random() * 0.6), THREE.MathUtils.lerp(-1.45, 1.45, random()), THREE.MathUtils.lerp(-0.3, 0.5, random())], index * 3);
    const sparkGeometry = new THREE.BufferGeometry(); sparkGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.sparks = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({blending: THREE.AdditiveBlending, color: "#7ff8ff", depthWrite: false, opacity: 0.68, size: 0.028, transparent: true}));
    this.scene.add(this.sparks); this.camera.position.set(0, 0.15, 6.3); this.camera.lookAt(0, -0.1, 0);
  }
  setConfig(config: ClothConfig) { if (config.clothResolution !== this.config.clothResolution) { const replacement = new THREE.PlaneGeometry(4.8, 2.9, config.clothResolution - 1, Math.round(config.clothResolution * 0.64) - 1); const mesh = this.scene.children.find((item) => item instanceof THREE.Mesh) as THREE.Mesh; this.geometry.dispose(); this.geometry = replacement; mesh.geometry = replacement; } this.config = config; }
  resize(viewport: EffectViewport) { resizeTarget(this.target, viewport); this.camera.aspect = viewport.width / Math.max(1, viewport.height); this.camera.updateProjectionMatrix(); }
  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const audio = (context.audio.energy * 0.45 + context.audio.bass * 0.4 + context.audio.onset * 0.15) * this.config.audioReactivity;
    this.material.uniforms.uTime.value = context.time; this.material.uniforms.uWind.value = this.config.windStrength; this.material.uniforms.uInteraction.value = this.config.interactionStrength * (0.6 + context.pointer.pressed * 0.8);
    this.material.uniforms.uRadius.value = this.config.interactionRadius; this.material.uniforms.uAudio.value = audio; this.material.uniforms.uPointer.value.set(context.pointer.x, context.pointer.y); this.material.uniforms.uGlow.value = this.config.glowStrength;
    this.sparks.rotation.z = Math.sin(context.time * 0.12) * 0.02; const sparkMaterial = this.sparks.material as THREE.PointsMaterial; sparkMaterial.opacity = 0.48 + this.config.glowStrength * 0.12 + audio * 0.18;
    this.camera.position.x = context.pointer.x * 0.18; this.camera.position.y = 0.15 + context.pointer.y * 0.08; this.camera.lookAt(0, -0.1, 0);
    renderer.setRenderTarget(this.target); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); renderer.render(this.scene, this.camera); return this.target.texture;
  }
  dispose() { disposeScene(this.scene); this.material.dispose(); this.target.dispose(); }
}

export const signatureClothAtom: VisualEffectAtom<ClothConfig> = {
  id: "cloth-surface", title: "Physics Cloth Banner", description: "A pinned luminous fabric with absolute-time wind, pointer ripples and edge sparks.", tags: ["cloth", "physics", "signature"], defaultConfig: clothDefaults,
  controls: controls([["windStrength", "Wind", 0, 2.2, 0.01], ["damping", "Damping", 0.9, 0.995, 0.001], ["clothResolution", "Resolution", 14, 48, 1], ["interactionRadius", "Interaction radius", 0.25, 1.4, 0.01], ["interactionStrength", "Interaction", 0, 2.5, 0.01], ["glowStrength", "Glow", 0, 2.5, 0.01], ["audioReactivity", "Audio", 0, 2, 0.01]]),
  capabilities: {audio: true, pointer: true}, sanitizeConfig: sanitizeCloth, createLayer: ({seed, config}) => new SignatureClothLayer(seed, config),
};

