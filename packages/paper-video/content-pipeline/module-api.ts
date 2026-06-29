import type {
  BackgroundMotionConfig,
  CellularEffectConfig,
  DonutEffectConfig,
  LightsEffectConfig,
  ParticleEffectConfig,
  RubiksEffectConfig,
  TextMotionConfig,
  TextMotionId,
  TypographyScaleConfig,
  VisualModuleConfig,
} from "@paper-to-video/shared-types";



export const DEFAULT_CELLULAR_EFFECT: CellularEffectConfig = {
  cellColumns: 44,
  cellRows: 78,
  stepEveryFrames: 1,
  cellPadding: 0.5,
  cellScale: 1,
  foodCount: 30,
  snakeStrategy: "row-sweep",
  cornerRadius: 0.45,
  edgeMode: "wrap",
  colorPreset: "mint-ice",
  primaryHue: 164,
  primarySaturation: 100,
  primaryLightness: 83,
  secondaryHue: 43,
  secondarySaturation: 100,
  secondaryLightness: 96,
  birthHue: 340,
  birthSaturation: 100,
  birthLightness: 70,
  primaryColor: "#a7ffe8",
  secondaryColor: "#fff8ec",
  birthColor: "#8fd2ff",
  launchClickRatio: 0.22,
  launchSettleRatio: 0,
  minLaunchClickFrames: 8,
  maxLaunchClickFrames: 28,
  minLaunchSettleFrames: 0,
  maxLaunchSettleFrames: 1,
};

export const DEFAULT_TYPOGRAPHY_SCALE: TypographyScaleConfig = {
  kickerSize: "clamp(0.86rem, 1.1vw + 0.5rem, 1.6rem)",
  titleSize: "clamp(2.35rem, 4.9vw + 0.6rem, 5.4rem)",
  bodySize: "clamp(1.16rem, 1.9vw + 0.54rem, 2.35rem)",
  bulletSize: "clamp(1.08rem, 1.7vw + 0.5rem, 2.08rem)",
  subtitleSize: "clamp(1.08rem, 1.48vw + 0.52rem, 1.92rem)",
};

export const DEFAULT_PARTICLE_EFFECT: ParticleEffectConfig = {
  variant: "nebula",
  shape: "circle",
  distribution: "core",
  trajectory: "orbit",
  particleCount: 260,
  pointSize: 1.5,
  orbitRadius: 0.24,
  swirlStrength: 0.1,
  driftSpeed: 0.007,
  layerDepth: 4.5,
  primaryColor: "#9dffea",
  secondaryColor: "#9bcfff",
  accentColor: "#ffd5ee",
};

export const DEFAULT_LIGHTS_EFFECT: LightsEffectConfig = {
  variant: "pulse",
  palette: "midnight-cyan",
  density: 0.08,
  speed: 0.62,
  beatIntensity: 0.68,
  beamCount: 2,
  beamLength: 0.56,
  beamThickness: 0.024,
  orbitRadius: 0.24,
  motionSpeed: 0.0062,
  spread: 0.68,
  primaryColor: "#62f3ff",
  secondaryColor: "#4a8fff",
  accentColor: "#ff5fc0",
};

export const DEFAULT_DONUT_EFFECT: DonutEffectConfig = {
  variant: "classic",
  ringRadius: 0.96,
  tubeRadius: 0.25,
  spinSpeed: 0.92,
  orbitSpeed: 0.82,
  wobbleAmount: 0.18,
  pearlCount: 6,
  glowIntensity: 0.22,
  primaryColor: "#ff7fcb",
  secondaryColor: "#73dcff",
  accentColor: "#ffe07c",
};

export const DEFAULT_RUBIKS_EFFECT: RubiksEffectConfig = {
  turnFrames: 14,
  holdFrames: 3,
  cubeScale: 1.02,
  cubieGap: 0.035,
  floatAmplitude: 0.08,
  cameraDrift: 0.09,
};

const CELLULAR_COLOR_PRESETS: Record<
  CellularEffectConfig["colorPreset"],
  Pick<
    CellularEffectConfig,
    | "primaryColor"
    | "secondaryColor"
    | "birthColor"
    | "primaryHue"
    | "primarySaturation"
    | "primaryLightness"
    | "secondaryHue"
    | "secondarySaturation"
    | "secondaryLightness"
    | "birthHue"
    | "birthSaturation"
    | "birthLightness"
  >
> = {
  "mint-ice": {
    primaryColor: "#a7ffe8",
    secondaryColor: "#fff8ec",
    birthColor: "#8fd2ff",
    primaryHue: 164,
    primarySaturation: 100,
    primaryLightness: 83,
    secondaryHue: 43,
    secondarySaturation: 100,
    secondaryLightness: 96,
    birthHue: 205,
    birthSaturation: 100,
    birthLightness: 78,
  },
  "sunset-pop": {
    primaryColor: "#ffb77d",
    secondaryColor: "#fff0d9",
    birthColor: "#ff7fb3",
    primaryHue: 27,
    primarySaturation: 100,
    primaryLightness: 75,
    secondaryHue: 37,
    secondarySaturation: 100,
    secondaryLightness: 92,
    birthHue: 334,
    birthSaturation: 100,
    birthLightness: 75,
  },
  "violet-cyan": {
    primaryColor: "#9c9bff",
    secondaryColor: "#defdff",
    birthColor: "#67f1ff",
    primaryHue: 240,
    primarySaturation: 100,
    primaryLightness: 80,
    secondaryHue: 184,
    secondarySaturation: 100,
    secondaryLightness: 94,
    birthHue: 185,
    birthSaturation: 100,
    birthLightness: 70,
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hslToHex = (h: number, s: number, l: number) => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = x;
  } else if (segment >= 1 && segment < 2) {
    red = x;
    green = chroma;
  } else if (segment >= 2 && segment < 3) {
    green = chroma;
    blue = x;
  } else if (segment >= 3 && segment < 4) {
    green = x;
    blue = chroma;
  } else if (segment >= 4 && segment < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = lightness - chroma / 2;
  const toHex = (value: number) => {
    const byte = Math.round((value + match) * 255);
    return byte.toString(16).padStart(2, "0");
  };

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

const PARTICLE_VARIANTS: Record<
  ParticleEffectConfig["variant"],
  Partial<ParticleEffectConfig>
> = {
  nebula: {
    shape: "circle",
    distribution: "core",
    trajectory: "orbit",
    particleCount: 260,
    pointSize: 1.5,
    orbitRadius: 0.24,
    swirlStrength: 0.1,
    driftSpeed: 0.007,
    layerDepth: 4.5,
    primaryColor: "#9dffea",
    secondaryColor: "#9bcfff",
    accentColor: "#ffd5ee",
  },
  vortex: {
    shape: "diamond",
    distribution: "spiral",
    trajectory: "orbit",
    particleCount: 520,
    pointSize: 2.2,
    orbitRadius: 0.24,
    swirlStrength: 0.26,
    driftSpeed: 0.011,
    layerDepth: 7,
    primaryColor: "#8eeeff",
    secondaryColor: "#f2f7ff",
    accentColor: "#b3adff",
  },
  comet: {
    shape: "square",
    distribution: "halo",
    trajectory: "drift",
    particleCount: 300,
    pointSize: 2.3,
    orbitRadius: 0.26,
    swirlStrength: 0.08,
    driftSpeed: 0.014,
    layerDepth: 8,
    primaryColor: "#fff0c2",
    secondaryColor: "#ffc3da",
    accentColor: "#9ad6ff",
  },
};

const DONUT_VARIANTS: Record<
  DonutEffectConfig["variant"],
  Partial<DonutEffectConfig>
> = {
  classic: {
    ringRadius: 0.96,
    tubeRadius: 0.25,
    spinSpeed: 0.92,
    orbitSpeed: 0.82,
    wobbleAmount: 0.18,
    pearlCount: 6,
    glowIntensity: 0.22,
    primaryColor: "#ff7fcb",
    secondaryColor: "#73dcff",
    accentColor: "#ffe07c",
  },
  arcade: {
    ringRadius: 0.92,
    tubeRadius: 0.23,
    spinSpeed: 1.08,
    orbitSpeed: 0.96,
    wobbleAmount: 0.16,
    pearlCount: 7,
    glowIntensity: 0.26,
    primaryColor: "#6ef1ff",
    secondaryColor: "#ff74c6",
    accentColor: "#fff18b",
  },
  cosmic: {
    ringRadius: 1.02,
    tubeRadius: 0.22,
    spinSpeed: 0.76,
    orbitSpeed: 0.72,
    wobbleAmount: 0.22,
    pearlCount: 5,
    glowIntensity: 0.28,
    primaryColor: "#b7a2ff",
    secondaryColor: "#8effff",
    accentColor: "#ffc67a",
  },
};

const LIGHTS_VARIANTS: Record<
  LightsEffectConfig["variant"],
  Partial<LightsEffectConfig>
> = {
  pulse: {
    palette: "midnight-cyan",
    density: 0.08,
    speed: 0.62,
    beatIntensity: 0.68,
    beamCount: 2,
    beamLength: 0.56,
    beamThickness: 0.024,
    orbitRadius: 0.24,
    motionSpeed: 0.0062,
    spread: 0.68,
    primaryColor: "#62f3ff",
    secondaryColor: "#4a8fff",
    accentColor: "#ff5fc0",
  },
  fan: {
    palette: "violet-haze",
    density: 0.26,
    speed: 0.68,
    beatIntensity: 0.78,
    beamCount: 8,
    beamLength: 0.62,
    beamThickness: 0.022,
    orbitRadius: 0.28,
    motionSpeed: 0.0068,
    spread: 0.82,
    primaryColor: "#9df9ff",
    secondaryColor: "#7e90ff",
    accentColor: "#ff94f0",
  },
  bloom: {
    palette: "sunset-plasma",
    density: 0.3,
    speed: 0.74,
    beatIntensity: 0.88,
    beamCount: 10,
    beamLength: 0.68,
    beamThickness: 0.026,
    orbitRadius: 0.26,
    motionSpeed: 0.0072,
    spread: 0.76,
    primaryColor: "#ffefb6",
    secondaryColor: "#ff9a75",
    accentColor: "#ff63cf",
  },
};

const LIGHTS_PALETTES: Record<
  LightsEffectConfig["palette"],
  Pick<LightsEffectConfig, "primaryColor" | "secondaryColor" | "accentColor">
> = {
  "midnight-cyan": {
    primaryColor: "#62f3ff",
    secondaryColor: "#4a8fff",
    accentColor: "#ff5fc0",
  },
  "violet-haze": {
    primaryColor: "#d7d5ff",
    secondaryColor: "#7e90ff",
    accentColor: "#8ff6ff",
  },
  "sunset-plasma": {
    primaryColor: "#ffefb6",
    secondaryColor: "#ff9a75",
    accentColor: "#ff63cf",
  },
};



export const resolveCellularEffectConfig = (
  modules?: VisualModuleConfig,
): CellularEffectConfig => {
  const overrides = modules?.cellularEffect ?? {};
  const colorPreset = overrides.colorPreset ?? DEFAULT_CELLULAR_EFFECT.colorPreset;
  const resolved = {
    ...DEFAULT_CELLULAR_EFFECT,
    ...CELLULAR_COLOR_PRESETS[colorPreset],
    ...overrides,
  };

  return {
    ...resolved,
    foodCount: Math.max(1, Math.round(resolved.foodCount)),
    primaryColor: hslToHex(
      resolved.primaryHue,
      resolved.primarySaturation,
      resolved.primaryLightness,
    ),
    secondaryColor: hslToHex(
      resolved.secondaryHue,
      resolved.secondarySaturation,
      resolved.secondaryLightness,
    ),
    birthColor: hslToHex(
      resolved.birthHue,
      resolved.birthSaturation,
      resolved.birthLightness,
    ),
  };
};

export const resolveTypographyScaleConfig = (
  modules?: VisualModuleConfig,
): TypographyScaleConfig => {
  return {
    ...DEFAULT_TYPOGRAPHY_SCALE,
    ...(modules?.typography ?? {}),
  };
};

export const resolveParticleEffectConfig = (
  modules?: VisualModuleConfig,
): ParticleEffectConfig => {
  const overrides = modules?.particleEffect ?? {};
  const variant = overrides.variant ?? DEFAULT_PARTICLE_EFFECT.variant;
  return {
    ...DEFAULT_PARTICLE_EFFECT,
    ...PARTICLE_VARIANTS[variant],
    ...overrides,
  };
};

export const resolveDonutEffectConfig = (
  modules?: VisualModuleConfig,
): DonutEffectConfig => {
  const overrides = modules?.donutEffect ?? {};
  const variant = overrides.variant ?? DEFAULT_DONUT_EFFECT.variant;
  return {
    ...DEFAULT_DONUT_EFFECT,
    ...DONUT_VARIANTS[variant],
    ...overrides,
  };
};

export const resolveRubiksEffectConfig = (
  modules?: VisualModuleConfig,
): RubiksEffectConfig => {
  return {
    ...DEFAULT_RUBIKS_EFFECT,
    ...(modules?.rubiksEffect ?? {}),
  };
};

export const resolveLightsEffectConfig = (
  modules?: VisualModuleConfig,
): LightsEffectConfig => {
  const overrides = modules?.lightsEffect ?? {};
  const variant = overrides.variant ?? DEFAULT_LIGHTS_EFFECT.variant;
  const palette = overrides.palette ?? LIGHTS_VARIANTS[variant].palette ?? DEFAULT_LIGHTS_EFFECT.palette;
  const resolved = {
    ...DEFAULT_LIGHTS_EFFECT,
    ...LIGHTS_VARIANTS[variant],
    ...LIGHTS_PALETTES[palette],
    ...overrides,
  };

  return {
    ...resolved,
    beamCount: Math.max(2, Math.round(1 + resolved.density * 10)),
    motionSpeed: 0.0038 + resolved.speed * 0.0052,
    spread: 0.5 + resolved.density * 0.42,
    beamLength: 0.48 + resolved.density * 0.28,
    beamThickness: 0.018 + resolved.density * 0.014,
    orbitRadius: 0.18 + resolved.speed * 0.16,
  };
};
