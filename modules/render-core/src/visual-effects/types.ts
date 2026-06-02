export type VisualEffectMode = "interactive" | "remotion";

export type VisualEffectId =
  | "particle-galaxy"
  | "neon-energy-tunnel"
  | "fluid-cursor-field"
  | "physics-cloth-banner"
  | "particle-morphing-field";

export type EffectClock = {
  time: number;
  delta: number;
  frame?: number;
  fps?: number;
};

export type EffectViewport = {
  width: number;
  height: number;
  pixelRatio: number;
};

export type EffectInputState = {
  pointerX: number;
  pointerY: number;
  dragTarget: number;
  wheel: number;
  clickCount: number;
};

export type ParticleGalaxyConfig = {
  particleCount: number;
  particleSize: number;
  rotationSpeed: number;
  interactionStrength: number;
  bloomStrength: number;
};

export type NeonEnergyTunnelConfig = {
  travelSpeed: number;
  tunnelRadius: number;
  segmentCount: number;
  glowStrength: number;
  distortionStrength: number;
  particleDensity: number;
};

export type FluidCursorFieldConfig = {
  distortionStrength: number;
  trailPersistence: number;
  rippleRadius: number;
  fluidDecay: number;
  backgroundScale: number;
  bloomStrength: number;
};

export type PhysicsClothBannerConfig = {
  windStrength: number;
  damping: number;
  clothResolution: number;
  interactionRadius: number;
  interactionStrength: number;
  glowStrength: number;
};

export type ParticleMorphingFieldConfig = {
  particleCount: number;
  particleSize: number;
  morphSpeed: number;
  turbulenceStrength: number;
  interactionStrength: number;
  bloomStrength: number;
};

export type VisualEffectConfigMap = {
  "particle-galaxy": ParticleGalaxyConfig;
  "neon-energy-tunnel": NeonEnergyTunnelConfig;
  "fluid-cursor-field": FluidCursorFieldConfig;
  "physics-cloth-banner": PhysicsClothBannerConfig;
  "particle-morphing-field": ParticleMorphingFieldConfig;
};

export type VisualEffectScene<TConfig> = {
  mount(target: HTMLElement): void;
  setConfig(config: TConfig): void;
  update(input: {
    clock: EffectClock;
    viewport: EffectViewport;
    input: EffectInputState;
  }): void;
  resize(viewport: EffectViewport): void;
  dispose(): void;
};
