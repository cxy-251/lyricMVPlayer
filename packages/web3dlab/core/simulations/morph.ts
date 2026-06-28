import * as THREE from "three";
import type { EffectFrameContext, EffectViewport, VisualEffectAtom, VisualEffectLayer } from "../../types";
import { createSeededRandom } from "../../runtime/random";
import { createLayerTarget } from "./config";
import { clamp, record, resizeTarget, disposeScene, disposeSceneObject, controls } from "./utils";

type MorphConfig = {particleCount: number; particleSize: number; morphSpeed: number; turbulenceStrength: number; interactionStrength: number; glowStrength: number; audioReactivity: number};
const morphDefaults: MorphConfig = {particleCount: 18000, particleSize: 1.15, morphSpeed: 0.42, turbulenceStrength: 0.42, interactionStrength: 0.72, glowStrength: 0.9, audioReactivity: 0.6};
const sanitizeMorph = (value: unknown): MorphConfig => { const source = record(value); return {
  particleCount: Math.round(clamp(source.particleCount, morphDefaults.particleCount, 4000, 32000) / 1000) * 1000, particleSize: clamp(source.particleSize, morphDefaults.particleSize, 0.45, 2.4),
  morphSpeed: clamp(source.morphSpeed, morphDefaults.morphSpeed, 0.08, 1.6), turbulenceStrength: clamp(source.turbulenceStrength, morphDefaults.turbulenceStrength, 0, 1.8),
  interactionStrength: clamp(source.interactionStrength, morphDefaults.interactionStrength, 0, 2.2), glowStrength: clamp(source.glowStrength, morphDefaults.glowStrength, 0, 2.5), audioReactivity: clamp(source.audioReactivity, morphDefaults.audioReactivity, 0, 2),
}; };

const morphVertex = `
  attribute vec3 aSphere; attribute vec3 aTorus; attribute vec3 aSpiral; attribute vec3 aGrid; attribute float aSeed;
  uniform float uTime; uniform float uFromShape; uniform float uToShape; uniform float uProgress; uniform float uPixelRatio; uniform float uParticleSize; uniform float uTurbulence; uniform float uInteraction; uniform float uGlow; uniform float uAudio; uniform vec2 uPointer;
  varying vec3 vColor; varying float vAlpha;
  vec3 shapeAt(float id) { if (id < 0.5) return aSphere; if (id < 1.5) return aTorus; if (id < 2.5) return aSpiral; return aGrid; }
  void main() {
    float eased = smoothstep(0.0, 1.0, uProgress); vec3 p = mix(shapeAt(uFromShape), shapeAt(uToShape), eased);
    float turbulence = sin(uTime * 1.4 + aSeed * 18.0 + p.x * 1.7) * cos(uTime * 1.1 + p.y * 1.3);
    p += normalize(p + 0.001) * turbulence * (uTurbulence + uAudio * 0.35) * 0.12;
    vec2 pointer = uPointer * vec2(3.2, 2.1); float force = exp(-length(p.xy - pointer) * 1.25) * uInteraction;
    p.xy += normalize(p.xy - pointer + 0.001) * force * 0.34; p.z += force * 0.32;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition; gl_PointSize = uParticleSize * uPixelRatio * (56.0 / max(1.0, -mvPosition.z)) * (1.0 + uAudio * 0.3);
    vColor = mix(vec3(0.2, 0.95, 1.0), vec3(1.0, 0.28, 0.66), fract(aSeed * 7.7 + uToShape * 0.21)); vColor = mix(vColor, vec3(1.0, 0.82, 0.34), smoothstep(0.75, 1.0, force)); vColor *= 0.85 + uGlow * 0.45; vAlpha = 0.55 + force * 0.35;
  }
`;
const morphFragment = `precision highp float; varying vec3 vColor; varying float vAlpha; void main() { float alpha = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5)) * vAlpha; if (alpha < 0.01) discard; gl_FragColor = vec4(vColor * 0.72, alpha * 0.72); }`;

const createMorphGeometry = (count: number, seed: number) => {
  const random = createSeededRandom(seed); const sphere = new Float32Array(count * 3); const torus = new Float32Array(count * 3); const spiral = new Float32Array(count * 3); const grid = new Float32Array(count * 3); const seeds = new Float32Array(count); const side = Math.ceil(Math.sqrt(count));
  for (let index = 0; index < count; index += 1) {
    seeds[index] = random(); const u = random(); const v = random(); const theta = Math.acos(2 * u - 1); const phi = Math.PI * 2 * v; const radius = 2.2 + (random() - 0.5) * 0.18;
    sphere.set([Math.sin(theta) * Math.cos(phi) * radius, Math.cos(theta) * radius, Math.sin(theta) * Math.sin(phi) * radius], index * 3);
    const torusAngle = Math.PI * 2 * random(); const tubeAngle = Math.PI * 2 * random(); const tube = 0.62 + random() * 0.18;
    torus.set([(2.05 + tube * Math.cos(tubeAngle)) * Math.cos(torusAngle), tube * Math.sin(tubeAngle), (2.05 + tube * Math.cos(tubeAngle)) * Math.sin(torusAngle)], index * 3);
    const arm = Math.floor(random() * 4); const distance = Math.pow(random(), 0.58) * 3.2; const angle = distance * 1.7 + arm * Math.PI / 2 + (random() - 0.5) * 0.34;
    spiral.set([Math.cos(angle) * distance, (random() - 0.5) * 0.35, Math.sin(angle) * distance], index * 3);
    const gx = (index % side) / Math.max(1, side - 1) - 0.5; const gy = Math.floor(index / side) / Math.max(1, side - 1) - 0.5;
    grid.set([gx * 5.2, Math.sin(gx * 8 + gy * 5) * 0.34, gy * 3.6], index * 3);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.BufferAttribute(sphere, 3)); geometry.setAttribute("aSphere", new THREE.BufferAttribute(sphere, 3)); geometry.setAttribute("aTorus", new THREE.BufferAttribute(torus, 3)); geometry.setAttribute("aSpiral", new THREE.BufferAttribute(spiral, 3)); geometry.setAttribute("aGrid", new THREE.BufferAttribute(grid, 3)); geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1)); return geometry;
};

class SignatureMorphLayer implements VisualEffectLayer<MorphConfig> {
  private readonly target = createLayerTarget(); private readonly scene = new THREE.Scene(); private readonly camera = new THREE.PerspectiveCamera(54, 1, 0.1, 80); private readonly points = new THREE.Points();
  private readonly material = new THREE.ShaderMaterial({vertexShader: morphVertex, fragmentShader: morphFragment, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, uniforms: {
    uTime: {value: 0}, uFromShape: {value: 0}, uToShape: {value: 1}, uProgress: {value: 0}, uPixelRatio: {value: 1}, uParticleSize: {value: 1.15}, uTurbulence: {value: 0.42}, uInteraction: {value: 0.72}, uGlow: {value: 0.9}, uAudio: {value: 0}, uPointer: {value: new THREE.Vector2()},
  }});
  private geometry: THREE.BufferGeometry; private config: MorphConfig; private readonly seed: number;
  constructor(seed: number, config: MorphConfig) { this.seed = seed; this.config = config; this.geometry = createMorphGeometry(config.particleCount, seed); this.points.geometry = this.geometry; this.points.material = this.material; this.points.frustumCulled = false; this.scene.add(this.points); this.camera.position.set(0, 0.45, 7.6); }
  setConfig(config: MorphConfig) { if (config.particleCount !== this.config.particleCount) { this.geometry.dispose(); this.geometry = createMorphGeometry(config.particleCount, this.seed); this.points.geometry = this.geometry; } this.config = config; }
  resize(viewport: EffectViewport) { resizeTarget(this.target, viewport); this.camera.aspect = viewport.width / Math.max(1, viewport.height); this.camera.updateProjectionMatrix(); }
  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const phaseDuration = 5.8 / this.config.morphSpeed; const shapePhase = context.time / phaseDuration; const from = Math.floor(shapePhase) % 4; const progress = shapePhase - Math.floor(shapePhase); const audio = (context.audio.energy * 0.45 + context.audio.high * 0.25 + context.audio.onset * 0.3) * this.config.audioReactivity;
    this.material.uniforms.uTime.value = context.time; this.material.uniforms.uFromShape.value = from; this.material.uniforms.uToShape.value = (from + 1) % 4; this.material.uniforms.uProgress.value = progress; this.material.uniforms.uPixelRatio.value = Math.min(1.75, context.viewport.pixelRatio);
    this.material.uniforms.uParticleSize.value = this.config.particleSize; this.material.uniforms.uTurbulence.value = this.config.turbulenceStrength; this.material.uniforms.uInteraction.value = this.config.interactionStrength; this.material.uniforms.uGlow.value = this.config.glowStrength; this.material.uniforms.uAudio.value = audio; this.material.uniforms.uPointer.value.set(context.pointer.x, context.pointer.y);
    this.points.rotation.y = context.time * 0.065; this.points.rotation.x = context.pointer.y * 0.08; this.camera.lookAt(0, 0, 0);
    renderer.setRenderTarget(this.target); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); renderer.render(this.scene, this.camera); return this.target.texture;
  }
  dispose() { disposeScene(this.scene); this.material.dispose(); this.target.dispose(); }
}

export const signatureMorphAtom: VisualEffectAtom<MorphConfig> = {
  id: "morph-particles", title: "Particle Morphing Field", description: "Particles cycle through sphere, torus, spiral galaxy and wave grid targets.", tags: ["particles", "morph", "signature"], defaultConfig: morphDefaults,
  controls: controls([["particleCount", "Particles", 4000, 32000, 1000], ["particleSize", "Particle size", 0.45, 2.4, 0.01], ["morphSpeed", "Morph speed", 0.08, 1.6, 0.01], ["turbulenceStrength", "Turbulence", 0, 1.8, 0.01], ["interactionStrength", "Interaction", 0, 2.2, 0.01], ["glowStrength", "Glow", 0, 2.5, 0.01], ["audioReactivity", "Audio", 0, 2, 0.01]]),
  capabilities: {audio: true, pointer: true, gpuHeavy: true}, sanitizeConfig: sanitizeMorph, createLayer: ({seed, config}) => new SignatureMorphLayer(seed, config),
};
