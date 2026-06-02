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

export const resolveSceneBackgroundEffectId = (
  scene: Pick<ProductionScene, "backgroundPresetId" | "backgroundEffectId">,
  effectProfile?: EffectProfileConfig,
): BackgroundEffectId => {
  const resolved = scene.backgroundEffectId ?? LEGACY_EFFECT_MAP[scene.backgroundPresetId] ?? "none";
  if (resolved === "rubiks-launch" || resolved === "lights-launch") {
    return resolved;
  }

  if (resolved === "cellular-launch") {
    if (effectProfile?.id === "rubiks-solver") {
      return "rubiks-launch";
    }

    if (effectProfile?.id === "lights-beams") {
      return "lights-launch";
    }

    return resolved;
  }

  if (
    resolved === "cellular-life" ||
    resolved === "snake-grid" ||
    resolved === "particle-orbit" ||
    resolved === "donut-spin" ||
    resolved === "lights-beams" ||
    resolved === "rubiks-auto-solve"
  ) {
    if (effectProfile?.id === "snake-grid") {
      return "snake-grid";
    }

    if (effectProfile?.id === "particle-orbit") {
      return "particle-orbit";
    }

    if (effectProfile?.id === "donut-spin") {
      return "donut-spin";
    }

    if (effectProfile?.id === "lights-beams") {
      return "lights-beams";
    }

    if (effectProfile?.id === "rubiks-solver") {
      return "rubiks-auto-solve";
    }

    return "cellular-life";
  }
  return resolved;
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

export const getCellularLaunchOrigin = () => ({x: 0.5, y: 0.62});

type LifeCell = {
  x: number;
  y: number;
  age: number;
  tone: number;
};

type LifeCacheValue = {
  states: number[][][];
};

const lifeCache = new Map<string, LifeCacheValue>();

const hashNoise = (x: number, y: number, seed: number) => {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
};

const buildInitialLifeState = (
  cols: number,
  rows: number,
  seed: number,
  originX: number,
  originY: number,
) => {
  const state = Array.from({length: rows}, () => Array.from({length: cols}, () => 0));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const nx = x / Math.max(1, cols - 1);
      const ny = y / Math.max(1, rows - 1);
      const dx = nx - originX;
      const dy = ny - originY;
      const radial = Math.sqrt(dx * dx + dy * dy);
      const ring = Math.abs(radial - 0.09);
      const primary = radial < 0.11 ? 0.68 : 0.12;
      const secondary = ring < 0.03 ? 0.2 : 0;
      const noise = hashNoise(x, y, seed);
      state[y][x] = noise < primary + secondary ? 1 : 0;
    }
  }

  return state;
};

const countNeighbors = (grid: number[][], x: number, y: number) => {
  let total = 0;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const nextX = x + dx;
      const nextY = y + dy;
      const wrappedX = (nextX + cols) % cols;
      const wrappedY = (nextY + rows) % rows;
      total += grid[wrappedY][wrappedX];
    }
  }

  return total;
};

const stepLife = (grid: number[][]) => {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const next = Array.from({length: rows}, () => Array.from({length: cols}, () => 0));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const neighbors = countNeighbors(grid, x, y);
      const alive = grid[y][x] === 1;
      next[y][x] = alive ? (neighbors === 2 || neighbors === 3 ? 1 : 0) : neighbors === 3 ? 1 : 0;
    }
  }

  return next;
};

const cloneGrid = (grid: number[][]) => grid.map((row) => [...row]);

const getLifeStateAtStep = ({
  cols,
  rows,
  step,
  seed,
  originX,
  originY,
}: {
  cols: number;
  rows: number;
  step: number;
  seed: number;
  originX: number;
  originY: number;
}) => {
  const cacheKey = `${cols}x${rows}:${seed}:${originX.toFixed(3)}:${originY.toFixed(3)}`;
  let cacheValue = lifeCache.get(cacheKey);

  if (!cacheValue) {
    cacheValue = {
      states: [buildInitialLifeState(cols, rows, seed, originX, originY)],
    };
    lifeCache.set(cacheKey, cacheValue);
  }

  while (cacheValue.states.length <= step) {
    const previous = cacheValue.states[cacheValue.states.length - 1];
    cacheValue.states.push(stepLife(previous));
  }

  return cloneGrid(cacheValue.states[step]);
};

export const buildCellularLifeCells = ({
  cols,
  rows,
  globalFrame,
  activationFrame,
  seed,
  stepEveryFrames = 2,
}: {
  cols: number;
  rows: number;
  globalFrame: number;
  activationFrame: number;
  seed: number;
  stepEveryFrames?: number;
}): LifeCell[] => {
  if (globalFrame < activationFrame) {
    return [];
  }

  const steps = Math.max(0, Math.floor((globalFrame - activationFrame) / Math.max(1, stepEveryFrames)));
  const origin = getCellularLaunchOrigin();
  const state = getLifeStateAtStep({
    cols,
    rows,
    step: steps,
    seed,
    originX: origin.x,
    originY: origin.y,
  });

  const cells: LifeCell[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (state[y][x] === 0) {
        continue;
      }

      cells.push({
        x,
        y,
        age: (x + y + steps) % 5,
        tone: hashNoise(x, y, seed) > 0.56 ? 1 : 0,
      });
    }
  }

  return cells;
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
