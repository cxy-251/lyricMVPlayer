import * as THREE from "three";

import type {EffectControl} from "../../types";

export type ProceduralEffectConfig = {
  primary: string;
  secondary: string;
  density: number;
  speed: number;
  intensity: number;
  scale: number;
  audioReactivity: number;
};

export const PROCEDURAL_CONTROLS: EffectControl[] = [
  {kind: "number", field: "density", label: "Density", min: 0.2, max: 1.5, step: 0.01},
  {kind: "number", field: "speed", label: "Speed", min: 0, max: 2, step: 0.01},
  {kind: "number", field: "intensity", label: "Intensity", min: 0.1, max: 2.5, step: 0.01},
  {kind: "number", field: "scale", label: "Scale", min: 0.4, max: 1.8, step: 0.01},
  {kind: "number", field: "audioReactivity", label: "Audio", min: 0, max: 2, step: 0.01},
  {kind: "color", field: "primary", label: "Primary"},
  {kind: "color", field: "secondary", label: "Secondary"},
];

const numberValue = (value: unknown, fallback: number, min: number, max: number) =>
  THREE.MathUtils.clamp(typeof value === "number" && Number.isFinite(value) ? value : fallback, min, max);

const colorValue = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  try {
    return `#${new THREE.Color(value).getHexString()}`;
  } catch {
    return fallback;
  }
};

export const sanitizeProceduralConfig = (
  value: unknown,
  defaults: ProceduralEffectConfig,
): ProceduralEffectConfig => {
  const candidate = typeof value === "object" && value ? value as Partial<ProceduralEffectConfig> : {};
  return {
    primary: colorValue(candidate.primary, defaults.primary),
    secondary: colorValue(candidate.secondary, defaults.secondary),
    density: numberValue(candidate.density, defaults.density, 0.2, 1.5),
    speed: numberValue(candidate.speed, defaults.speed, 0, 2),
    intensity: numberValue(candidate.intensity, defaults.intensity, 0.1, 2.5),
    scale: numberValue(candidate.scale, defaults.scale, 0.4, 1.8),
    audioReactivity: numberValue(candidate.audioReactivity, defaults.audioReactivity, 0, 2),
  };
};

export const createLayerTarget = () => new THREE.WebGLRenderTarget(1, 1, {
  depthBuffer: true,
  stencilBuffer: false,
  type: THREE.UnsignedByteType,
  format: THREE.RGBAFormat,
});
