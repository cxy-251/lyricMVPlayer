import type {
  BackgroundEffectId,
  BackgroundImageLayoutId,
  EffectProfileConfig,
  ProductionScene,
  RenderScene,
} from "@paper-to-video/shared-types";

const COVER_FOCUS_CYCLE: BackgroundImageLayoutId[] = [
  "cover-focus-tl",
  "cover-focus-tr",
  "cover-focus-br",
  "cover-focus-bl",
];

const LEGACY_EFFECT_MAP: Record<string, BackgroundEffectId> = {
  aurora: "aurora",
  "cover-grid-drift": "grid-drift",
  "cover-soft-focus": "none",
  "cover-noise-bloom": "noise-bloom",
  "cover-cellular-mask": "cellular-life",
};

export const resolveSceneBackgroundImageLayoutId = (
  scene: Pick<ProductionScene, "type" | "backgroundPresetId" | "backgroundImageLayoutId">,
  coverCycleIndex: number,
): BackgroundImageLayoutId => {
  if (scene.backgroundImageLayoutId) {
    return scene.backgroundImageLayoutId;
  }

  if (scene.type === "hero") {
    return "cover-full";
  }

  if (scene.backgroundPresetId.startsWith("cover-")) {
    return COVER_FOCUS_CYCLE[coverCycleIndex % COVER_FOCUS_CYCLE.length];
  }

  return "gradient-default";
};

const LAYOUT_POINTS: Record<BackgroundImageLayoutId, {x: number; y: number; scale: number}> = {
  "gradient-default": {x: 50, y: 50, scale: 1.06},
  "cover-full": {x: 50, y: 50, scale: 1.06},
  "cover-focus-tl": {x: 16, y: 16, scale: 1.46},
  "cover-focus-tr": {x: 84, y: 16, scale: 1.46},
  "cover-focus-br": {x: 84, y: 84, scale: 1.48},
  "cover-focus-bl": {x: 16, y: 84, scale: 1.48},
};

const LAYOUT_TONES: Record<
  BackgroundImageLayoutId,
  {blurPx: number; opacity: number; brightness: number; saturation: number; shade: string}
> = {
  "gradient-default": {
    blurPx: 8,
    opacity: 0.58,
    brightness: 0.58,
    saturation: 0.94,
    shade: "linear-gradient(180deg, rgba(5,10,16,0.46) 0%, rgba(5,10,16,0.64) 100%)",
  },
  "cover-full": {
    blurPx: 0,
    opacity: 0.92,
    brightness: 0.96,
    saturation: 1.02,
    shade: "linear-gradient(90deg, rgba(6,10,16,0.06) 0%, rgba(6,10,16,0.38) 46%, rgba(6,10,16,0.72) 100%)",
  },
  "cover-focus-tl": {
    blurPx: 5,
    opacity: 0.76,
    brightness: 0.62,
    saturation: 0.96,
    shade: "linear-gradient(180deg, rgba(5,10,16,0.36) 0%, rgba(5,10,16,0.54) 100%)",
  },
  "cover-focus-tr": {
    blurPx: 5,
    opacity: 0.76,
    brightness: 0.62,
    saturation: 0.96,
    shade: "linear-gradient(180deg, rgba(5,10,16,0.36) 0%, rgba(5,10,16,0.54) 100%)",
  },
  "cover-focus-br": {
    blurPx: 6,
    opacity: 0.76,
    brightness: 0.6,
    saturation: 0.96,
    shade: "linear-gradient(180deg, rgba(5,10,16,0.38) 0%, rgba(5,10,16,0.56) 100%)",
  },
  "cover-focus-bl": {
    blurPx: 6,
    opacity: 0.76,
    brightness: 0.6,
    saturation: 0.96,
    shade: "linear-gradient(180deg, rgba(5,10,16,0.38) 0%, rgba(5,10,16,0.56) 100%)",
  },
};

const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;

export const getCoverLayoutConfig = (
  layoutId: BackgroundImageLayoutId,
  panTravelPercent = 0.82,
) => {
  const point = LAYOUT_POINTS[layoutId];
  const tone = LAYOUT_TONES[layoutId];
  return {
    objectPosition: `${point.x}% ${point.y}%`,
    scale: point.scale,
    translateX: (50 - point.x) * panTravelPercent,
    translateY: (50 - point.y) * panTravelPercent,
    blurPx: tone.blurPx,
    opacity: tone.opacity,
    brightness: tone.brightness,
    saturation: tone.saturation,
    shade: tone.shade,
  };
};

export const getInterpolatedCoverLayoutConfig = ({
  fromLayoutId,
  toLayoutId,
  progress,
  panTravelPercent = 0.82,
}: {
  fromLayoutId: BackgroundImageLayoutId;
  toLayoutId: BackgroundImageLayoutId;
  progress: number;
  panTravelPercent?: number;
}) => {
  const fromPoint = LAYOUT_POINTS[fromLayoutId];
  const toPoint = LAYOUT_POINTS[toLayoutId];
  const fromTone = LAYOUT_TONES[fromLayoutId];
  const toTone = LAYOUT_TONES[toLayoutId];

  return {
    objectPosition: `${lerp(fromPoint.x, toPoint.x, progress)}% ${lerp(fromPoint.y, toPoint.y, progress)}%`,
    scale: lerp(fromPoint.scale, toPoint.scale, progress),
    translateX: lerp(
      (50 - fromPoint.x) * panTravelPercent,
      (50 - toPoint.x) * panTravelPercent,
      progress,
    ),
    translateY: lerp(
      (50 - fromPoint.y) * panTravelPercent,
      (50 - toPoint.y) * panTravelPercent,
      progress,
    ),
    blurPx: lerp(fromTone.blurPx, toTone.blurPx, progress),
    opacity: lerp(fromTone.opacity, toTone.opacity, progress),
    brightness: lerp(fromTone.brightness, toTone.brightness, progress),
    saturation: lerp(fromTone.saturation, toTone.saturation, progress),
    shade: progress < 0.5 ? fromTone.shade : toTone.shade,
  };
};

export const getSceneVisualIds = (
  scene: Pick<RenderScene, "backgroundImageLayoutId" | "backgroundEffectId" | "backgroundPresetId">,
) => {
  return {
    backgroundImageLayoutId:
      scene.backgroundImageLayoutId ??
      (scene.backgroundPresetId.startsWith("cover-") ? "cover-focus-tl" : "gradient-default"),
    backgroundEffectId: scene.backgroundEffectId ?? (LEGACY_EFFECT_MAP[scene.backgroundPresetId] ?? "none"),
  };
};
