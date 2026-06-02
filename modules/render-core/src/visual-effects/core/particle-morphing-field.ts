import * as THREE from "three";

import type {
  EffectClock,
  EffectInputState,
  EffectViewport,
  ParticleMorphingFieldConfig,
  VisualEffectScene,
} from "../types";
import {clampToStep, damp, dampFactor, decay, disposeObject, createSeededRandom} from "./scene-utils";

const SHAPE_COUNT = 4;
const vertexShader = `
attribute vec3 aSphere;
attribute vec3 aTorus;
attribute vec3 aSpiral;
attribute vec3 aGrid;
attribute float aSeed;
uniform float uTime;
uniform float uFromShape;
uniform float uToShape;
uniform float uProgress;
uniform float uPixelRatio;
uniform float uParticleSize;
uniform float uTurbulence;
uniform float uInteraction;
uniform float uGlow;
uniform vec2 uPointer;
varying vec3 vColor;
varying float vAlpha;

vec3 shapeAt(float id) {
  if (id < 0.5) return aSphere;
  if (id < 1.5) return aTorus;
  if (id < 2.5) return aSpiral;
  return aGrid;
}

void main() {
  float eased = smoothstep(0.0, 1.0, uProgress);
  vec3 positionA = shapeAt(uFromShape);
  vec3 positionB = shapeAt(uToShape);
  vec3 p = mix(positionA, positionB, eased);
  float turbulence = sin(uTime * 1.4 + aSeed * 18.0 + p.x * 1.7) * cos(uTime * 1.1 + p.y * 1.3);
  p += normalize(p + 0.001) * turbulence * uTurbulence * 0.12;
  vec2 pointer = uPointer * vec2(3.2, 2.1);
  float pointerDistance = length(p.xy - pointer);
  float force = exp(-pointerDistance * 1.25) * uInteraction;
  p.xy += normalize(p.xy - pointer + 0.001) * force * 0.34;
  p.z += force * 0.32 + sin(uTime + aSeed * 12.0) * force * 0.12;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uParticleSize * uPixelRatio * (310.0 / max(1.0, -mvPosition.z));
  vec3 cyan = vec3(0.2, 0.95, 1.0);
  vec3 rose = vec3(1.0, 0.28, 0.66);
  vec3 gold = vec3(1.0, 0.82, 0.34);
  vColor = mix(cyan, rose, fract(aSeed * 7.7 + uToShape * 0.21));
  vColor = mix(vColor, gold, smoothstep(0.75, 1.0, force));
  vColor *= 0.85 + uGlow * 0.45;
  vAlpha = 0.55 + force * 0.35;
}
`;

const fragmentShader = `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float alpha = smoothstep(0.5, 0.05, d) * vAlpha;
  gl_FragColor = vec4(vColor * alpha, alpha);
}
`;

export const DEFAULT_PARTICLE_MORPHING_FIELD_CONFIG: ParticleMorphingFieldConfig = {
  particleCount: 18000,
  particleSize: 1.15,
  morphSpeed: 0.42,
  turbulenceStrength: 0.42,
  interactionStrength: 0.72,
  bloomStrength: 0.9,
};

export const sanitizeParticleMorphingFieldConfig = (config: ParticleMorphingFieldConfig): ParticleMorphingFieldConfig => ({
  particleCount: clampToStep(config.particleCount, 4000, 32000, 1000),
  particleSize: clampToStep(config.particleSize, 0.45, 2.4, 0.01),
  morphSpeed: clampToStep(config.morphSpeed, 0.08, 1.6, 0.01),
  turbulenceStrength: clampToStep(config.turbulenceStrength, 0, 1.8, 0.01),
  interactionStrength: clampToStep(config.interactionStrength, 0, 2.2, 0.01),
  bloomStrength: clampToStep(config.bloomStrength, 0, 2.5, 0.01),
});

export class ParticleMorphingFieldScene implements VisualEffectScene<ParticleMorphingFieldConfig> {
  private readonly renderer = new THREE.WebGLRenderer({antialias: false, alpha: false, powerPreference: "high-performance"});
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(54, 1, 0.1, 80);
  private readonly pointer = new THREE.Vector2();
  private readonly pointerTarget = new THREE.Vector2();
  private readonly material = new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fragmentShader,
    transparent: true,
    uniforms: {
      uTime: {value: 0},
      uFromShape: {value: 0},
      uToShape: {value: 1},
      uProgress: {value: 1},
      uPixelRatio: {value: 1},
      uParticleSize: {value: 1.15},
      uTurbulence: {value: 0.42},
      uInteraction: {value: 0.72},
      uGlow: {value: 0.9},
      uPointer: {value: new THREE.Vector2()},
    },
    vertexShader,
  });
  private points = new THREE.Points();
  private geometry: THREE.BufferGeometry | null = null;
  private config: ParticleMorphingFieldConfig;
  private seed: number;
  private fromShape = 0;
  private toShape = 1;
  private progress = 1;
  private lastClickCount = 0;
  private wheel = 0;
  private nextAutoMorphAt = 6;

  constructor({config, seed = 1307}: {config: ParticleMorphingFieldConfig; seed?: number}) {
    this.config = sanitizeParticleMorphingFieldConfig(config);
    this.seed = seed;
    this.renderer.setClearColor("#03040a", 1);
    this.scene.background = new THREE.Color("#03040a");
    this.scene.fog = new THREE.Fog("#03040a", 9, 24);
    this.camera.position.set(0, 0.6, 8.8);
    this.points.frustumCulled = false;
    this.points.material = this.material;
    this.scene.add(this.points);
    this.rebuildGeometry();
  }

  mount(target: HTMLElement) {
    target.appendChild(this.renderer.domElement);
  }

  setConfig(config: ParticleMorphingFieldConfig) {
    const nextConfig = sanitizeParticleMorphingFieldConfig(config);
    if (nextConfig.particleCount !== this.config.particleCount) {
      this.config = nextConfig;
      this.rebuildGeometry();
      return;
    }
    this.config = nextConfig;
  }

  update({clock, input, viewport}: {clock: EffectClock; viewport: EffectViewport; input: EffectInputState}) {
    const delta = Math.min(0.05, Math.max(0.001, clock.delta));
    this.pointerTarget.set(input.pointerX, input.pointerY);
    this.pointer.lerp(this.pointerTarget, dampFactor(8.5, delta));
    this.wheel = decay(input.wheel, 2.4, delta);
    if (input.clickCount !== this.lastClickCount) {
      this.lastClickCount = input.clickCount;
      this.cycleShape();
      this.nextAutoMorphAt = clock.time + 6;
    }
    if (this.progress < 1) {
      this.progress = Math.min(1, this.progress + delta * this.config.morphSpeed);
    }
    if (clock.time >= this.nextAutoMorphAt && this.progress >= 1) {
      this.cycleShape();
      this.nextAutoMorphAt = clock.time + 6.5;
    }

    this.material.uniforms.uTime.value = clock.time;
    this.material.uniforms.uFromShape.value = this.fromShape;
    this.material.uniforms.uToShape.value = this.toShape;
    this.material.uniforms.uProgress.value = this.progress;
    this.material.uniforms.uPixelRatio.value = Math.min(viewport.pixelRatio, 1.75);
    this.material.uniforms.uParticleSize.value = this.config.particleSize;
    this.material.uniforms.uTurbulence.value = this.config.turbulenceStrength;
    this.material.uniforms.uInteraction.value = this.config.interactionStrength;
    this.material.uniforms.uGlow.value = this.config.bloomStrength;
    this.material.uniforms.uPointer.value.copy(this.pointer);
    this.points.rotation.y += delta * 0.065;
    this.points.rotation.x = damp(this.points.rotation.x, this.pointer.y * 0.08, 4, delta);
    this.camera.position.z = damp(this.camera.position.z, 8.8 - this.wheel * 0.75, 5, delta);
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  resize({height, pixelRatio, width}: EffectViewport) {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    this.camera.aspect = safeWidth / safeHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(pixelRatio, 1.75));
    this.renderer.setSize(safeWidth, safeHeight, false);
  }

  dispose() {
    this.geometry?.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private cycleShape() {
    this.fromShape = this.toShape;
    this.toShape = (this.toShape + 1) % SHAPE_COUNT;
    this.progress = 0;
  }

  private rebuildGeometry() {
    this.geometry?.dispose();
    const random = createSeededRandom(this.seed++);
    const count = this.config.particleCount;
    const sphere = new Float32Array(count * 3);
    const torus = new Float32Array(count * 3);
    const spiral = new Float32Array(count * 3);
    const grid = new Float32Array(count * 3);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      seeds[i] = random();
      const u = random();
      const v = random();
      const theta = Math.acos(2 * u - 1);
      const phi = Math.PI * 2 * v;
      const radius = 2.2 + (random() - 0.5) * 0.18;
      sphere[i * 3] = Math.sin(theta) * Math.cos(phi) * radius;
      sphere[i * 3 + 1] = Math.cos(theta) * radius;
      sphere[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;

      const torusAngle = Math.PI * 2 * random();
      const tubeAngle = Math.PI * 2 * random();
      const major = 2.05;
      const tube = 0.62 + random() * 0.18;
      torus[i * 3] = (major + tube * Math.cos(tubeAngle)) * Math.cos(torusAngle);
      torus[i * 3 + 1] = tube * Math.sin(tubeAngle);
      torus[i * 3 + 2] = (major + tube * Math.cos(tubeAngle)) * Math.sin(torusAngle);

      const arm = Math.floor(random() * 4);
      const distance = Math.pow(random(), 0.58) * 3.2;
      const angle = distance * 1.7 + arm * (Math.PI / 2) + (random() - 0.5) * 0.34;
      spiral[i * 3] = Math.cos(angle) * distance;
      spiral[i * 3 + 1] = (random() - 0.5) * 0.35;
      spiral[i * 3 + 2] = Math.sin(angle) * distance;

      const side = Math.ceil(Math.sqrt(count));
      const gx = (i % side) / Math.max(1, side - 1) - 0.5;
      const gy = Math.floor(i / side) / Math.max(1, side - 1) - 0.5;
      grid[i * 3] = gx * 5.2;
      grid[i * 3 + 1] = Math.sin(gx * 8 + gy * 5) * 0.34;
      grid[i * 3 + 2] = gy * 3.6;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(sphere, 3));
    this.geometry.setAttribute("aSphere", new THREE.BufferAttribute(sphere, 3));
    this.geometry.setAttribute("aTorus", new THREE.BufferAttribute(torus, 3));
    this.geometry.setAttribute("aSpiral", new THREE.BufferAttribute(spiral, 3));
    this.geometry.setAttribute("aGrid", new THREE.BufferAttribute(grid, 3));
    this.geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    this.points.geometry = this.geometry;
  }
}
