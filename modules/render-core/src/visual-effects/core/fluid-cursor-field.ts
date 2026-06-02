import * as THREE from "three";

import type {EffectClock, EffectInputState, EffectViewport, FluidCursorFieldConfig, VisualEffectScene} from "../types";
import {clampToStep, damp, dampFactor, decay, disposeObject} from "./scene-utils";

const IMPULSE_COUNT = 18;

export const DEFAULT_FLUID_CURSOR_FIELD_CONFIG: FluidCursorFieldConfig = {
  distortionStrength: 1.05,
  trailPersistence: 0.72,
  rippleRadius: 0.105,
  fluidDecay: 0.82,
  backgroundScale: 2.2,
  bloomStrength: 1.05,
};

export const sanitizeFluidCursorFieldConfig = (config: FluidCursorFieldConfig): FluidCursorFieldConfig => ({
  distortionStrength: clampToStep(config.distortionStrength, 0, 2.5, 0.01),
  trailPersistence: clampToStep(config.trailPersistence, 0, 1, 0.01),
  rippleRadius: clampToStep(config.rippleRadius, 0.025, 0.24, 0.001),
  fluidDecay: clampToStep(config.fluidDecay, 0, 2.5, 0.01),
  backgroundScale: clampToStep(config.backgroundScale, 0.8, 4, 0.01),
  bloomStrength: clampToStep(config.bloomStrength, 0, 2.5, 0.01),
});

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
uniform float uZoom;
uniform float uDistortionStrength;
uniform float uTrailPersistence;
uniform float uRippleRadius;
uniform float uFluidDecay;
uniform float uBackgroundScale;
uniform float uBloomStrength;
uniform vec4 uImpulses[${IMPULSE_COUNT}];

float lineField(vec2 uv) {
  vec2 grid = abs(fract(uv) - 0.5);
  float line = min(grid.x, grid.y);
  return 1.0 - smoothstep(0.0, 0.018, line);
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 uv = (vUv - 0.5) * aspect / max(uZoom, 0.001);
  vec2 pointer = (uPointer - 0.5) * aspect / max(uZoom, 0.001);
  vec2 offset = vec2(0.0);
  float light = 0.0;

  for (int i = 0; i < ${IMPULSE_COUNT}; i++) {
    vec4 impulse = uImpulses[i];
    float age = impulse.z;
    float strength = impulse.w;
    vec2 center = (impulse.xy - 0.5) * aspect / max(uZoom, 0.001);
    vec2 toPoint = uv - center;
    float dist = length(toPoint);
    float life = exp(-age * (1.2 + uFluidDecay));
    float radius = max(uRippleRadius, 0.001) * (1.0 + age * 1.4);
    float ring = exp(-pow((dist - radius) / (radius * 0.42 + 0.035), 2.0));
    float swirl = exp(-dist * (2.8 + uFluidDecay));
    vec2 tangent = vec2(-toPoint.y, toPoint.x) / max(dist, 0.001);
    offset += tangent * swirl * strength * life * 0.045 * uDistortionStrength;
    offset += normalize(toPoint + 0.0001) * ring * strength * life * 0.028 * uDistortionStrength;
    light += (ring * 0.8 + swirl * 0.35) * strength * life;
  }

  float pointerGlow = exp(-length(uv - pointer) * 5.5);
  vec2 warped = uv + offset + vec2(
    sin(uv.y * 8.0 + uTime * 0.55),
    cos(uv.x * 7.0 - uTime * 0.45)
  ) * 0.018 * uDistortionStrength;

  float gridA = lineField(warped * (6.0 * uBackgroundScale));
  float gridB = lineField((warped + vec2(0.12, -0.08)) * (2.7 * uBackgroundScale));
  float grain = hash(floor(vUv * uResolution.xy * 0.35) + uTime);
  vec3 base = mix(vec3(0.012, 0.017, 0.035), vec3(0.035, 0.02, 0.072), smoothstep(-0.7, 0.75, warped.y));
  vec3 cyan = vec3(0.12, 0.95, 1.0);
  vec3 magenta = vec3(1.0, 0.18, 0.65);
  vec3 color = base;
  color += cyan * gridA * 0.13;
  color += magenta * gridB * 0.08;
  color += mix(cyan, magenta, sin(uTime * 0.2 + warped.x * 2.0) * 0.5 + 0.5) * light * (0.42 + uBloomStrength * 0.32);
  color += vec3(0.45, 0.85, 1.0) * pointerGlow * 0.09;
  color += (grain - 0.5) * 0.018;
  color *= 1.0 - smoothstep(0.55, 1.25, length((vUv - 0.5) * aspect));
  gl_FragColor = vec4(color, 1.0);
}
`;

export class FluidCursorFieldScene implements VisualEffectScene<FluidCursorFieldConfig> {
  private readonly renderer = new THREE.WebGLRenderer({antialias: false, alpha: false, powerPreference: "high-performance"});
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly pointer = new THREE.Vector2(0.5, 0.5);
  private readonly pointerTarget = new THREE.Vector2(0.5, 0.5);
  private readonly previousPointer = new THREE.Vector2(0.5, 0.5);
  private readonly impulses = Array.from({length: IMPULSE_COUNT}, () => new THREE.Vector4(0.5, 0.5, 99, 0));
  private readonly material = new THREE.ShaderMaterial({
    depthWrite: false,
    fragmentShader,
    uniforms: {
      uResolution: {value: new THREE.Vector2(1, 1)},
      uPointer: {value: new THREE.Vector2(0.5, 0.5)},
      uTime: {value: 0},
      uZoom: {value: 1},
      uDistortionStrength: {value: 1},
      uTrailPersistence: {value: 0.72},
      uRippleRadius: {value: 0.105},
      uFluidDecay: {value: 0.82},
      uBackgroundScale: {value: 2.2},
      uBloomStrength: {value: 1.05},
      uImpulses: {value: this.impulses},
    },
    vertexShader,
  });
  private config: FluidCursorFieldConfig;
  private impulseCursor = 0;
  private drag = 0;
  private wheel = 0;
  private zoom = 1;

  constructor({config}: {config: FluidCursorFieldConfig; seed?: number}) {
    this.config = sanitizeFluidCursorFieldConfig(config);
    this.renderer.setClearColor("#03040a", 1);
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  mount(target: HTMLElement) {
    target.appendChild(this.renderer.domElement);
  }

  setConfig(config: FluidCursorFieldConfig) {
    this.config = sanitizeFluidCursorFieldConfig(config);
  }

  update({clock, input}: {clock: EffectClock; viewport: EffectViewport; input: EffectInputState}) {
    const delta = Math.min(0.05, Math.max(0.001, clock.delta));
    this.pointerTarget.set(input.pointerX * 0.5 + 0.5, input.pointerY * 0.5 + 0.5);
    this.pointer.lerp(this.pointerTarget, dampFactor(16, delta));
    this.drag = damp(this.drag, input.dragTarget, 8, delta);
    this.wheel = decay(input.wheel, 2.3, delta);
    this.zoom = damp(this.zoom, 1 + this.wheel * 0.08, 4, delta);

    const speed = this.pointer.distanceTo(this.previousPointer) / Math.max(delta, 1 / 120);
    const force = THREE.MathUtils.clamp(speed * 0.42 + this.drag * 0.5, 0, 2.6);
    if (force > 0.035) {
      const impulse = this.impulses[this.impulseCursor];
      impulse.set(this.pointer.x, this.pointer.y, 0, force);
      this.impulseCursor = (this.impulseCursor + 1) % this.impulses.length;
    }

    for (const impulse of this.impulses) {
      impulse.z += delta * (1.0 + (1 - this.config.trailPersistence) * 1.4);
      impulse.w *= Math.exp(-delta * (0.45 + this.config.fluidDecay * 0.18));
    }

    this.material.uniforms.uPointer.value.copy(this.pointer);
    this.material.uniforms.uTime.value = clock.time;
    this.material.uniforms.uZoom.value = this.zoom;
    this.material.uniforms.uDistortionStrength.value = this.config.distortionStrength;
    this.material.uniforms.uTrailPersistence.value = this.config.trailPersistence;
    this.material.uniforms.uRippleRadius.value = this.config.rippleRadius;
    this.material.uniforms.uFluidDecay.value = this.config.fluidDecay;
    this.material.uniforms.uBackgroundScale.value = this.config.backgroundScale;
    this.material.uniforms.uBloomStrength.value = this.config.bloomStrength;
    this.previousPointer.copy(this.pointer);
    this.renderer.render(this.scene, this.camera);
  }

  resize({height, pixelRatio, width}: EffectViewport) {
    this.renderer.setPixelRatio(Math.min(pixelRatio, 1.75));
    this.renderer.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)), false);
    this.material.uniforms.uResolution.value.set(Math.max(1, width), Math.max(1, height));
  }

  dispose() {
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
