export type BackgroundImageLayoutId =
  | "gradient-default"
  | "cover-full"
  | "cover-focus-tl"
  | "cover-focus-tr"
  | "cover-focus-br"
  | "cover-focus-bl";

export type BackgroundEffectId =
  | "none"
  | "aurora"
  | "grid-drift"
  | "noise-bloom"
  | "cellular-launch"
  | "cellular-life"
  | "snake-grid"
  | "particle-orbit"
  | "donut-spin"
  | "lights-launch"
  | "lights-beams"
  | "rubiks-launch"
  | "rubiks-auto-solve";

export type WebGLEffectProfileId =
  | "life-game"
  | "snake-grid"
  | "particle-orbit"
  | "donut-spin"
  | "lights-beams"
  | "rubiks-solver";

export type EffectProfileConfig = {
  id: WebGLEffectProfileId;
};

export type TextMotionId = "fade-up" | "slide-up" | "stagger-rise" | "hard-cut";

export type TextMotionConfig = {
  enterFrames: number;
  maxLiftPx: number;
  minOpacity: number;
  bodyDelayFrames: number;
  bulletsStaggerFrames: number;
  exitFrames: number;
  exitLiftPx: number;
  exitOpacity: number;
};

export type BackgroundMotionConfig = {
  overscanPercent: number;
  panTravelPercent: number;
};

export type CellularEffectConfig = {
  cellColumns: number;
  cellRows: number;
  stepEveryFrames: number;
  cellPadding: number;
  cellScale: number;
  foodCount: number;
  snakeStrategy: "survival-chase" | "row-sweep" | "safe-loop";
  cornerRadius: number;
  edgeMode: "wrap";
  colorPreset: "mint-ice" | "sunset-pop" | "violet-cyan";
  primaryHue: number;
  primarySaturation: number;
  primaryLightness: number;
  secondaryHue: number;
  secondarySaturation: number;
  secondaryLightness: number;
  birthHue: number;
  birthSaturation: number;
  birthLightness: number;
  primaryColor: string;
  secondaryColor: string;
  birthColor: string;
  launchClickRatio: number;
  launchSettleRatio: number;
  minLaunchClickFrames: number;
  maxLaunchClickFrames: number;
  minLaunchSettleFrames: number;
  maxLaunchSettleFrames: number;
};

export type TypographyScaleConfig = {
  kickerSize: string;
  titleSize: string;
  bodySize: string;
  bulletSize: string;
  subtitleSize: string;
};

export type ParticleEffectConfig = {
  variant: "nebula" | "vortex" | "comet";
  shape: "circle" | "square" | "diamond";
  distribution: "core" | "spiral" | "halo";
  trajectory: "orbit" | "drift" | "wave";
  particleCount: number;
  pointSize: number;
  orbitRadius: number;
  swirlStrength: number;
  driftSpeed: number;
  layerDepth: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export type DonutEffectConfig = {
  variant: "classic" | "arcade" | "cosmic";
  ringRadius: number;
  tubeRadius: number;
  spinSpeed: number;
  orbitSpeed: number;
  wobbleAmount: number;
  pearlCount: number;
  glowIntensity: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export type RubiksEffectConfig = {
  turnFrames: number;
  holdFrames: number;
  cubeScale: number;
  cubieGap: number;
  floatAmplitude: number;
  cameraDrift: number;
};

export type LightsEffectConfig = {
  variant: "pulse" | "fan" | "bloom";
  palette: "midnight-cyan" | "violet-haze" | "sunset-plasma";
  density: number;
  speed: number;
  beatIntensity: number;
  beamCount: number;
  beamLength: number;
  beamThickness: number;
  orbitRadius: number;
  motionSpeed: number;
  spread: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export type VisualModuleConfig = {
  textMotions?: Partial<Record<TextMotionId, Partial<TextMotionConfig>>>;
  backgroundMotion?: Partial<BackgroundMotionConfig>;
  cellularEffect?: Partial<CellularEffectConfig>;
  particleEffect?: Partial<ParticleEffectConfig>;
  donutEffect?: Partial<DonutEffectConfig>;
  lightsEffect?: Partial<LightsEffectConfig>;
  rubiksEffect?: Partial<RubiksEffectConfig>;
  typography?: Partial<TypographyScaleConfig>;
};

