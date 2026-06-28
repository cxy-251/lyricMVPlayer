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

export const getCellularLaunchOrigin = () => ({x: 0.5, y: 0.62});

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
