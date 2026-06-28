type SnakeCellTone = "head" | "body" | "collision" | "food-low" | "food-mid" | "food-high";

type SnakeCell = {
  x: number;
  y: number;
  tone: SnakeCellTone;
};

type Point = {
  x: number;
  y: number;
};

type FoodItem = Point & {
  value: 1 | 2 | 4;
  tone: Extract<SnakeCellTone, "food-low" | "food-mid" | "food-high">;
};

type SnakeStrategy = "survival-chase" | "row-sweep" | "safe-loop";

type SnakeState = {
  snake: Point[];
  foods: FoodItem[];
  targetLength: number;
  spawnCursor: number;
};

type SnakeSimulationCache = {
  key: string;
  strategy: SnakeStrategy;
  cols: number;
  rows: number;
  seed: number;
  foodCount: number;
  frame: number;
  layout: LoopLayout;
  maxLength: number;
  state: SnakeState;
};

type LoopLayout = {
  order: Point[];
  indexByKey: Map<string, number>;
};

type MoveEvaluation = {
  nextHead: Point;
  areaScore: number;
  foodDistance: number;
  foodValue: number;
  tailDistance: number;
  tailReachable: boolean;
};

const simulationCache = new Map<string, SnakeSimulationCache>();

const DIRECTIONS: Point[] = [
  {x: 0, y: -1},
  {x: 1, y: 0},
  {x: 0, y: 1},
  {x: -1, y: 0},
];

const hashNoise = (value: number, seed: number) => {
  const result = Math.sin(value * 12.9898 + seed * 78.233) * 43758.5453;
  return result - Math.floor(result);
};

const pointKey = (point: Point) => `${point.x},${point.y}`;

const pointsEqual = (left: Point, right: Point) => left.x === right.x && left.y === right.y;

const modulo = (value: number, size: number) => ((value % size) + size) % size;
const loopDistance = (from: number, to: number, size: number) => modulo(to - from, size);

const clonePoint = (point: Point) => ({x: point.x, y: point.y});

const cloneState = (state: SnakeState): SnakeState => ({
  snake: state.snake.map(clonePoint),
  foods: state.foods.map((food) => ({...food})),
  targetLength: state.targetLength,
  spawnCursor: state.spawnCursor,
});

const buildSafeLoop = (cols: number, rows: number): LoopLayout => {
  const order: Point[] = [];

  for (let x = 0; x < cols; x += 1) {
    order.push({x, y: 0});
  }

  for (let y = 1; y < rows; y += 1) {
    if (y % 2 === 1) {
      for (let x = cols - 1; x >= 1; x -= 1) {
        order.push({x, y});
      }
      continue;
    }

    for (let x = 1; x < cols; x += 1) {
      order.push({x, y});
    }
  }

  for (let y = rows - 1; y >= 1; y -= 1) {
    order.push({x: 0, y});
  }

  return {
    order,
    indexByKey: new Map(order.map((point, index) => [pointKey(point), index])),
  };
};

const pickFoodProfile = (spawnCursor: number, seed: number): Pick<FoodItem, "value" | "tone"> => {
  const profileNoise = hashNoise(spawnCursor * 97 + 13, seed);
  if (profileNoise > 0.84) {
    return {value: 4, tone: "food-high"};
  }

  if (profileNoise > 0.5) {
    return {value: 2, tone: "food-mid"};
  }

  return {value: 1, tone: "food-low"};
};

const getFoodPriorityWeight = (food: Pick<FoodItem, "tone">) => {
  switch (food.tone) {
    case "food-high":
      return 1.36;
    case "food-mid":
      return 1.16;
    default:
      return 1;
  }
};

const getNeighbor = (point: Point, direction: Point, cols: number, rows: number): Point | null => {
  const next = {
    x: point.x + direction.x,
    y: point.y + direction.y,
  };

  if (next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows) {
    return null;
  }

  return next;
};

const buildDistanceField = ({
  start,
  cols,
  rows,
  blocked,
  allowTargetKey,
}: {
  start: Point;
  cols: number;
  rows: number;
  blocked: Set<string>;
  allowTargetKey?: string;
}) => {
  const queue: Point[] = [start];
  const distances = new Map<string, number>([[pointKey(start), 0]]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDistance = distances.get(pointKey(current)) ?? 0;

    for (const direction of DIRECTIONS) {
      const next = getNeighbor(current, direction, cols, rows);
      if (!next) {
        continue;
      }

      const key = pointKey(next);
      if (distances.has(key)) {
        continue;
      }

      if (blocked.has(key) && key !== allowTargetKey) {
        continue;
      }

      distances.set(key, currentDistance + 1);
      queue.push(next);
    }
  }

  return distances;
};

const buildShortestPath = ({
  start,
  target,
  cols,
  rows,
  blocked,
  allowTargetKey,
}: {
  start: Point;
  target: Point;
  cols: number;
  rows: number;
  blocked: Set<string>;
  allowTargetKey?: string;
}) => {
  const targetKey = pointKey(target);
  const queue: Point[] = [start];
  const visited = new Set<string>([pointKey(start)]);
  const previous = new Map<string, string>();
  const pointByKey = new Map<string, Point>([[pointKey(start), start]]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = pointKey(current);
    if (currentKey === targetKey) {
      break;
    }

    for (const direction of DIRECTIONS) {
      const next = getNeighbor(current, direction, cols, rows);
      if (!next) {
        continue;
      }

      const key = pointKey(next);
      if (visited.has(key)) {
        continue;
      }

      if (blocked.has(key) && key !== allowTargetKey) {
        continue;
      }

      visited.add(key);
      previous.set(key, currentKey);
      pointByKey.set(key, next);
      queue.push(next);
    }
  }

  if (!visited.has(targetKey)) {
    return null;
  }

  const path: Point[] = [];
  let cursor = targetKey;
  while (cursor !== pointKey(start)) {
    const point = pointByKey.get(cursor);
    if (!point) {
      break;
    }
    path.unshift(point);
    cursor = previous.get(cursor) ?? pointKey(start);
  }

  return path;
};

const simulatePath = ({
  snake,
  foods,
  path,
  maxLength,
}: {
  snake: Point[];
  foods: FoodItem[];
  path: Point[];
  maxLength: number;
}) => {
  const nextSnake = snake.map(clonePoint);
  const nextFoods = foods.map((food) => ({...food}));
  let targetLength = snake.length;

  for (const step of path) {
    const foodIndex = nextFoods.findIndex((food) => pointsEqual(food, step));
    nextSnake.unshift(clonePoint(step));

    if (foodIndex >= 0) {
      const food = nextFoods[foodIndex];
      nextFoods.splice(foodIndex, 1);
      targetLength = Math.min(maxLength, targetLength + (food?.value ?? 1));
    }

    while (nextSnake.length > targetLength) {
      nextSnake.pop();
    }
  }

  return {
    snake: nextSnake,
    foods: nextFoods,
    targetLength,
  };
};

const spawnFood = ({
  cols,
  rows,
  seed,
  spawnCursor,
  snake,
  existingFoods,
  layout,
  strategy,
}: {
  cols: number;
  rows: number;
  seed: number;
  spawnCursor: number;
  snake: Point[];
  existingFoods: FoodItem[];
  layout?: LoopLayout;
  strategy?: SnakeStrategy;
}) => {
  const occupied = new Set([...snake, ...existingFoods].map(pointKey));
  const capacity = cols * rows;

  const tryPreferredWindow = () => {
    if (!layout || strategy === "survival-chase" || snake.length === 0) {
      return null;
    }

    const cycleLength = layout.order.length;
    const headIndex = layout.indexByKey.get(pointKey(snake[0]!));
    const tailIndex = layout.indexByKey.get(pointKey(snake[snake.length - 1]!));
    if (headIndex === undefined || tailIndex === undefined) {
      return null;
    }

    const freeArc = Math.max(0, loopDistance(headIndex, tailIndex, cycleLength) - 1);
    if (freeArc < 6) {
      return null;
    }

    const windowStart = 2;
    const windowFactor = strategy === "safe-loop" ? 0.18 : 0.12;
    const windowSize = Math.max(4, Math.min(10, freeArc - 1, Math.floor(freeArc * windowFactor)));
    for (let attempt = 0; attempt < Math.max(windowSize * 2, 24); attempt += 1) {
      const offset =
        windowStart +
        (Math.floor(hashNoise(spawnCursor * 37 + attempt * 19 + 11, seed) * windowSize) % windowSize);
      const index = modulo(headIndex + offset, cycleLength);
      const candidate = layout.order[index];
      if (candidate && !occupied.has(pointKey(candidate))) {
        return {
          ...candidate,
          ...pickFoodProfile(spawnCursor + attempt, seed),
        } satisfies FoodItem;
      }
    }

    return null;
  };

  const preferredFood = tryPreferredWindow();
  if (preferredFood) {
    return preferredFood;
  }

  for (let attempt = 0; attempt < capacity; attempt += 1) {
    const x = Math.floor(hashNoise(spawnCursor * 37 + attempt * 11 + 7, seed) * cols) % cols;
    const y = Math.floor(hashNoise(spawnCursor * 53 + attempt * 17 + 19, seed) * rows) % rows;
    const candidate = {x, y};
    if (!occupied.has(pointKey(candidate))) {
      return {
        ...candidate,
        ...pickFoodProfile(spawnCursor + attempt, seed),
      } satisfies FoodItem;
    }
  }

  return null;
};

const refillFoods = ({
  state,
  cols,
  rows,
  seed,
  foodCount,
  layout,
  strategy,
}: {
  state: SnakeState;
  cols: number;
  rows: number;
  seed: number;
  foodCount: number;
  layout?: LoopLayout;
  strategy?: SnakeStrategy;
}) => {
  const freeCells = cols * rows - state.snake.length;
  const desiredFoodCount = Math.min(foodCount, Math.max(0, freeCells - 1));

  while (state.foods.length > desiredFoodCount) {
    state.foods.pop();
  }

  while (state.foods.length < desiredFoodCount) {
    const nextFood = spawnFood({
      cols,
      rows,
      seed,
      spawnCursor: state.spawnCursor,
      snake: state.snake,
      existingFoods: state.foods,
      layout,
      strategy,
    });

    if (!nextFood) {
      break;
    }

    state.foods.push(nextFood);
    state.spawnCursor += 1;
  }
};

const buildInitialState = ({
  cols,
  rows,
  seed,
  foodCount,
  layout,
  maxLength,
  strategy,
}: {
  cols: number;
  rows: number;
  seed: number;
  foodCount: number;
  layout: LoopLayout;
  maxLength: number;
  strategy: SnakeStrategy;
}) => {
  const startLength = Math.min(18, maxLength);
  const startIndex =
    strategy === "row-sweep"
      ? 0
      : Math.floor(hashNoise(seed * 13.1 + 7, seed + 11) * layout.order.length) % layout.order.length;
  const snake: Point[] = [];

  for (let index = 0; index < startLength; index += 1) {
    const point = layout.order[modulo(startIndex - index, layout.order.length)] ?? layout.order[0]!;
    snake.push(clonePoint(point));
  }

  const state: SnakeState = {
    snake,
    foods: [],
    targetLength: startLength,
    spawnCursor: 0,
  };

  refillFoods({
    state,
    cols,
    rows,
    seed,
    foodCount,
    layout,
    strategy,
  });

  return state;
};

const applySingleStep = ({
  state,
  nextHead,
  maxLength,
}: {
  state: SnakeState;
  nextHead: Point;
  maxLength: number;
}) => {
  state.snake.unshift(clonePoint(nextHead));
  const eatenFoodIndex = state.foods.findIndex((food) => pointsEqual(food, nextHead));
  if (eatenFoodIndex >= 0) {
    const eatenFood = state.foods[eatenFoodIndex];
    state.foods.splice(eatenFoodIndex, 1);
    state.targetLength = Math.min(maxLength, state.targetLength + (eatenFood?.value ?? 1));
  }

  while (state.snake.length > state.targetLength) {
    state.snake.pop();
  }
};

const pickSafeFoodPath = ({
  state,
  cols,
  rows,
  maxLength,
}: {
  state: SnakeState;
  cols: number;
  rows: number;
  maxLength: number;
}) => {
  const head = state.snake[0]!;
  const bodyBlocked = new Set(state.snake.slice(0, -1).map(pointKey));
  const tail = state.snake[state.snake.length - 1]!;
  const tailKey = pointKey(tail);
  let bestPath: Point[] | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  const occupancyRatio = state.snake.length / Math.max(1, cols * rows);

  for (const food of state.foods) {
    const foodPath = buildShortestPath({
      start: head,
      target: food,
      cols,
      rows,
      blocked: bodyBlocked,
      allowTargetKey: tailKey,
    });

    if (!foodPath || foodPath.length === 0) {
      continue;
    }

    const simulated = simulatePath({
      snake: state.snake,
      foods: state.foods,
      path: foodPath,
      maxLength,
    });
    const nextHead = simulated.snake[0]!;
    const nextTail = simulated.snake[simulated.snake.length - 1]!;
    const nextBlocked = new Set(simulated.snake.slice(0, -1).map(pointKey));
    const tailDistances = buildDistanceField({
      start: nextHead,
      cols,
      rows,
      blocked: nextBlocked,
      allowTargetKey: pointKey(nextTail),
    });
    const tailDistance = tailDistances.get(pointKey(nextTail));
    if (tailDistance === undefined) {
      continue;
    }

    const maxChaseDistance =
      occupancyRatio > 0.4 ? 2 : occupancyRatio > 0.3 ? 3 : occupancyRatio > 0.2 ? 5 : 9;
    if (foodPath.length > maxChaseDistance) {
      continue;
    }

    const reserveCells =
      occupancyRatio > 0.38 ? 10 : occupancyRatio > 0.28 ? 8 : occupancyRatio > 0.18 ? 7 : 6;
    const safeAreaFloor = Math.min(cols * rows - 1, simulated.snake.length + reserveCells);
    if (tailDistances.size < safeAreaFloor) {
      continue;
    }

    /**
     * Survival stays the top priority. We only take a food route if we can still
     * reach the tail after the whole chase, which keeps an escape corridor alive
     * instead of greedily sealing the snake into its own body.
     */
    const preference = getFoodPriorityWeight(food);
    const score =
      preference * 62 -
      foodPath.length * 26 +
      tailDistances.size * 0.18 -
      tailDistance * 0.72;
    if (score > bestScore) {
      bestScore = score;
      bestPath = foodPath;
    }
  }

  return bestPath;
};

const evaluateFallbackMoves = ({
  state,
  cols,
  rows,
}: {
  state: SnakeState;
  cols: number;
  rows: number;
}) => {
  const head = state.snake[0]!;
  const currentTail = state.snake[state.snake.length - 1]!;
  const currentTailKey = pointKey(currentTail);
  const blocked = new Set(state.snake.slice(0, -1).map(pointKey));
  const evaluations: MoveEvaluation[] = [];

  for (const direction of DIRECTIONS) {
    const next = getNeighbor(head, direction, cols, rows);
    if (!next) {
      continue;
    }

    const key = pointKey(next);
    if (blocked.has(key) && key !== currentTailKey) {
      continue;
    }

    const food = state.foods.find((item) => pointsEqual(item, next));
    const nextSnake = [next, ...state.snake];
    let nextLength = state.snake.length;
    if (food) {
      nextLength += food.value;
    }
    while (nextSnake.length > nextLength) {
      nextSnake.pop();
    }

    const nextTail = nextSnake[nextSnake.length - 1]!;
    const nextBlocked = new Set(nextSnake.slice(0, -1).map(pointKey));
    const distances = buildDistanceField({
      start: next,
      cols,
      rows,
      blocked: nextBlocked,
      allowTargetKey: pointKey(nextTail),
    });
    const tailDistance = distances.get(pointKey(nextTail));
    let bestFoodDistance = Number.POSITIVE_INFINITY;
    let bestFoodValue = 0;

    state.foods.forEach((candidate) => {
      if (pointsEqual(candidate, next)) {
        return;
      }
      const distance = distances.get(pointKey(candidate));
      if (distance === undefined) {
        return;
      }
      const candidatePriority = getFoodPriorityWeight(candidate);
      if (
        distance < bestFoodDistance ||
        (distance === bestFoodDistance && candidatePriority > bestFoodValue)
      ) {
        bestFoodDistance = distance;
        bestFoodValue = candidatePriority;
      }
    });

    const immediatePriority = food ? getFoodPriorityWeight(food) : 0;

    evaluations.push({
      nextHead: next,
      areaScore: distances.size,
      foodDistance: Number.isFinite(bestFoodDistance) ? bestFoodDistance : 9999,
      foodValue: bestFoodValue + immediatePriority,
      tailDistance: tailDistance ?? Number.POSITIVE_INFINITY,
      tailReachable: tailDistance !== undefined,
    });
  }

  evaluations.sort((left, right) => {
    if (left.tailReachable !== right.tailReachable) {
      return left.tailReachable ? -1 : 1;
    }
    if (left.areaScore !== right.areaScore) {
      return right.areaScore - left.areaScore;
    }
    if (left.foodValue !== right.foodValue) {
      return right.foodValue - left.foodValue;
    }
    if (left.foodDistance !== right.foodDistance) {
      return left.foodDistance - right.foodDistance;
    }
    return left.tailDistance - right.tailDistance;
  });

  return evaluations[0]?.nextHead ?? head;
};

const chooseSurvivalChaseMove = ({
  state,
  cols,
  rows,
  layout,
  maxLength,
}: {
  state: SnakeState;
  cols: number;
  rows: number;
  layout: LoopLayout;
  maxLength: number;
}) => {
  const occupancyRatio = state.snake.length / Math.max(1, cols * rows);
  if (occupancyRatio >= 0.02) {
    return chooseRowSweepMove({
      state,
      layout,
    });
  }

  const safeFoodPath = pickSafeFoodPath({
    state,
    cols,
    rows,
    maxLength,
  });
  const head = state.snake[0]!;
  const tail = state.snake[state.snake.length - 1]!;
  const bodyBlocked = new Set(state.snake.slice(0, -1).map(pointKey));
  const tailPath = buildShortestPath({
    start: head,
    target: tail,
    cols,
    rows,
    blocked: bodyBlocked,
    allowTargetKey: pointKey(tail),
  });
  const shouldFavorTail = occupancyRatio >= 0.24;
  const foodCommitDistance =
    occupancyRatio >= 0.34 ? 2 : occupancyRatio >= 0.24 ? 3 : occupancyRatio >= 0.16 ? 5 : 8;

  if (safeFoodPath && safeFoodPath.length > 0) {
    if (!shouldFavorTail || safeFoodPath.length <= foodCommitDistance) {
      return safeFoodPath[0]!;
    }
  }

  if (tailPath && tailPath.length > 0) {
    if (
      safeFoodPath &&
      safeFoodPath.length > 0 &&
      safeFoodPath.length <= Math.max(foodCommitDistance, tailPath.length - 2)
    ) {
      return safeFoodPath[0]!;
    }
    return tailPath[0]!;
  }

  if (safeFoodPath && safeFoodPath.length > 0) {
    return safeFoodPath[0]!;
  }

  return evaluateFallbackMoves({
    state,
    cols,
    rows,
  });
};

const chooseRowSweepMove = ({
  state,
  layout,
}: {
  state: SnakeState;
  layout: LoopLayout;
}) => {
  return chooseSafeLoopMove({state, layout});
};

const chooseSafeLoopMove = ({
  state,
  layout,
}: {
  state: SnakeState;
  layout: LoopLayout;
}) => {
  const head = state.snake[0]!;
  const loopIndex = layout.indexByKey.get(pointKey(head)) ?? 0;
  return clonePoint(layout.order[modulo(loopIndex + 1, layout.order.length)] ?? layout.order[0]!);
};

const advanceSimulation = ({
  cache,
  targetFrame,
  cols,
  rows,
  seed,
  foodCount,
}: {
  cache: SnakeSimulationCache;
  targetFrame: number;
  cols: number;
  rows: number;
  seed: number;
  foodCount: number;
}) => {
  while (cache.frame < targetFrame) {
    const nextHead =
      cache.strategy === "safe-loop"
        ? chooseSafeLoopMove({state: cache.state, layout: cache.layout})
        : cache.strategy === "row-sweep"
          ? chooseRowSweepMove({
              state: cache.state,
              layout: cache.layout,
            })
          : chooseSurvivalChaseMove({
              state: cache.state,
              cols,
              rows,
              layout: cache.layout,
              maxLength: cache.maxLength,
            });

    applySingleStep({
      state: cache.state,
      nextHead,
      maxLength: cache.maxLength,
    });
    refillFoods({
      state: cache.state,
      cols,
      rows,
      seed,
      foodCount,
      layout: cache.layout,
      strategy: cache.strategy,
    });
    cache.frame += 1;
  }
};

export const buildSnakeGridCells = ({
  cols,
  rows,
  frame,
  seed,
  foodCount,
  strategy = "row-sweep",
}: {
  cols: number;
  rows: number;
  frame: number;
  seed: number;
  foodCount: number;
  strategy?: SnakeStrategy;
}) => {
  const resolvedStrategy = strategy ?? "row-sweep";
  const resolvedFrame = Math.max(0, Math.floor(frame));
  const cacheKey = `${resolvedStrategy}:${cols}:${rows}:${seed}:${foodCount}`;
  let cache = simulationCache.get(cacheKey);

  if (!cache || resolvedFrame < cache.frame) {
    const layout = buildSafeLoop(cols, rows);
    const maxLength =
      resolvedStrategy === "safe-loop"
        ? Math.max(16, layout.order.length - 1)
        : Math.max(16, cols * rows - 1);
    cache = {
      key: cacheKey,
      strategy: resolvedStrategy,
      cols,
      rows,
      seed,
      foodCount,
      frame: 0,
      layout,
      maxLength,
      state: buildInitialState({
        cols,
        rows,
        seed,
        foodCount,
        layout,
        maxLength,
        strategy: resolvedStrategy,
      }),
    };
    simulationCache.set(cacheKey, cache);
  }

  advanceSimulation({
    cache,
    targetFrame: resolvedFrame,
    cols,
    rows,
    seed,
    foodCount,
  });
  const state = cloneState(cache.state);

  const cells: SnakeCell[] = state.snake.map((cell, index) => ({
    x: cell.x,
    y: cell.y,
    tone: index === 0 ? "head" : "body",
  }));

  const occupancy = new Map<string, number>();
  cells.forEach((cell) => {
    if (cell.tone === "body" || cell.tone === "head") {
      const key = pointKey(cell);
      occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
    }
  });

  cells.forEach((cell) => {
    if ((cell.tone === "body" || cell.tone === "head") && (occupancy.get(pointKey(cell)) ?? 0) > 1) {
      cell.tone = "collision";
    }
  });

  state.foods.forEach((food) => {
    cells.push({
      x: food.x,
      y: food.y,
      tone: food.tone,
    });
  });

  return cells;
};
