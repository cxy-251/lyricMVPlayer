import * as THREE from "three";
import type {
  RubiksCoordinate,
  RubiksCubieState,
  RubiksMove,
  RubiksSequenceCache,
} from "../rubiks-cube.types";

const AXIS_VECTORS: Record<RubiksMove["axis"], THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

const FACE_LIBRARY: Array<Pick<RubiksMove, "axis" | "layer"> & {face: string}> = [
  {face: "R", axis: "x", layer: 1},
  {face: "L", axis: "x", layer: -1},
  {face: "U", axis: "y", layer: 1},
  {face: "D", axis: "y", layer: -1},
  {face: "F", axis: "z", layer: 1},
  {face: "B", axis: "z", layer: -1},
];

const buildRubiksCoordinates = (): RubiksCoordinate[] => {
  const coordinates: RubiksCoordinate[] = [];

  for (const x of [-1, 0, 1] as const) {
    for (const y of [-1, 0, 1] as const) {
      for (const z of [-1, 0, 1] as const) {
        if (x === 0 && y === 0 && z === 0) {
          continue;
        }

        coordinates.push([x, y, z]);
      }
    }
  }

  return coordinates;
};

const roundVector = (vector: THREE.Vector3) =>
  new THREE.Vector3(Math.round(vector.x), Math.round(vector.y), Math.round(vector.z));

const cloneState = (state: RubiksCubieState[]): RubiksCubieState[] =>
  state.map((cubie) => ({
    coord: cubie.coord.clone(),
    orientation: cubie.orientation.clone(),
  }));

const createRng = (seed: number) => {
  let state = Math.abs(Math.trunc(seed)) % 2147483647;
  if (state === 0) {
    state = 1;
  }

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

const getMoveAngle = (move: RubiksMove) => (move.quarterTurns * Math.PI) / 2;

const isCubieInLayer = (cubie: RubiksCubieState, move: RubiksMove) => {
  if (move.axis === "x") {
    return Math.round(cubie.coord.x) === move.layer;
  }

  if (move.axis === "y") {
    return Math.round(cubie.coord.y) === move.layer;
  }

  return Math.round(cubie.coord.z) === move.layer;
};

export const RUBIKS_COORDINATES = buildRubiksCoordinates();

export const createSolvedRubiksState = (): RubiksCubieState[] =>
  RUBIKS_COORDINATES.map(([x, y, z]) => ({
    coord: new THREE.Vector3(x, y, z),
    orientation: new THREE.Quaternion(),
  }));

export const applyRubiksMoveToState = (
  state: RubiksCubieState[],
  move: RubiksMove,
): RubiksCubieState[] => {
  const axis = AXIS_VECTORS[move.axis];
  const rotation = new THREE.Quaternion().setFromAxisAngle(axis, getMoveAngle(move));

  return state.map((cubie) => {
    if (!isCubieInLayer(cubie, move)) {
      return {
        coord: cubie.coord.clone(),
        orientation: cubie.orientation.clone(),
      };
    }

    return {
      coord: roundVector(cubie.coord.clone().applyQuaternion(rotation)),
      orientation: cubie.orientation.clone().premultiply(rotation).normalize(),
    };
  });
};

export const applyRubiksMoveProgress = (
  state: RubiksCubieState[],
  move: RubiksMove,
  progress: number,
): RubiksCubieState[] => {
  const axis = AXIS_VECTORS[move.axis];
  const rotation = new THREE.Quaternion().setFromAxisAngle(
    axis,
    getMoveAngle(move) * Math.max(0, Math.min(1, progress)),
  );

  return state.map((cubie) => {
    if (!isCubieInLayer(cubie, move)) {
      return {
        coord: cubie.coord.clone(),
        orientation: cubie.orientation.clone(),
      };
    }

    return {
      coord: cubie.coord.clone().applyQuaternion(rotation),
      orientation: cubie.orientation.clone().premultiply(rotation).normalize(),
    };
  });
};

export const invertRubiksMove = (move: RubiksMove): RubiksMove => ({
  ...move,
  quarterTurns: (move.quarterTurns === 2 || move.quarterTurns === -2
    ? 2
    : -move.quarterTurns) as RubiksMove["quarterTurns"],
});

export const generateRubiksScramble = (seed: number, moveCount = 18): RubiksMove[] => {
  const random = createRng(seed);
  const result: RubiksMove[] = [];
  let previousAxis: RubiksMove["axis"] | null = null;

  while (result.length < moveCount) {
    const candidate = FACE_LIBRARY[Math.floor(random() * FACE_LIBRARY.length)];
    if (candidate.axis === previousAxis) {
      continue;
    }

    const turnOptions: RubiksMove["quarterTurns"][] = [1, -1, 2];
    const quarterTurns = turnOptions[Math.floor(random() * turnOptions.length)];
    const suffix = quarterTurns === 2 ? "2" : quarterTurns === -1 ? "'" : "";
    result.push({
      axis: candidate.axis,
      layer: candidate.layer,
      notation: `${candidate.face}${suffix}`,
      quarterTurns,
    });
    previousAxis = candidate.axis;
  }

  return result;
};

export const buildRubiksSequenceCache = (seed: number): RubiksSequenceCache => {
  const scramble = generateRubiksScramble(seed);
  const solve = scramble
    .slice()
    .reverse()
    .map((move) => invertRubiksMove(move));

  let current = createSolvedRubiksState();
  for (const move of scramble) {
    current = applyRubiksMoveToState(current, move);
  }

  const statesByStep: RubiksCubieState[][] = [cloneState(current)];
  for (const move of solve) {
    current = applyRubiksMoveToState(current, move);
    statesByStep.push(cloneState(current));
  }

  return {
    scramble,
    seed,
    solve,
    statesByStep,
  };
};
