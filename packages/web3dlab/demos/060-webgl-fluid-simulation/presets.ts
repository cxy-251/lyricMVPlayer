import type {FluidConfig, FluidControlValues, FluidPresetName, FluidQuality} from './types';

export const FLUID_PRESETS: Record<FluidPresetName, Pick<FluidConfig,
  | 'backgroundColor'
  | 'bloom'
  | 'bloomIntensity'
  | 'bloomSoftKnee'
  | 'bloomThreshold'
  | 'curlStrength'
  | 'densityDissipation'
  | 'palette'
  | 'pressureRetention'
  | 'splatForce'
  | 'splatRadius'
  | 'sunrays'
  | 'sunraysExposure'
  | 'sunraysWeight'
  | 'transparent'
  | 'velocityDissipation'
>> = {
  'Classic Fluid': {
    backgroundColor: '#05070c',
    bloom: true,
    bloomIntensity: 0.74,
    bloomSoftKnee: 0.62,
    bloomThreshold: 0.46,
    curlStrength: 27,
    densityDissipation: 0.985,
    palette: [[0.12, 0.72, 1], [0.95, 0.2, 0.72], [0.24, 1, 0.67], [1, 0.62, 0.12]],
    pressureRetention: 0.82,
    splatForce: 6200,
    splatRadius: 0.19,
    sunrays: true,
    sunraysExposure: 0.24,
    sunraysWeight: 0.72,
    transparent: false,
    velocityDissipation: 0.992,
  },
  'Neon Smoke': {
    backgroundColor: '#04030b',
    bloom: true,
    bloomIntensity: 1.08,
    bloomSoftKnee: 0.72,
    bloomThreshold: 0.34,
    curlStrength: 34,
    densityDissipation: 0.988,
    palette: [[0.35, 0.16, 1], [1, 0.08, 0.62], [0.04, 0.82, 1], [0.64, 0.22, 1]],
    pressureRetention: 0.84,
    splatForce: 6900,
    splatRadius: 0.21,
    sunrays: true,
    sunraysExposure: 0.3,
    sunraysWeight: 0.79,
    transparent: false,
    velocityDissipation: 0.994,
  },
  'Ink Cloud': {
    backgroundColor: '#eef1f0',
    bloom: false,
    bloomIntensity: 0.25,
    bloomSoftKnee: 0.45,
    bloomThreshold: 0.72,
    curlStrength: 19,
    densityDissipation: 0.993,
    palette: [[0.03, 0.1, 0.16], [0.08, 0.28, 0.36], [0.18, 0.08, 0.26], [0.04, 0.34, 0.27]],
    pressureRetention: 0.8,
    splatForce: 4700,
    splatRadius: 0.24,
    sunrays: false,
    sunraysExposure: 0.08,
    sunraysWeight: 0.35,
    transparent: false,
    velocityDissipation: 0.989,
  },
  'Solar Plasma': {
    backgroundColor: '#090302',
    bloom: true,
    bloomIntensity: 1.28,
    bloomSoftKnee: 0.78,
    bloomThreshold: 0.28,
    curlStrength: 41,
    densityDissipation: 0.984,
    palette: [[1, 0.12, 0.015], [1, 0.44, 0.025], [1, 0.9, 0.32], [0.96, 0.08, 0.24]],
    pressureRetention: 0.86,
    splatForce: 7600,
    splatRadius: 0.18,
    sunrays: true,
    sunraysExposure: 0.38,
    sunraysWeight: 0.88,
    transparent: false,
    velocityDissipation: 0.995,
  },
};

export const QUALITY_SETTINGS: Record<FluidQuality, Pick<FluidConfig,
  'dyeResolution' | 'pressureIterations' | 'simResolution'
>> = {
  High: {dyeResolution: 1024, pressureIterations: 24, simResolution: 192},
  Medium: {dyeResolution: 768, pressureIterations: 18, simResolution: 144},
  Low: {dyeResolution: 512, pressureIterations: 12, simResolution: 96},
};

export const DEFAULT_FLUID_CONTROLS: FluidControlValues = {
  ...FLUID_PRESETS['Classic Fluid'],
  ...QUALITY_SETTINGS.Medium,
  autoDemo: true,
  preset: 'Classic Fluid',
  quality: 'Medium',
};

export const resolveFluidConfig = (controls: FluidControlValues, paused: boolean): FluidConfig => ({
  ...controls,
  palette: FLUID_PRESETS[controls.preset].palette,
  paused,
});
