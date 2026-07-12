import * as THREE from "three";
import type {
  RubiksCoordinate,
  RubiksCubieState,
  RubiksDimension,
  RubiksMove,
  RubiksSequenceCache,
} from "./rubiks-cube.types";

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

const FACE_BY_AXIS_AND_SIDE: Record<RubiksMove["axis"], Record<-1 | 1, string>> = {
  x: {"-1": "L", 1: "R"},
  y: {"-1": "D", 1: "U"},
  z: {"-1": "B", 1: "F"},
};

type FaceletFace = "U" | "R" | "F" | "D" | "L" | "B";
const FACELET_ORDER: FaceletFace[] = ["U", "R", "F", "D", "L", "B"];

const getFaceDefinition = (face: string) => FACE_LIBRARY.find((candidate) => candidate.face === face);

export const createRubiksCoordinates = (dimension: RubiksDimension): RubiksCoordinate[] => {
  const coordinates: RubiksCoordinate[] = [];
  const values = Array.from({length: dimension}, (_, index) => {
    const value = -1 + (index * 2) / (dimension - 1);
    return Math.abs(value) < 0.000001 ? 0 : Number(value.toFixed(6));
  });

  for (const x of values) {
    for (const y of values) {
      for (const z of values) {
        if (Math.abs(x) < 0.999 && Math.abs(y) < 0.999 && Math.abs(z) < 0.999) {
          continue;
        }

        coordinates.push([x, y, z]);
      }
    }
  }

  return coordinates;
};

const roundVector = (vector: THREE.Vector3) =>
  new THREE.Vector3(
    Number(vector.x.toFixed(6)),
    Number(vector.y.toFixed(6)),
    Number(vector.z.toFixed(6)),
  );

const cloneState = (state: RubiksCubieState[]): RubiksCubieState[] =>
  state.map((cubie) => ({
    coord: cubie.coord.clone(),
    initialCoord: cubie.initialCoord.clone(),
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
  if (move.wholeCube) return true;

  if (move.axis === "x") {
    return Math.abs(cubie.coord.x - move.layer) < 0.001;
  }

  if (move.axis === "y") {
    return Math.abs(cubie.coord.y - move.layer) < 0.001;
  }

  return Math.abs(cubie.coord.z - move.layer) < 0.001;
};

export const createSolvedRubiksState = (dimension: RubiksDimension = 3): RubiksCubieState[] =>
  createRubiksCoordinates(dimension).map(([x, y, z]) => ({
    coord: new THREE.Vector3(x, y, z),
    initialCoord: new THREE.Vector3(x, y, z),
    orientation: new THREE.Quaternion(),
  }));

const getFaceletFace = (normal: THREE.Vector3): FaceletFace => {
  const components = {
    x: Math.abs(normal.x),
    y: Math.abs(normal.y),
    z: Math.abs(normal.z),
  };
  const axis = (Object.keys(components) as Array<keyof typeof components>).reduce((largest, candidate) =>
    components[candidate] > components[largest] ? candidate : largest,
  );
  if (axis === "x") return normal.x >= 0 ? "R" : "L";
  if (axis === "y") return normal.y >= 0 ? "U" : "D";
  return normal.z >= 0 ? "F" : "B";
};

const getFaceletIndex = (value: number, dimension: RubiksDimension) =>
  Math.round(((value + 1) * (dimension - 1)) / 2);

const getFaceletCell = (
  face: FaceletFace,
  coord: THREE.Vector3,
  dimension: RubiksDimension,
) => {
  const ascending = (value: number) => getFaceletIndex(value, dimension);
  if (face === "U") return [ascending(coord.z), ascending(coord.x)] as const;
  if (face === "R") return [ascending(-coord.y), ascending(-coord.z)] as const;
  if (face === "F") return [ascending(-coord.y), ascending(coord.x)] as const;
  if (face === "D") return [ascending(-coord.z), ascending(coord.x)] as const;
  if (face === "L") return [ascending(-coord.y), ascending(coord.z)] as const;
  return [ascending(-coord.y), ascending(-coord.x)] as const;
};

export const serializeRubiksFacelets = (
  state: RubiksCubieState[],
  dimension: RubiksDimension,
) => {
  const facelets = Object.fromEntries(
    FACELET_ORDER.map((face) => [face, Array<string>(dimension * dimension).fill("")]),
  ) as Record<FaceletFace, string[]>;

  state.forEach((cubie) => {
    (["x", "y", "z"] as const).forEach((axis) => {
      const side = cubie.initialCoord[axis];
      if (Math.abs(side) < 0.999) {
        return;
      }

      const initialNormal = new THREE.Vector3(
        axis === "x" ? Math.sign(side) : 0,
        axis === "y" ? Math.sign(side) : 0,
        axis === "z" ? Math.sign(side) : 0,
      );
      const color = getFaceletFace(initialNormal);
      const currentFace = getFaceletFace(initialNormal.clone().applyQuaternion(cubie.orientation));
      const [row, column] = getFaceletCell(currentFace, cubie.coord, dimension);
      const index = row * dimension + column;
      if (facelets[currentFace][index]) {
        throw new Error(`Duplicate ${currentFace} facelet at ${row}:${column}`);
      }
      facelets[currentFace][index] = color;
    });
  });

  const incomplete = FACELET_ORDER.some((face) => facelets[face].some((value) => !value));
  const serialized = FACELET_ORDER.flatMap((face) => facelets[face]).join("");
  if (incomplete || serialized.length !== 6 * dimension * dimension) {
    throw new Error(`Incomplete ${dimension}x${dimension} Rubik facelet state`);
  }
  return serialized;
};

export const createRubiksFaceMove = ({
  axis,
  direction,
  halfTurn = false,
  layer,
}: Pick<RubiksMove, "axis" | "layer"> & {direction: 1 | -1; halfTurn?: boolean}): RubiksMove => {
  const face = FACE_LIBRARY.find((candidate) => candidate.axis === axis && candidate.layer === layer)?.face;
  if (!face) {
    throw new Error(`Unknown Rubik face: ${axis}:${layer}`);
  }

  return {
    axis,
    layer,
    notation: `${face}${halfTurn ? "2" : direction === -1 ? "'" : ""}`,
    quarterTurns: halfTurn ? 2 : (-layer * direction) as -1 | 1,
  };
};

export const createRubiksLayerMove = ({
  axis,
  dimension,
  layer,
  quarterTurns,
}: {
  axis: RubiksMove["axis"];
  dimension: RubiksDimension;
  layer: number;
  quarterTurns: -2 | -1 | 1 | 2;
}): RubiksMove => {
  const epsilon = 0.001;
  const side = (layer > epsilon ? 1 : layer < -epsilon ? -1 : axis === "z" ? 1 : -1) as -1 | 1;
  const spacing = 2 / (dimension - 1);
  const depth = Math.round((1 - side * layer) / spacing) + 1;
  const face = FACE_BY_AXIS_AND_SIDE[axis][side];
  const baseQuarterTurn = -side;

  return {
    axis,
    layer,
    notation: `${depth === 1 ? "" : depth}${face}${Math.abs(quarterTurns) === 2 ? "2" : quarterTurns === baseQuarterTurn ? "" : "'"}`,
    quarterTurns,
  };
};

export const createRubiksWholeCubeMove = (
  axis: RubiksMove["axis"],
  quarterTurns: -2 | -1 | 1 | 2,
): RubiksMove => ({
  axis,
  layer: 0,
  notation: `${axis}${Math.abs(quarterTurns) === 2 ? "2" : quarterTurns === -1 ? "" : "'"}`,
  quarterTurns,
  wholeCube: true,
});

export const parseRubiksMove = (
  notation: string,
  dimension: RubiksDimension = 3,
): RubiksMove | null => {
  const normalizedNotation = notation.trim();
  const wholeCubeMatch = /^([xyz])(2|')?$/.exec(normalizedNotation);
  if (wholeCubeMatch) {
    return createRubiksWholeCubeMove(
      wholeCubeMatch[1] as RubiksMove["axis"],
      wholeCubeMatch[2] === "2" ? 2 : wholeCubeMatch[2] === "'" ? 1 : -1,
    );
  }
  const match = /^(\d+)?([RLUDFB])(2|')?$/.exec(normalizedNotation);
  if (!match) {
    return null;
  }

  const depth = match[1] ? Number(match[1]) : 1;
  const face = getFaceDefinition(match[2]);
  if (!face) {
    return null;
  }

  const spacing = 2 / (dimension - 1);
  const layer = Number((face.layer * (1 - (depth - 1) * spacing)).toFixed(6));
  if (depth < 1 || Math.abs(layer) > 1.001) {
    return null;
  }

  return {
    axis: face.axis,
    layer,
    notation: normalizedNotation,
    quarterTurns: match[3] === "2"
      ? 2
      : (-face.layer * (match[3] === "'" ? -1 : 1)) as -1 | 1,
  };
};

export const parseRubiksAlgorithm = (
  algorithm: string,
  dimension: RubiksDimension = 3,
): RubiksMove[] =>
  algorithm
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((rawNotation) => {
      const notation = /^[rludfb]/.test(rawNotation)
        ? `${rawNotation[0].toUpperCase()}w${rawNotation.slice(1)}`
        : rawNotation;
      const wideMatch = /^(\d+)?([RLUDFB])w(2|')?$/.exec(notation);
      if (wideMatch) {
        const width = wideMatch[1] ? Number(wideMatch[1]) : 2;
        if (width < 2 || width > dimension) {
          throw new Error(`Unsupported Rubik wide move: ${rawNotation}`);
        }
        return Array.from({length: width}, (_, index) => {
          const depth = index + 1;
          const move = parseRubiksMove(
            `${depth === 1 ? "" : depth}${wideMatch[2]}${wideMatch[3] ?? ""}`,
            dimension,
          );
          if (!move) {
            throw new Error(`Unsupported Rubik move: ${rawNotation}`);
          }
          return move;
        });
      }

      const move = parseRubiksMove(notation, dimension);
      if (!move) {
        throw new Error(`Unsupported Rubik move: ${rawNotation}`);
      }
      return [move];
    });

export const isSolvedRubiksState = (
  state: RubiksCubieState[],
  dimension: RubiksDimension = 3,
) => {
  const facelets = serializeRubiksFacelets(state, dimension);
  const faceSize = dimension * dimension;
  return FACELET_ORDER.every((_, faceIndex) => {
    const face = facelets.slice(faceIndex * faceSize, (faceIndex + 1) * faceSize);
    return new Set(face).size === 1;
  });
};

const getCenterOrientationKey = (
  state: RubiksCubieState[],
  dimension: RubiksDimension,
) => {
  const facelets = serializeRubiksFacelets(state, dimension);
  const faceSize = dimension * dimension;
  const centerIndex = Math.floor(faceSize / 2);
  return FACELET_ORDER.map((_, faceIndex) => facelets[faceIndex * faceSize + centerIndex]).join("");
};

export const getRubiksOrientationCorrection = (
  state: RubiksCubieState[],
  dimension: RubiksDimension,
): RubiksMove[] => {
  if (dimension % 2 === 0) return [];

  const target = FACELET_ORDER.join("");
  const startKey = getCenterOrientationKey(state, dimension);
  if (startKey === target) return [];

  const generators = (["x", "y", "z"] as const).flatMap((axis) => [
    createRubiksWholeCubeMove(axis, -1),
    createRubiksWholeCubeMove(axis, 1),
  ]);
  const queue: Array<{moves: RubiksMove[]; state: RubiksCubieState[]}> = [{moves: [], state}];
  const visited = new Set([startKey]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const move of generators) {
      const nextState = applyRubiksMoveToState(current.state, move);
      const key = getCenterOrientationKey(nextState, dimension);
      if (visited.has(key)) continue;
      const moves = [...current.moves, move];
      if (key === target) return moves;
      visited.add(key);
      queue.push({moves, state: nextState});
    }
  }

  throw new Error(`Invalid ${dimension}x${dimension} center orientation`);
};

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
        initialCoord: cubie.initialCoord.clone(),
        orientation: cubie.orientation.clone(),
      };
    }

    return {
      coord: roundVector(cubie.coord.clone().applyQuaternion(rotation)),
      initialCoord: cubie.initialCoord.clone(),
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
        initialCoord: cubie.initialCoord.clone(),
        orientation: cubie.orientation.clone(),
      };
    }

    return {
      coord: cubie.coord.clone().applyQuaternion(rotation),
      initialCoord: cubie.initialCoord.clone(),
      orientation: cubie.orientation.clone().premultiply(rotation).normalize(),
    };
  });
};

export const invertRubiksMove = (move: RubiksMove): RubiksMove =>
  Math.abs(move.quarterTurns) === 2
    ? {...move}
    : {
        ...move,
        notation: move.notation.endsWith("'")
          ? move.notation.slice(0, -1)
          : `${move.notation}'`,
        quarterTurns: (-move.quarterTurns) as -1 | 1,
      };

export const generateRubiksScramble = (
  seed: number,
  dimension: RubiksDimension = 3,
  moveCount = 18,
): RubiksMove[] => {
  const random = createRng(seed);
  const result: RubiksMove[] = [];
  let previousAxis: RubiksMove["axis"] | null = null;
  const layerValues = Array.from({length: dimension}, (_, index) =>
    Number((-1 + (index * 2) / (dimension - 1)).toFixed(6)));

  while (result.length < moveCount) {
    const axis = (["x", "y", "z"] as const)[Math.floor(random() * 3)];
    if (axis === previousAxis) {
      continue;
    }

    const layer = dimension >= 4
      ? layerValues[Math.floor(random() * layerValues.length)]
      : (random() < 0.5 ? -1 : 1);
    const variant = Math.floor(random() * 3);
    const side = (layer >= 0 ? 1 : -1) as -1 | 1;
    const baseQuarterTurn = (-side) as -1 | 1;
    const quarterTurns = (variant === 2 ? 2 : variant === 1 ? -baseQuarterTurn : baseQuarterTurn) as -1 | 1 | 2;
    result.push(createRubiksLayerMove({
      axis,
      dimension,
      layer,
      quarterTurns,
    }));
    previousAxis = axis;
  }

  return result;
};

export const buildRubiksSequenceCache = (seed: number, dimension: RubiksDimension = 3): RubiksSequenceCache => {
  const scramble = generateRubiksScramble(seed, dimension);
  const solve = scramble
    .slice()
    .reverse()
    .map((move) => invertRubiksMove(move));

  let current = createSolvedRubiksState(dimension);
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
