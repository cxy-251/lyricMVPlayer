import type {VisualModuleConfig} from "@paper-to-video/shared-types";
import type * as THREE from "three";

export type RubiksAxis = "x" | "y" | "z";
export type RubiksBodyFinish = "glossy" | "matte" | "metal";
export type RubiksDimension = 2 | 3 | 4 | 5 | 6;
export type RubiksFace = "back" | "down" | "front" | "left" | "right" | "up";
export type RubiksStickerPalette = "classic" | "neon" | "pastel";

export type RubiksCoordinate = readonly [x: number, y: number, z: number];

export type RubiksMove = {
  axis: RubiksAxis;
  layer: number;
  notation: string;
  quarterTurns: -2 | -1 | 1 | 2;
  wholeCube?: boolean;
};

export type RubiksCubieState = {
  coord: THREE.Vector3;
  initialCoord: THREE.Vector3;
  orientation: THREE.Quaternion;
};

export type RubiksCubelet = {
  id: string;
  initialCoord: THREE.Vector3;
  object: THREE.Group;
};

export type ThreeRubiksModules = VisualModuleConfig | undefined;

export type ThreeRubiksCubeletBundle = {
  bodyMaterial: THREE.MeshPhysicalMaterial;
  cubelets: RubiksCubelet[];
  bodyGeometry: THREE.BufferGeometry;
  stickerGeometry: THREE.BufferGeometry;
  stickerMaterials: Map<RubiksFace, THREE.MeshPhysicalMaterial>;
  materials: THREE.Material[];
};

export type RubiksSequenceCache = {
  scramble: RubiksMove[];
  seed: number;
  solve: RubiksMove[];
  statesByStep: RubiksCubieState[][];
};
