import type {KPattern} from 'cubing/kpuzzle';
import {puzzles} from 'cubing/puzzles';
import {
  experimentalSolve2x2x2,
  experimentalSolve3x3x3IgnoringCenters,
} from 'cubing/search';

import type {RubiksDimension} from './rubiks-cube.types';

export type RubiksPuzzleSolver<State> = {
  applyMove: (state: State, notation: string) => State;
  createSolvedState: () => Promise<State>;
  scrambleMoveCount: number;
  solve: (state: State, facelets?: string, moveFamilies?: RubiksMoveFamily[]) => Promise<string>;
};

export type RubiksSolverState = {
  nativePattern: KPattern | null;
};

type HighOrderDimension = 4 | 5 | 6;
export type RubiksMoveFamily = {
  axis: 'x' | 'y' | 'z';
  layer: number;
};
type BackendSolveResponse = {
  dimension?: number;
  error?: string;
  moves?: string[];
  ok?: boolean;
  solver?: string;
};

export class RubiksBackendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RubiksBackendError';
  }
}

const EXPECTED_BACKEND_SOLVERS: Record<HighOrderDimension, string> = {
  4: 'HybridStateReduction444',
  5: 'HybridStateReduction555',
  6: 'HybridStateReduction666',
};
const solverCache = new Map<RubiksDimension, RubiksPuzzleSolver<RubiksSolverState>>();
let backendStartup: Promise<void> | null = null;

const prepareRubiksSolverBackend = () => {
  if (backendStartup) return backendStartup;
  backendStartup = fetch('/api/web3dlab/rubiks/start', {method: 'POST'})
    .then(async (response) => {
      if (response.ok) return;
      const payload = await response.json().catch(() => ({})) as {error?: string};
      throw new RubiksBackendError(payload.error || '高阶求解服务启动失败');
    })
    .catch((error) => {
      backendStartup = null;
      if (error instanceof RubiksBackendError) throw error;
      throw new RubiksBackendError('高阶求解服务启动失败');
    });
  return backendStartup;
};

export const releaseRubiksSolverBackend = () => {
  backendStartup = null;
  void fetch('/api/web3dlab/rubiks/stop', {
    keepalive: true,
    method: 'POST',
  }).catch(() => undefined);
};

const getScrambleMoveCount = (dimension: RubiksDimension) => {
  if (dimension === 2) return 11;
  if (dimension === 3) return 20;
  if (dimension === 4) return 32;
  if (dimension === 5) return 44;
  return 56;
};

const solveHighOrderState = async (
  dimension: HighOrderDimension,
  facelets?: string,
  moveFamilies?: RubiksMoveFamily[],
) => {
  if (!facelets) {
    throw new RubiksBackendError(`缺少 ${dimension} 阶魔方贴纸状态`);
  }

  let response: Response;
  try {
    await prepareRubiksSolverBackend();
    response = await fetch('/api/web3dlab/rubiks/solve', {
      body: JSON.stringify({dimension, moveFamilies, state: facelets}),
      headers: {'Content-Type': 'application/json'},
      method: 'POST',
    });
  } catch {
    throw new RubiksBackendError('高阶求解服务未启动');
  }

  const payload = await response.json() as BackendSolveResponse;
  if (!response.ok || !payload.ok) {
    throw new RubiksBackendError(payload.error || `高阶求解服务返回 ${response.status}`);
  }
  if (payload.dimension !== dimension || payload.solver !== EXPECTED_BACKEND_SOLVERS[dimension]) {
    throw new RubiksBackendError(`${dimension} 阶求解器响应不匹配`);
  }
  if (!Array.isArray(payload.moves)) {
    throw new RubiksBackendError(`${dimension} 阶求解器未返回步骤`);
  }
  return payload.moves.join(' ');
};

const createHighOrderSolver = (dimension: HighOrderDimension): RubiksPuzzleSolver<RubiksSolverState> => ({
  scrambleMoveCount: getScrambleMoveCount(dimension),
  createSolvedState: async () => ({nativePattern: null}),
  applyMove: (state) => state,
  solve: async (_state, facelets, moveFamilies) => solveHighOrderState(dimension, facelets, moveFamilies),
});

export const createRubiksStateSolver = (
  dimension: RubiksDimension,
): RubiksPuzzleSolver<RubiksSolverState> => {
  const cached = solverCache.get(dimension);
  if (cached) return cached;

  if (dimension === 4 || dimension === 5 || dimension === 6) {
    const solver = createHighOrderSolver(dimension);
    solverCache.set(dimension, solver);
    return solver;
  }

  const kpuzzlePromise = puzzles[`${dimension}x${dimension}x${dimension}`].kpuzzle();
  const solver: RubiksPuzzleSolver<RubiksSolverState> = {
    scrambleMoveCount: getScrambleMoveCount(dimension),
    createSolvedState: async () => ({nativePattern: (await kpuzzlePromise).defaultPattern()}),
    applyMove: (state, notation) => ({
      nativePattern: state.nativePattern?.applyMove(notation) ?? null,
    }),
    solve: async (state) => {
      if (!state.nativePattern) {
        throw new Error(`Missing ${dimension}x${dimension} solver state`);
      }
      return dimension === 2
        ? (await experimentalSolve2x2x2(state.nativePattern)).toString()
        : (await experimentalSolve3x3x3IgnoringCenters(state.nativePattern)).toString();
    },
  };

  solverCache.set(dimension, solver);
  return solver;
};
