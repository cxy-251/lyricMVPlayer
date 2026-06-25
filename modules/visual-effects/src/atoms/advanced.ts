import * as THREE from "three";

import type {EffectFrameContext, EffectViewport, VisualEffectAtom, VisualEffectLayer} from "../types";
import {createSeededRandom} from "../runtime/random";
import {
  createLayerTarget,
  PROCEDURAL_CONTROLS,
  type ProceduralEffectConfig,
  sanitizeProceduralConfig,
} from "./config";

type BoidSeed = {phase: number; lane: number; speed: number; lift: number; color: number};

const boidVertex = `
  attribute vec3 color;
  attribute float aSize;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uScale * (72.0 / max(1.0, -mv.z)), 3.0, 18.0);
    vColor = color;
  }
`;

const boidFragment = `
  precision highp float;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float body = (1.0 - smoothstep(0.0, 0.24, abs(p.y))) * (1.0 - smoothstep(-0.7, 1.0, p.x));
    float wingA = 1.0 - smoothstep(0.0, 0.16, abs(p.y - (p.x + 0.1) * 0.42));
    float wingB = 1.0 - smoothstep(0.0, 0.16, abs(p.y + (p.x + 0.1) * 0.42));
    float alpha = max(body, max(wingA, wingB) * smoothstep(-0.8, 0.45, p.x));
    if (alpha < 0.05 || length(p) > 1.05) discard;
    gl_FragColor = vec4(vColor * (0.72 + alpha * 0.5), alpha * 0.92);
  }
`;

class BoidsMeshLayer implements VisualEffectLayer<ProceduralEffectConfig> {
  private readonly target = createLayerTarget();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material = new THREE.ShaderMaterial({blending: THREE.AdditiveBlending, depthWrite: false, fragmentShader: boidFragment, transparent: true, uniforms: {uScale: {value: 1}}, vertexShader: boidVertex});
  private readonly points: THREE.Points;
  private readonly seeds: BoidSeed[];
  private readonly colors: Float32Array;
  private readonly positions: Float32Array;
  private config: ProceduralEffectConfig;

  constructor(seed: number, config: ProceduralEffectConfig) {
    this.config = config;
    const random = createSeededRandom(seed);
    const count = Math.max(220, Math.round(920 * config.density));
    this.seeds = Array.from({length: count}, () => ({phase: random() * Math.PI * 2, lane: random() * 2 - 1, speed: 0.55 + random() * 0.7, lift: random() * 2 - 1, color: random()}));
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(Float32Array.from(this.seeds, (item) => 0.72 + item.color * 0.85), 1));
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.camera.position.set(0, 0.4, 9.2);
  }

  setConfig(config: ProceduralEffectConfig) { this.config = config; }
  resize(viewport: EffectViewport) {
    this.target.setSize(Math.max(1, Math.round(viewport.width * Math.min(2, viewport.pixelRatio))), Math.max(1, Math.round(viewport.height * Math.min(2, viewport.pixelRatio))));
    this.camera.aspect = viewport.width / Math.max(1, viewport.height);
    this.camera.updateProjectionMatrix();
  }

  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const audio = (context.audio.energy * 0.5 + context.audio.high * 0.2 + context.audio.onset * 0.3) * this.config.audioReactivity;
    const time = context.time * this.config.speed;
    const primary = new THREE.Color(this.config.primary);
    const secondary = new THREE.Color(this.config.secondary);
    this.seeds.forEach((seed, index) => {
      const phase = seed.phase + time * seed.speed;
      const stream = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
      const x = (stream * 2 - 1) * 7.5;
      const y = Math.sin(phase * 1.7 + seed.lane * 2.4) * 1.3 + seed.lane * 1.25 + Math.sin(time * 0.45) * 0.3;
      const z = Math.cos(phase * 1.15 + seed.lift * 3) * 1.8 + seed.lift * 0.8;
      this.positions.set([x, y, z], index * 3);
      const color = primary.clone().lerp(secondary, seed.color).multiplyScalar(0.72 + this.config.intensity * 0.38 + audio * 0.2);
      this.colors.set([color.r, color.g, color.b], index * 3);
    });
    this.geometry.getAttribute("position").needsUpdate = true;
    this.geometry.getAttribute("color").needsUpdate = true;
    this.material.uniforms.uScale.value = this.config.scale * (1 + audio * 0.12);
    this.camera.position.x = context.pointer.x * 0.35;
    this.camera.position.y = 0.4 + context.pointer.y * 0.25;
    this.camera.lookAt(0, 0, 0);
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(this.scene, this.camera);
    return this.target.texture;
  }

  dispose() { this.geometry.dispose(); this.material.dispose(); this.target.dispose(); }
}

const glyphs: Record<string, string[]> = {
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  Y: ["10001", "01010", "00100", "00100", "00100", "00100", "00100"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
};

const textVertex = `
  attribute vec3 aOrigin;
  attribute vec3 aTarget;
  attribute float aSeed;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uAudio;
  uniform vec2 uPointer;
  varying float vSeed;
  void main() {
    float cycle = uTime * uSpeed * 0.18;
    float settle = smoothstep(0.08, 0.42, fract(cycle));
    settle *= 1.0 - smoothstep(0.78, 0.98, fract(cycle));
    vec3 p = mix(aOrigin, aTarget, settle);
    p += normalize(p + 0.001) * sin(uTime * 1.7 + aSeed * 24.0) * (1.0 - settle) * 0.35;
    p.xy += uPointer * exp(-length(p.xy - uPointer * vec2(4.0, 2.0))) * 0.18;
    p *= uScale;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (42.0 / max(1.0, -mv.z)) * (1.0 + uAudio * 0.25);
    vSeed = aSeed;
  }
`;

const textFragment = `
  precision highp float;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform float uIntensity;
  varying float vSeed;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.08, d) * 0.72;
    if (alpha < 0.01) discard;
    vec3 color = mix(uPrimary, uSecondary, vSeed) * (0.42 + uIntensity * 0.24);
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

const createTextGeometry = (count: number, seed: number) => {
  const random = createSeededRandom(seed);
  const lit: Array<{x: number; y: number}> = [];
  const word = "LYRIC";
  for (let letter = 0; letter < word.length; letter += 1) {
    glyphs[word[letter]].forEach((row, y) => [...row].forEach((pixel, x) => {
      if (pixel === "1") lit.push({x: letter * 6 + x, y});
    }));
  }
  const origins = new Float32Array(count * 3);
  const targets = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const pixel = lit[index % lit.length];
    origins.set([(random() - 0.5) * 12, (random() - 0.5) * 7, (random() - 0.5) * 8], index * 3);
    targets.set([(pixel.x - 14.5) * 0.29 + (random() - 0.5) * 0.22, (3 - pixel.y) * 0.34 + (random() - 0.5) * 0.22, (random() - 0.5) * 0.22], index * 3);
    seeds[index] = random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(origins, 3));
  geometry.setAttribute("aOrigin", new THREE.BufferAttribute(origins, 3));
  geometry.setAttribute("aTarget", new THREE.BufferAttribute(targets, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  return geometry;
};

class TextGlyphLayer implements VisualEffectLayer<ProceduralEffectConfig> {
  private readonly target = createLayerTarget();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 50);
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private config: ProceduralEffectConfig;
  constructor(seed: number, config: ProceduralEffectConfig) {
    this.config = config;
    this.geometry = createTextGeometry(Math.max(3500, Math.round(14000 * config.density)), seed);
    this.material = new THREE.ShaderMaterial({vertexShader: textVertex, fragmentShader: textFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {
      uTime: {value: 0}, uSpeed: {value: config.speed}, uScale: {value: config.scale}, uSize: {value: 1}, uPixelRatio: {value: 1}, uAudio: {value: 0}, uPointer: {value: new THREE.Vector2()}, uPrimary: {value: new THREE.Color(config.primary)}, uSecondary: {value: new THREE.Color(config.secondary)}, uIntensity: {value: config.intensity},
    }});
    const points = new THREE.Points(this.geometry, this.material); points.frustumCulled = false; this.scene.add(points); this.camera.position.z = 8.2;
  }
  setConfig(config: ProceduralEffectConfig) { this.config = config; }
  resize(viewport: EffectViewport) { this.target.setSize(Math.max(1, Math.round(viewport.width * Math.min(2, viewport.pixelRatio))), Math.max(1, Math.round(viewport.height * Math.min(2, viewport.pixelRatio)))); this.camera.aspect = viewport.width / Math.max(1, viewport.height); this.camera.updateProjectionMatrix(); }
  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const audio = (context.audio.energy * 0.5 + context.audio.high * 0.2 + context.audio.onset * 0.3) * this.config.audioReactivity; const uniforms = this.material.uniforms;
    uniforms.uTime.value = context.time; uniforms.uSpeed.value = this.config.speed; uniforms.uScale.value = this.config.scale; uniforms.uSize.value = 1.38; uniforms.uPixelRatio.value = Math.min(1.75, context.viewport.pixelRatio); uniforms.uAudio.value = audio; uniforms.uPointer.value.set(context.pointer.x, context.pointer.y); uniforms.uPrimary.value.set(this.config.primary); uniforms.uSecondary.value.set(this.config.secondary); uniforms.uIntensity.value = this.config.intensity;
    renderer.setRenderTarget(this.target); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); renderer.render(this.scene, this.camera); return this.target.texture;
  }
  dispose() { this.geometry.dispose(); this.material.dispose(); this.target.dispose(); }
}

export const createBoidsAtom = (defaults: ProceduralEffectConfig): VisualEffectAtom<ProceduralEffectConfig> => ({
  id: "boids-field", title: "Boids Flocking", description: "Seeded directional bodies moving as a coherent stream.", tags: ["boids", "flocking", "instanced"], defaultConfig: defaults, controls: PROCEDURAL_CONTROLS,
  capabilities: {audio: true, pointer: true, gpuHeavy: false}, sanitizeConfig: (value) => sanitizeProceduralConfig(value, defaults), createLayer: ({seed, config}) => new BoidsMeshLayer(seed, config),
});

export const createTextGlyphAtom = (defaults: ProceduralEffectConfig): VisualEffectAtom<ProceduralEffectConfig> => ({
  id: "text-glyph-particles", title: "Text Glyph Particles", description: "Particles explode and reform into a deterministic LYRIC glyph target.", tags: ["particles", "text", "glyph"], defaultConfig: defaults, controls: PROCEDURAL_CONTROLS,
  capabilities: {audio: true, pointer: true, gpuHeavy: true}, sanitizeConfig: (value) => sanitizeProceduralConfig(value, defaults), createLayer: ({seed, config}) => new TextGlyphLayer(seed, config),
});
