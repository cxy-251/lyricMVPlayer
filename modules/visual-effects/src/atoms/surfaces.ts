import * as THREE from "three";

import type {EffectFrameContext, EffectViewport, VisualEffectAtom, VisualEffectLayer} from "../types";
import {
  createLayerTarget,
  PROCEDURAL_CONTROLS,
  type ProceduralEffectConfig,
  sanitizeProceduralConfig,
} from "./config";

export type SurfaceKind = "fluid" | "liquid-metal" | "metaballs" | "audio-metaballs" | "ferrofluid" | "black-hole-core";

const kindCode: Record<SurfaceKind, number> = {
  fluid: 0,
  "liquid-metal": 1,
  metaballs: 2,
  "audio-metaballs": 3,
  ferrofluid: 4,
  "black-hole-core": 5,
};

const vertexShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uKind;
  uniform float uSpeed;
  uniform float uIntensity;
  uniform float uScale;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uOnset;
  uniform vec2 uPointer;
  uniform vec2 uResolution;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
  }
  float fbm(vec2 p) {
    float value = 0.0; float amplitude = 0.5;
    for (int i = 0; i < 5; i++) { value += noise(p) * amplitude; p = p * 2.03 + 17.1; amplitude *= 0.5; }
    return value;
  }
  float circle(vec2 p, vec2 center, float radius) { return length(p - center) - radius; }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uResolution.x / max(1.0, uResolution.y);
    uv /= max(0.2, uScale);
    float t = uTime * uSpeed;
    float audio = uBass * 0.55 + uMid * 0.25 + uHigh * 0.2;
    vec3 color = vec3(0.0);
    float alpha = 0.0;

    if (uKind < 0.5) {
      vec2 flow = uv + vec2(fbm(uv * 2.2 + t * 0.18), fbm(uv * 2.0 - t * 0.15)) * 0.7;
      float field = fbm(flow * 2.1 + uPointer * 0.8);
      float ripple = sin(length(uv - uPointer) * 24.0 - t * 5.0) * exp(-length(uv - uPointer) * 2.4);
      float glow = smoothstep(0.34, 0.82, field + ripple * (0.12 + uOnset * 0.22));
      color = mix(uPrimary * 0.2, uSecondary * 1.3, glow) + pow(glow, 4.0) * uPrimary;
      alpha = smoothstep(0.06, 0.36, glow) * 0.92;
    } else if (uKind < 1.5) {
      vec2 metalUv = uv - uPointer * 0.1;
      float angle = atan(metalUv.y, metalUv.x);
      float radius = length(metalUv);
      float displacement = sin(angle * 7.0 + t * 1.4) * 0.05 + fbm(metalUv * 3.5 + t * 0.18) * 0.18;
      float edge = 0.75 + displacement + audio * 0.09;
      float shape = smoothstep(0.035, -0.035, radius - edge);
      vec2 gradient = vec2(dFdx(displacement), dFdy(displacement)) * 12.0;
      float dome = sqrt(max(0.0, 1.0 - pow(radius / max(edge, 0.01), 2.0)));
      vec3 normal = normalize(vec3(metalUv / max(edge, 0.01) + gradient, dome * 1.2));
      normal = normalize(mix(vec3(-0.14, 0.22, 1.0), normal, smoothstep(0.06, 0.28, radius)));
      float key = pow(max(0.0, dot(normal, normalize(vec3(-0.45, 0.62, 0.9)))), 7.0);
      float strip = pow(0.5 + 0.5 * sin(normal.y * 12.0 + normal.z * 4.0 - t * 0.7), 7.0);
      float rimLight = pow(smoothstep(0.3, 1.0, radius / max(edge, 0.01)), 4.0);
      float sheen = clamp(key * 1.5 + strip * 0.42 + rimLight * 0.18, 0.0, 1.0);
      color = mix(uPrimary * 0.22, uSecondary * 1.08, sheen);
      color += uSecondary * pow(max(0.0, 1.0 - abs(radius - edge) * 8.0), 5.0) * 0.16;
      alpha = shape;
    } else if (uKind < 3.5) {
      float field = 0.0;
      vec2 fieldGradient = vec2(0.0);
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        vec2 center = vec2(sin(t * (0.31 + fi * 0.024) + fi * 2.1), cos(t * (0.26 + fi * 0.029) + fi * 1.7));
        center *= 0.38 + 0.1 * sin(fi * 4.0);
        center += uPointer * (0.13 + fi * 0.008);
        float radius = 0.18 + 0.04 * sin(fi * 3.1) + (uKind > 2.5 ? audio * 0.11 : 0.0);
        vec2 delta = uv - center;
        float distanceSquared = max(0.003, dot(delta, delta));
        float radiusSquared = radius * radius;
        field += radiusSquared / distanceSquared;
        fieldGradient += -2.0 * radiusSquared * delta / (distanceSquared * distanceSquared);
      }
      float body = smoothstep(0.94, 1.08, field);
      float rim = smoothstep(0.78, 0.98, field) - smoothstep(1.08, 1.42, field);
      float gradientLength = length(fieldGradient);
      vec2 slope = fieldGradient * (0.012 / (1.0 + gradientLength * 0.012));
      vec3 normal = normalize(vec3(-slope * 0.82, 1.0));
      float key = pow(max(0.0, dot(normal, normalize(vec3(-0.55, 0.7, 0.8)))), 8.0);
      float fill = pow(max(0.0, dot(normal, normalize(vec3(0.7, -0.35, 0.62)))), 5.0);
      float fresnel = pow(1.0 - max(0.0, normal.z), 2.2);
      float reflection = 0.5 + 0.5 * sin(normal.y * 10.0 + normal.x * 4.0 - t * 0.55);
      vec3 dark = mix(vec3(0.008, 0.014, 0.035), uPrimary * 0.18, 0.58);
      color = mix(dark, uSecondary * 0.68, reflection * 0.36 + fill * 0.24);
      color += vec3(1.0) * key * 0.72 + uPrimary * fresnel * 0.56 + uSecondary * rim * 0.44;
      color *= 0.72 + body * 0.48;
      alpha = max(body * 0.96, rim * 0.82);
    } else if (uKind < 4.5) {
      vec2 fluidUv = uv - uPointer * 0.08;
      float radius = length(fluidUv);
      float angle = atan(fluidUv.y, fluidUv.x);
      float fineSpikes = pow(0.5 + 0.5 * sin(angle * 34.0 + t * 0.9), 3.0);
      float broadSpikes = sin(angle * 11.0 - t * 0.55 + fbm(vec2(angle * 2.6, t * 0.22)) * 4.0);
      float audioSpike = uBass * 0.13 + uHigh * 0.1 + uOnset * 0.22;
      float edge = 0.67 + broadSpikes * (0.035 + audioSpike) + fineSpikes * (0.055 + audioSpike * 0.7);
      edge += fbm(vec2(angle * 3.0, t * 0.18)) * 0.045;
      float body = smoothstep(0.024, -0.024, radius - edge);
      vec2 sphereUv = fluidUv / max(edge, 0.01);
      float dome = sqrt(max(0.0, 1.0 - dot(sphereUv, sphereUv)));
      vec3 normal = normalize(vec3(sphereUv, dome));
      float key = pow(max(0.0, dot(normal, normalize(vec3(-0.55, 0.7, 0.8)))), 18.0);
      float rimLight = pow(1.0 - max(0.0, normal.z), 2.4);
      float bands = 0.5 + 0.5 * sin(normal.y * 14.0 + normal.x * 5.0 - t * 0.8 + audio * 3.0);
      color = mix(uPrimary * 0.08, uSecondary * 0.68, bands * 0.26 + key * 0.48);
      color += vec3(0.9, 1.0, 1.0) * key * 0.78 + uSecondary * rimLight * 0.5;
      color += uPrimary * pow(0.5 + 0.5 * sin(radius * 24.0 - t * 1.6), 8.0) * 0.12;
      alpha = body;
    } else {
      float radius = length(uv);
      float lens = 0.5 + sin(atan(uv.y, uv.x) * 3.0 - t * 0.45) * 0.018;
      float body = smoothstep(0.018, -0.018, radius - lens);
      float photon = exp(-pow((radius - lens * 1.12) / 0.035, 2.0));
      float outer = exp(-pow((radius - lens * 1.32) / 0.09, 2.0));
      color = uPrimary * photon * (1.3 + uIntensity * 0.35) + uSecondary * outer * 0.32;
      color *= 0.75 + 0.25 * sin(atan(uv.y, uv.x) * 2.0 + t);
      alpha = max(body, max(photon, outer * 0.45));
      color *= 1.0 - body;
    }

    color *= 0.72 + uIntensity * 0.42;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

class SurfaceLayer implements VisualEffectLayer<ProceduralEffectConfig> {
  private readonly target = createLayerTarget();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly material: THREE.ShaderMaterial;
  private config: ProceduralEffectConfig;

  constructor(kind: SurfaceKind, config: ProceduralEffectConfig) {
    this.config = config;
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: {value: 0}, uKind: {value: kindCode[kind]}, uSpeed: {value: config.speed},
        uIntensity: {value: config.intensity}, uScale: {value: config.scale},
        uBass: {value: 0}, uMid: {value: 0}, uHigh: {value: 0}, uOnset: {value: 0},
        uPointer: {value: new THREE.Vector2()}, uResolution: {value: new THREE.Vector2(1, 1)},
        uPrimary: {value: new THREE.Color(config.primary)}, uSecondary: {value: new THREE.Color(config.secondary)},
      },
    });
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
  }

  setConfig(config: ProceduralEffectConfig) { this.config = config; }

  resize(viewport: EffectViewport) {
    const width = Math.max(1, Math.round(viewport.width * Math.min(2, viewport.pixelRatio)));
    const height = Math.max(1, Math.round(viewport.height * Math.min(2, viewport.pixelRatio)));
    this.target.setSize(width, height);
    this.material.uniforms.uResolution.value.set(width, height);
  }

  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const audioScale = this.config.audioReactivity;
    const uniforms = this.material.uniforms;
    uniforms.uTime.value = context.time;
    uniforms.uSpeed.value = this.config.speed;
    uniforms.uIntensity.value = this.config.intensity;
    uniforms.uScale.value = this.config.scale;
    uniforms.uBass.value = context.audio.bass * audioScale;
    uniforms.uMid.value = context.audio.mid * audioScale;
    uniforms.uHigh.value = context.audio.high * audioScale;
    uniforms.uOnset.value = context.audio.onset * audioScale;
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
    this.target.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

export const createSurfaceAtom = (options: {
  id: string;
  title: string;
  description: string;
  kind: SurfaceKind;
  defaults: ProceduralEffectConfig;
  audio?: boolean;
  pointer?: boolean;
}): VisualEffectAtom<ProceduralEffectConfig> => ({
  id: options.id,
  title: options.title,
  description: options.description,
  tags: ["shader", options.kind],
  defaultConfig: options.defaults,
  controls: PROCEDURAL_CONTROLS,
  capabilities: {audio: options.audio, pointer: options.pointer},
  sanitizeConfig: (value) => sanitizeProceduralConfig(value, options.defaults),
  createLayer: ({config}) => new SurfaceLayer(options.kind, config),
});
