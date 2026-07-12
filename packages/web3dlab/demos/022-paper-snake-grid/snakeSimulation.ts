export type SnakeCellTone =
  | 'body-a'
  | 'body-b'
  | 'body-c'
  | 'food'
  | 'head'
  | 'obstacle'
  | 'overlap'
  | 'tail';

export type SnakeCell = {
  tone: SnakeCellTone;
  x: number;
  y: number;
};

export type SnakeRouteMode = 'complete' | 'cycle-guard' | 'safe-detour' | 'safe-shortcut' | 'tail-guard';

export type SnakeSnapshot = {
  capacity: number;
  cells: SnakeCell[];
  complete: boolean;
  foodCount: number;
  length: number;
  mode: SnakeRouteMode;
  obstacleCount: number;
  steps: number;
};

type Point = {
  x: number;
  y: number;
};

type LoopLayout = {
  indexByKey: Map<string, number>;
  order: Point[];
};

type SnakeState = {
  complete: boolean;
  foods: Point[];
  mode: SnakeRouteMode;
  obstacles: Point[];
  snake: Point[];
  spawnCursor: number;
  steps: number;
};

type SimulationCache = {
  frame: number;
  key: string;
  layout: LoopLayout;
  state: SnakeState;
};

type PlannedMove = {
  eating: boolean;
  mode: SnakeRouteMode;
  point: Point;
};

const simulationCache = new Map<string, SimulationCache>();
const MAX_CACHE_ENTRIES = 12;
const resolveBoardSize = (size: number) => Math.max(6, Math.round(size / 2) * 2);

const DIRECTIONS: Point[] = [
  {x: 1, y: 0},
  {x: 0, y: 1},
  {x: -1, y: 0},
  {x: 0, y: -1},
];

const pointKey = ({x, y}: Point) => `${x},${y}`;
const clonePoint = ({x, y}: Point): Point => ({x, y});
const pointsEqual = (left: Point, right: Point) => left.x === right.x && left.y === right.y;
const modulo = (value: number, size: number) => ((value % size) + size) % size;
const loopDistance = (from: number, to: number, size: number) => modulo(to - from, size);
const manhattanDistance = (left: Point, right: Point) =>
  Math.abs(left.x - right.x) + Math.abs(left.y - right.y);

const hashNoise = (value: number, seed: number) => {
  const result = Math.sin(value * 12.9898 + seed * 78.233) * 43758.5453;
  return result - Math.floor(result);
};

const getNeighbors = (point: Point, size: number) =>
  DIRECTIONS.map((direction) => ({x: point.x + direction.x, y: point.y + direction.y}))
    .filter((candidate) =>
      candidate.x >= 0 && candidate.x < size && candidate.y >= 0 && candidate.y < size);

const buildHamiltonianLoop = (size: number): LoopLayout => {
  const order: Point[] = [];
  for (let x = 0; x < size; x += 1) order.push({x, y: 0});
  for (let y = 1; y < size; y += 1) {
    if (y % 2 === 1) {
      for (let x = size - 1; x >= 1; x -= 1) order.push({x, y});
    } else {
      for (let x = 1; x < size; x += 1) order.push({x, y});
    }
  }
  for (let y = size - 1; y >= 1; y -= 1) order.push({x: 0, y});
  return {
    order,
    indexByKey: new Map(order.map((point, index) => [pointKey(point), index])),
  };
};

const buildShortestPath = ({
  blocked,
  size,
  start,
  target,
}: {
  blocked: Set<string>;
  size: number;
  start: Point;
  target: Point;
}) => {
  const startKey = pointKey(start);
  const targetKey = pointKey(target);
  const queue = [start];
  const visited = new Set([startKey]);
  const previous = new Map<string, string>();
  const points = new Map<string, Point>([[startKey, start]]);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;
    if (pointsEqual(current, target)) break;
    for (const neighbor of getNeighbors(current, size)) {
      const key = pointKey(neighbor);
      if (visited.has(key) || (blocked.has(key) && key !== targetKey)) continue;
      visited.add(key);
      previous.set(key, pointKey(current));
      points.set(key, neighbor);
      queue.push(neighbor);
    }
  }
  if (!visited.has(targetKey)) return null;

  const path: Point[] = [];
  let cursor = targetKey;
  while (cursor !== startKey) {
    const point = points.get(cursor);
    if (!point) return null;
    path.unshift(clonePoint(point));
    cursor = previous.get(cursor) ?? startKey;
  }
  return path;
};

const getReachableArea = ({blocked, size, start}: {blocked: Set<string>; size: number; start: Point}) => {
  const queue = [start];
  const visited = new Set([pointKey(start)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const neighbor of getNeighbors(queue[cursor]!, size)) {
      const key = pointKey(neighbor);
      if (visited.has(key) || blocked.has(key)) continue;
      visited.add(key);
      queue.push(neighbor);
    }
  }
  return visited.size;
};

const spawnFood = ({
  layout,
  seed,
  state,
}: {
  layout: LoopLayout;
  seed: number;
  state: SnakeState;
}) => {
  const occupied = new Set([
    ...state.snake.map(pointKey),
    ...state.foods.map(pointKey),
    ...state.obstacles.map(pointKey),
  ]);
  const freeCells = layout.order.filter((point) => !occupied.has(pointKey(point)));
  if (freeCells.length === 0) return null;

  const headIndex = layout.indexByKey.get(pointKey(state.snake[0]!))!;
  const windowSize = Math.min(layout.order.length - 1, Math.max(8, Math.round(Math.sqrt(layout.order.length) * 2.5)));
  const windowStart = 3 + Math.floor(hashNoise(state.spawnCursor * 43 + 17, seed) * Math.max(1, windowSize - 2));
  for (let attempt = 0; attempt < windowSize; attempt += 1) {
    const offset = 3 + modulo(windowStart - 3 + attempt, Math.max(1, windowSize - 2));
    const candidate = layout.order[modulo(headIndex + offset, layout.order.length)]!;
    if (!occupied.has(pointKey(candidate))) return clonePoint(candidate);
  }

  const index = Math.floor(hashNoise(state.spawnCursor * 71 + freeCells.length * 13, seed) * freeCells.length);
  return clonePoint(freeCells[Math.min(index, freeCells.length - 1)]!);
};

const buildInitialState = (layout: LoopLayout, seed: number): SnakeState => {
  const capacity = layout.order.length;
  const startIndex = Math.floor(hashNoise(seed * 17 + 5, seed + 23) * capacity);
  const snake = Array.from({length: Math.min(5, capacity)}, (_, index) =>
    clonePoint(layout.order[modulo(startIndex - index, capacity)]!));
  const state: SnakeState = {
    complete: false,
    foods: [],
    mode: 'cycle-guard',
    obstacles: [],
    snake,
    spawnCursor: 0,
    steps: 0,
  };
  const food = spawnFood({layout, seed, state});
  if (food) state.foods.push(food);
  state.spawnCursor = 1;
  return state;
};

const simulatePath = ({path, state}: {path: Point[]; state: SnakeState}) => {
  const snake = state.snake.map(clonePoint);
  const foods = state.foods.map(clonePoint);
  const obstacles = new Set(state.obstacles.map(pointKey));

  for (const step of path) {
    if (obstacles.has(pointKey(step))) return null;
    const foodIndex = foods.findIndex((food) => pointsEqual(food, step));
    const eating = foodIndex >= 0;
    const tail = snake[snake.length - 1]!;
    const occupied = new Set(snake.map(pointKey));
    if (occupied.has(pointKey(step)) && !(pointsEqual(step, tail) && !eating)) return null;
    snake.unshift(clonePoint(step));
    if (eating) foods.splice(foodIndex, 1);
    else snake.pop();
  }

  return {foods, snake};
};

const canReachTail = ({
  obstacles,
  size,
  snake,
}: {
  obstacles: Point[];
  size: number;
  snake: Point[];
}) => {
  if (snake.length <= 2) return true;
  const head = snake[0]!;
  const tail = snake[snake.length - 1]!;
  const blocked = new Set([...obstacles.map(pointKey), ...snake.slice(1, -1).map(pointKey)]);
  return buildShortestPath({blocked, size, start: head, target: tail}) !== null;
};

const chooseSafeFoodMove = ({size, state}: {size: number; state: SnakeState}): PlannedMove | null => {
  const head = state.snake[0]!;
  const tail = state.snake[state.snake.length - 1]!;
  const blocked = new Set([
    ...state.obstacles.map(pointKey),
    ...state.snake.slice(0, -1).map(pointKey),
  ]);
  blocked.delete(pointKey(head));
  blocked.delete(pointKey(tail));

  const candidates = state.foods
    .map((food) => ({food, path: buildShortestPath({blocked, size, start: head, target: food})}))
    .filter((candidate): candidate is {food: Point; path: Point[]} => Boolean(candidate.path?.length))
    .sort((left, right) => left.path.length - right.path.length);

  for (const candidate of candidates) {
    const simulated = simulatePath({path: candidate.path, state});
    if (!simulated) continue;
    const capacity = size * size - state.obstacles.length;
    if (simulated.snake.length >= capacity || canReachTail({obstacles: state.obstacles, size, snake: simulated.snake})) {
      return {eating: candidate.path.length === 1, mode: 'safe-shortcut', point: candidate.path[0]!};
    }
  }
  return null;
};

const chooseTailGuardMove = ({size, state}: {size: number; state: SnakeState}): PlannedMove | null => {
  const head = state.snake[0]!;
  const tail = state.snake[state.snake.length - 1]!;
  const blocked = new Set([
    ...state.obstacles.map(pointKey),
    ...state.snake.slice(0, -1).map(pointKey),
  ]);
  blocked.delete(pointKey(head));
  blocked.delete(pointKey(tail));
  const tailPath = buildShortestPath({blocked, size, start: head, target: tail});
  const next = tailPath?.[0];
  if (!next) return null;
  return {
    eating: state.foods.some((food) => pointsEqual(food, next)),
    mode: 'tail-guard',
    point: next,
  };
};

const chooseOpenAreaMove = ({size, state}: {size: number; state: SnakeState}): PlannedMove | null => {
  const head = state.snake[0]!;
  const tail = state.snake[state.snake.length - 1]!;
  const occupied = new Set(state.snake.map(pointKey));
  const obstacleKeys = new Set(state.obstacles.map(pointKey));
  const candidates: Array<{eating: boolean; point: Point; score: number}> = [];

  for (const point of getNeighbors(head, size)) {
    if (obstacleKeys.has(pointKey(point))) continue;
    const eating = state.foods.some((food) => pointsEqual(food, point));
    if (occupied.has(pointKey(point)) && !(pointsEqual(point, tail) && !eating)) continue;
    const simulated = simulatePath({path: [point], state});
    if (!simulated) continue;
    const blocked = new Set([
      ...state.obstacles.map(pointKey),
      ...simulated.snake.slice(1, -1).map(pointKey),
    ]);
    const area = getReachableArea({blocked, size, start: point});
    const foodDistance = simulated.foods.length === 0
      ? 0
      : Math.min(...simulated.foods.map((food) =>
        buildShortestPath({blocked, size, start: point, target: food})?.length
          ?? manhattanDistance(point, food) + size * size));
    const tailSafe = canReachTail({obstacles: state.obstacles, size, snake: simulated.snake});
    const nextTail = simulated.snake[simulated.snake.length - 1]!;
    const tailDistance = buildShortestPath({blocked, size, start: point, target: nextTail})?.length ?? 0;
    candidates.push({
      eating,
      point,
      score:
        (tailSafe ? 100_000 : 0)
        + (eating ? 10_000 : 0)
        + area * 4
        - foodDistance * 24
        + Math.min(tailDistance, size * 2) * 1.5,
    });
  }
  candidates.sort((left, right) => right.score - left.score);
  const best = candidates[0];
  return best ? {eating: best.eating, mode: 'safe-detour', point: best.point} : null;
};

const isCycleOrdered = (snake: Point[], layout: LoopLayout) => {
  const tailIndex = layout.indexByKey.get(pointKey(snake[snake.length - 1]!))!;
  let previousDistance = -1;
  for (let index = snake.length - 1; index >= 0; index -= 1) {
    const cycleIndex = layout.indexByKey.get(pointKey(snake[index]!))!;
    const distance = loopDistance(tailIndex, cycleIndex, layout.order.length);
    if (distance <= previousDistance) return false;
    previousDistance = distance;
  }
  return true;
};

const chooseCycleMove = ({layout, state}: {layout: LoopLayout; state: SnakeState}): PlannedMove | null => {
  if (state.obstacles.length > 0 || !isCycleOrdered(state.snake, layout)) return null;
  const head = state.snake[0]!;
  const tail = state.snake[state.snake.length - 1]!;
  const headIndex = layout.indexByKey.get(pointKey(head))!;
  const next = layout.order[modulo(headIndex + 1, layout.order.length)]!;
  const eating = state.foods.some((food) => pointsEqual(food, next));
  const occupied = state.snake.some((point) => pointsEqual(point, next));
  if (occupied && !(pointsEqual(next, tail) && !eating)) return null;
  return {eating, mode: 'cycle-guard', point: next};
};

const chooseOrderedFoodMove = ({
  layout,
  size,
  state,
}: {
  layout: LoopLayout;
  size: number;
  state: SnakeState;
}): PlannedMove | null => {
  if (state.obstacles.length > 0 || !isCycleOrdered(state.snake, layout)) return null;
  const head = state.snake[0]!;
  const tail = state.snake[state.snake.length - 1]!;
  const blocked = new Set(state.snake.slice(0, -1).map(pointKey));
  blocked.delete(pointKey(head));
  blocked.delete(pointKey(tail));
  const safePaths = state.foods
    .map((food) => buildShortestPath({blocked, size, start: head, target: food}))
    .filter((path): path is Point[] => Boolean(path?.length))
    .filter((path) => {
      const simulated = simulatePath({path, state});
      return Boolean(simulated && isCycleOrdered(simulated.snake, layout));
    })
    .sort((left, right) => left.length - right.length);
  const bestPath = safePaths[0];
  if (!bestPath) return chooseCycleMove({layout, state});
  const point = bestPath[0]!;
  const headIndex = layout.indexByKey.get(pointKey(head))!;
  const pointIndex = layout.indexByKey.get(pointKey(point))!;
  return {
    eating: state.foods.some((food) => pointsEqual(food, point)),
    mode: loopDistance(headIndex, pointIndex, layout.order.length) === 1 ? 'cycle-guard' : 'safe-shortcut',
    point,
  };
};

const chooseMove = ({layout, size, state}: {layout: LoopLayout; size: number; state: SnakeState}) => {
  const orderedMove = chooseOrderedFoodMove({layout, size, state});
  if (orderedMove) return orderedMove;
  const foodMove = chooseSafeFoodMove({size, state});
  if (foodMove) return foodMove;
  if (state.obstacles.length > 0) {
    const adaptiveMove = chooseOpenAreaMove({size, state});
    if (adaptiveMove) return adaptiveMove;
  }
  const occupancy = state.snake.length / Math.max(1, size * size - state.obstacles.length);
  if (occupancy >= 0.45) {
    const cycleMove = chooseCycleMove({layout, state});
    if (cycleMove) return cycleMove;
  }
  return chooseTailGuardMove({size, state})
    ?? chooseCycleMove({layout, state})
    ?? chooseOpenAreaMove({size, state});
};

const advanceOneStep = ({layout, seed, size, state}: {
  layout: LoopLayout;
  seed: number;
  size: number;
  state: SnakeState;
}) => {
  if (state.complete) return;
  const move = chooseMove({layout, size, state});
  if (!move) {
    state.mode = 'tail-guard';
    return;
  }

  const foodIndex = state.foods.findIndex((food) => pointsEqual(food, move.point));
  const eating = foodIndex >= 0;
  state.snake.unshift(clonePoint(move.point));
  if (eating) state.foods.splice(foodIndex, 1);
  else state.snake.pop();
  state.steps += 1;
  state.mode = move.mode;

  const capacity = size * size - state.obstacles.length;
  if (state.snake.length >= capacity) {
    state.complete = true;
    state.foods = [];
    state.mode = 'complete';
    return;
  }

  if (state.foods.length === 0) {
    const food = spawnFood({layout, seed, state});
    if (food) state.foods.push(food);
    state.spawnCursor += 1;
  }
};

const cloneSnapshot = (state: SnakeState, boardCells: number): SnakeSnapshot => {
  const occupancy = new Map<string, number>();
  state.snake.forEach((point) => occupancy.set(pointKey(point), (occupancy.get(pointKey(point)) ?? 0) + 1));
  return {
    capacity: boardCells - state.obstacles.length,
    cells: [
      ...state.snake.map((point, index) => ({
        ...clonePoint(point),
        tone: (occupancy.get(pointKey(point)) ?? 0) > 1
          ? 'overlap'
          : index === 0
            ? 'head'
            : index === state.snake.length - 1
              ? 'tail'
            : index % 3 === 0
              ? 'body-a'
              : index % 3 === 1
                ? 'body-b'
                : 'body-c',
      } satisfies SnakeCell)),
      ...state.foods.map((food) => ({...clonePoint(food), tone: 'food' as const})),
      ...state.obstacles.map((obstacle) => ({...clonePoint(obstacle), tone: 'obstacle' as const})),
    ],
    complete: state.complete,
    foodCount: state.foods.length,
    length: state.snake.length,
    mode: state.mode,
    obstacleCount: state.obstacles.length,
    steps: state.steps,
  };
};

const getOrCreateCache = (size: number, seed: number) => {
  const boardSize = resolveBoardSize(size);
  const key = `${boardSize}:${seed}`;
  let cache = simulationCache.get(key);
  if (!cache) {
    const layout = buildHamiltonianLoop(boardSize);
    cache = {frame: 0, key, layout, state: buildInitialState(layout, seed)};
    simulationCache.set(key, cache);
    while (simulationCache.size > MAX_CACHE_ENTRIES) {
      simulationCache.delete(simulationCache.keys().next().value!);
    }
  }
  return {boardSize, cache};
};

export const getSnakeSnapshot = ({frame, seed, size}: {frame: number; seed: number; size: number}) => {
  const targetFrame = Math.max(0, Math.floor(frame));
  let {boardSize, cache} = getOrCreateCache(size, seed);
  if (targetFrame < cache.frame) {
    simulationCache.delete(cache.key);
    ({boardSize, cache} = getOrCreateCache(size, seed));
  }
  while (cache.frame < targetFrame && !cache.state.complete) {
    advanceOneStep({layout: cache.layout, seed, size: boardSize, state: cache.state});
    cache.frame += 1;
  }
  if (cache.state.complete) cache.frame = targetFrame;
  return cloneSnapshot(cache.state, boardSize * boardSize);
};

const boardRemainsConnected = ({obstacles, size, start}: {obstacles: Point[]; size: number; start: Point}) => {
  const blocked = new Set(obstacles.map(pointKey));
  const reachable = getReachableArea({blocked, size, start});
  return reachable === size * size - obstacles.length;
};

export const cycleSnakeBoardCell = ({seed, size, x, y}: {
  seed: number;
  size: number;
  x: number;
  y: number;
}) => {
  const {boardSize, cache} = getOrCreateCache(size, seed);
  if (cache.state.complete) return false;
  const point = {x: Math.floor(x), y: Math.floor(y)};
  if (point.x < 0 || point.x >= boardSize || point.y < 0 || point.y >= boardSize) return false;
  if (cache.state.snake.some((cell) => pointsEqual(cell, point))) return false;

  const obstacleIndex = cache.state.obstacles.findIndex((cell) => pointsEqual(cell, point));
  if (obstacleIndex >= 0) {
    cache.state.obstacles.splice(obstacleIndex, 1);
    cache.state.complete = false;
    return true;
  }

  const foodIndex = cache.state.foods.findIndex((cell) => pointsEqual(cell, point));
  if (foodIndex >= 0) {
    const nextObstacles = [...cache.state.obstacles, point];
    const remainingCapacity = boardSize * boardSize - nextObstacles.length;
    if (remainingCapacity <= cache.state.snake.length) return false;
    if (!boardRemainsConnected({obstacles: nextObstacles, size: boardSize, start: cache.state.snake[0]!})) return false;
    cache.state.foods.splice(foodIndex, 1);
    cache.state.obstacles.push(point);
    if (cache.state.foods.length === 0) {
      const replacement = spawnFood({layout: cache.layout, seed, state: cache.state});
      if (replacement) cache.state.foods.push(replacement);
      cache.state.spawnCursor += 1;
    }
    return true;
  }

  cache.state.foods.push(point);
  return true;
};
