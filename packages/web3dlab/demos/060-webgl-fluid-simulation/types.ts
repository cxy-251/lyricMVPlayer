export type FluidQuality = 'High' | 'Medium' | 'Low';
export type FluidPresetName = 'Classic Fluid' | 'Neon Smoke' | 'Ink Cloud' | 'Solar Plasma';

export type FluidColor = [number, number, number];

export type FluidConfig = {
  autoDemo: boolean;
  backgroundColor: string;
  bloom: boolean;
  bloomIntensity: number;
  bloomSoftKnee: number;
  bloomThreshold: number;
  curlStrength: number;
  densityDissipation: number;
  dyeResolution: number;
  palette: FluidColor[];
  paused: boolean;
  pressureIterations: number;
  pressureRetention: number;
  quality: FluidQuality;
  simResolution: number;
  splatForce: number;
  splatRadius: number;
  sunrays: boolean;
  sunraysExposure: number;
  sunraysWeight: number;
  transparent: boolean;
  velocityDissipation: number;
};

export type FluidControlValues = Omit<FluidConfig, 'palette' | 'paused'> & {
  preset: FluidPresetName;
};

export type FluidEngineActions = {
  randomSplat: (count?: number) => void;
  reset: () => void;
  setConfig: (config: FluidConfig) => void;
  setPaused: (paused: boolean) => void;
};
