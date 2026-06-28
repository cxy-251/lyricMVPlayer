import * as THREE from "three";

import type {EffectFrameContext, EffectViewport, VisualEffectAtom, VisualEffectLayer} from "../../types";
import {createSeededRandom} from "../../runtime/random";
import {
  createLayerTarget,
  PROCEDURAL_CONTROLS,
  type ProceduralEffectConfig,
  sanitizeProceduralConfig,
} from "./config";

export type ParticleLayout =
  | "stars"
  | "galaxy"
  | "black-hole"
  | "nebula"
  | "network"
  | "morph"
  | "boids"
  | "streaks"
  | "edge";

const layoutCode: Record<ParticleLayout, number> = {
  stars: 0,
  galaxy: 1,
  "black-hole": 2,
  nebula: 3,
  network: 4,
  morph: 5,
  boids: 6,
  streaks: 7,
  edge: 8,
};

const vertexShader = `
  attribute float aPhase;
  attribute float aSize;
  attribute vec3 aTarget;
  varying float vMix;
  varying float vAlpha;
  uniform float uTime;
  uniform float uKind;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uIntensity;
  uniform float uAudio;
  uniform float uPixelRatio;
  uniform vec2 uPointer;

  mat2 rotate2d(float angle) {
    float c = cos(angle); float s = sin(angle);
    return mat2(c, -s, s, c);
  }

  void main() {
    vec3 p = position;
    float t = uTime * uSpeed;
    if (uKind < 0.5) {
      p.z = mod(p.z + t * 0.8 + 8.0, 16.0) - 8.0;
      p.xy += uPointer * (0.08 + aPhase * 0.08);
    } else if (uKind < 1.5) {
      p.xz = rotate2d(t * (0.08 + aPhase * 0.04)) * p.xz;
      p.y += sin(t * 0.7 + aPhase * 18.0) * 0.04;
    } else if (uKind < 2.5) {
      float radius = length(p.xz);
      p.xz = rotate2d(t * (0.12 + 1.4 / max(0.7, radius))) * p.xz;
      p.y += sin(t * 2.0 + radius * 4.0 + aPhase * 8.0) * 0.05;
    } else if (uKind < 3.5) {
      p += vec3(sin(t * 0.22 + aPhase * 13.0), cos(t * 0.17 + aPhase * 9.0), sin(t * 0.19)) * 0.18;
    } else if (uKind < 4.5) {
      p *= 1.0 + sin(t * 1.2 + aPhase * 12.0) * 0.025 + uAudio * 0.06;
    } else if (uKind < 5.5) {
      float morph = smoothstep(0.08, 0.92, sin(t * 0.65) * 0.5 + 0.5);
      p = mix(p, aTarget, morph);
      p += normalize(p + 0.001) * sin(t * 1.4 + aPhase * 10.0) * 0.06;
    } else if (uKind < 6.5) {
      p.x += sin(t * 0.9 + p.y * 0.7 + aPhase * 6.28) * 0.65;
      p.y += cos(t * 0.7 + p.z * 0.6 + aPhase * 9.0) * 0.36;
      p.z += sin(t * 0.8 + p.x * 0.5) * 0.32;
    } else if (uKind < 7.5) {
      p.z = mod(p.z + t * 5.0 + 12.0, 24.0) - 12.0;
      p.xy *= 0.65 + (p.z + 12.0) / 24.0;
    } else {
      p.xy += vec2(sin(t + aPhase * 11.0), cos(t * 0.8 + aPhase * 7.0)) * 0.08;
    }
    p *= uScale;
    p.xy += uPointer * (0.08 + uIntensity * 0.04);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float perspective = 220.0 / max(1.0, -mvPosition.z);
    gl_PointSize = clamp(aSize * uPixelRatio * perspective * 0.22 * (0.7 + uIntensity * 0.3 + uAudio * 0.32), 1.0, 10.0);
    vMix = clamp(aPhase + uAudio * 0.15, 0.0, 1.0);
    vAlpha = smoothstep(14.0, 1.0, -mvPosition.z);
  }
`;

const fragmentShader = `
  precision highp float;
  varying float vMix;
  varying float vAlpha;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform float uIntensity;
  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    float core = smoothstep(0.5, 0.02, radius);
    float glow = smoothstep(0.5, 0.16, radius) * 0.45;
    vec3 color = mix(uPrimary, uSecondary, vMix);
    float alpha = (core + glow) * vAlpha * min(1.0, 0.55 + uIntensity * 0.28);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color * (0.85 + core * 0.7), alpha);
  }
`;

const createTextTarget = (index: number, count: number) => {
  const columns = 96;
  const row = Math.floor(index / columns);
  const column = index % columns;
  const x = (column / (columns - 1) - 0.5) * 8;
  const y = (0.5 - row / Math.max(1, Math.ceil(count / columns) - 1)) * 3.2;
  const band = Math.floor((x + 4) / 2.7);
  const localX = ((x + 4) % 2.7) - 1.35;
  const visible = band === 0
    ? Math.abs(localX + 0.75) < 0.13 || Math.abs(y + 1.35) < 0.13
    : band === 1
      ? Math.abs(localX) > 0.65 || Math.abs(y) < 0.13
      : Math.abs(localX + 0.72) < 0.13 || Math.abs(y - 1.35) < 0.13 || Math.abs(y) < 0.13 || Math.abs(y + 1.35) < 0.13;
  return visible ? new THREE.Vector3(x, y, 0) : new THREE.Vector3(x * 0.35, y * 0.35, -3);
};

const createGeometry = (layout: ParticleLayout, count: number, seed: number) => {
  const random = createSeededRandom(seed);
  const positions = new Float32Array(count * 3);
  const targets = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    let x = 0;
    let y = 0;
    let z = 0;
    const phase = random();
    if (layout === "galaxy" || layout === "black-hole") {
      const radius = layout === "black-hole" ? 1.2 + Math.pow(random(), 1.5) * 5.4 : Math.pow(random(), 0.72) * 6.2;
      const arm = index % (layout === "black-hole" ? 2 : 5);
      const angle = radius * (layout === "black-hole" ? 1.35 : 0.78) + arm * Math.PI * 2 / (layout === "black-hole" ? 2 : 5) + (random() - 0.5) * 0.48;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
      y = (random() - 0.5) * (layout === "black-hole" ? 0.28 : 0.72) * (1 - radius / 8);
    } else if (layout === "nebula") {
      const ribbon = index % 9;
      const along = random() * 2 - 1;
      const phase = ribbon * Math.PI * 2 / 9;
      const envelope = Math.pow(1 - along * along, 0.45);
      x = along * 5.2 + Math.sin(along * 5.8 + phase) * (0.4 + envelope * 0.75) + (random() - 0.5) * 0.42;
      y = Math.sin(along * 3.4 + phase) * (0.55 + envelope * 1.25) + (random() - 0.5) * 0.52;
      z = Math.cos(along * 4.1 + phase) * (0.4 + envelope * 1.1) + (random() - 0.5) * 0.95;
    } else if (layout === "network" || layout === "boids") {
      const radius = Math.cbrt(random()) * (layout === "network" ? 4.5 : 5.6);
      const theta = random() * Math.PI * 2;
      const cosPhi = random() * 2 - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      x = radius * sinPhi * Math.cos(theta);
      y = radius * cosPhi;
      z = radius * sinPhi * Math.sin(theta);
    } else if (layout === "streaks") {
      const angle = random() * Math.PI * 2;
      const radius = 0.7 + random() * 4.2;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
      z = random() * 24 - 12;
    } else if (layout === "edge") {
      const edge = index % 4;
      const along = random() * 2 - 1;
      x = edge < 2 ? along * 5 : (edge === 2 ? -5 : 5);
      y = edge >= 2 ? along * 3 : (edge === 0 ? -3 : 3);
      z = (random() - 0.5) * 1.5;
    } else {
      x = (random() - 0.5) * 10;
      y = (random() - 0.5) * 6;
      z = (random() - 0.5) * 10;
    }
    positions.set([x, y, z], index * 3);
    const target = layout === "morph" ? createTextTarget(index, count) : new THREE.Vector3(x, y, z);
    targets.set([target.x, target.y, target.z], index * 3);
    phases[index] = phase;
    sizes[index] = 0.6 + random() * 1.5;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aTarget", new THREE.BufferAttribute(targets, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  return geometry;
};

class ParticleLayer implements VisualEffectLayer<ProceduralEffectConfig> {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(56, 1, 0.1, 80);
  private readonly target = createLayerTarget();
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private config: ProceduralEffectConfig;

  constructor(layout: ParticleLayout, seed: number, config: ProceduralEffectConfig, baseCount: number) {
    this.config = config;
    const count = Math.max(512, Math.round(baseCount * config.density));
    this.geometry = createGeometry(layout, count, seed);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: {value: 0},
        uKind: {value: layoutCode[layout]},
        uSpeed: {value: config.speed},
        uScale: {value: config.scale},
        uIntensity: {value: config.intensity},
        uAudio: {value: 0},
        uPixelRatio: {value: 1},
        uPointer: {value: new THREE.Vector2()},
        uPrimary: {value: new THREE.Color(config.primary)},
        uSecondary: {value: new THREE.Color(config.secondary)},
      },
    });
    const points = new THREE.Points(this.geometry, this.material);
    if (layout === "galaxy" || layout === "black-hole") {
      points.rotation.x = -1.02;
      points.rotation.z = -0.12;
    }
    this.scene.add(points);
    this.camera.position.set(0, 0.35, layout === "streaks" ? 6.5 : 10.5);
  }

  setConfig(config: ProceduralEffectConfig) { this.config = config; }

  resize(viewport: EffectViewport) {
    const width = Math.max(1, Math.round(viewport.width * Math.min(2, viewport.pixelRatio)));
    const height = Math.max(1, Math.round(viewport.height * Math.min(2, viewport.pixelRatio)));
    this.target.setSize(width, height);
    this.camera.aspect = viewport.width / Math.max(1, viewport.height);
    this.camera.updateProjectionMatrix();
  }

  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const audio = (context.audio.energy * 0.45 + context.audio.bass * 0.35 + context.audio.onset * 0.2) * this.config.audioReactivity;
    const uniforms = this.material.uniforms;
    uniforms.uTime.value = context.time;
    uniforms.uSpeed.value = this.config.speed;
    uniforms.uScale.value = this.config.scale;
    uniforms.uIntensity.value = this.config.intensity;
    uniforms.uAudio.value = audio;
    uniforms.uPixelRatio.value = Math.min(2, context.viewport.pixelRatio);
    uniforms.uPointer.value.set(context.pointer.x, context.pointer.y);
    uniforms.uPrimary.value.set(this.config.primary);
    uniforms.uSecondary.value.set(this.config.secondary);
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(this.scene, this.camera);
    return this.target.texture;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.target.dispose();
  }
}

export const createParticleAtom = (options: {
  id: string;
  title: string;
  description: string;
  layout: ParticleLayout;
  baseCount: number;
  defaults: ProceduralEffectConfig;
  audio?: boolean;
  pointer?: boolean;
}): VisualEffectAtom<ProceduralEffectConfig> => ({
  id: options.id,
  title: options.title,
  description: options.description,
  tags: ["particles", options.layout],
  defaultConfig: options.defaults,
  controls: PROCEDURAL_CONTROLS,
  capabilities: {audio: options.audio, pointer: options.pointer, gpuHeavy: options.baseCount > 24000},
  sanitizeConfig: (value) => sanitizeProceduralConfig(value, options.defaults),
  createLayer: ({seed, config}) => new ParticleLayer(options.layout, seed, config, options.baseCount),
});
