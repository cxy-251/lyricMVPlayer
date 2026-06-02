import type {VisualModuleConfig} from "@paper-to-video/shared-types";
import type * as THREE from "three";

export type RubiksAxis = "x" | "y" | "z";

export type RubiksCoordinate = readonly [x: number, y: number, z: number];

export type RubiksMove = {
  axis: RubiksAxis;
  layer: -1 | 1;
  notation: string;
  quarterTurns: -2 | -1 | 1 | 2;
};

export type RubiksCubieState = {
  coord: THREE.Vector3;
  orientation: THREE.Quaternion;
};

export type RubiksCubelet = {
  id: string;
  initialCoord: THREE.Vector3;
  object: THREE.Group;
};

export type ThreeRubiksModules = VisualModuleConfig | undefined;

export type ThreeRubiksCubeletBundle = {
  cubelets: RubiksCubelet[];
  bodyGeometry: THREE.BufferGeometry;
  stickerGeometry: THREE.BufferGeometry;
};

export type RubiksSequenceCache = {
  scramble: RubiksMove[];
  seed: number;
  solve: RubiksMove[];
  statesByStep: RubiksCubieState[][];
};

export type ThreeRubiksEngineOptions = {
  height: number;
  width: number;
};

export type ThreeRubiksRenderParams = {
  absoluteFrame: number;
  activationFrame: number;
  modules?: ThreeRubiksModules;
  seed: number;
  simulationFrame?: number;
};

export type WebRubiksLayerProps = {
  activationFrame: number;
  className?: string;
  height: number;
  isRunning?: boolean;
  modules?: ThreeRubiksModules;
  resetToken?: number;
  seed: number;
  width: number;
};

export type RemotionRubiksLayerProps = {
  absoluteFrame: number;
  activationFrame: number;
  className?: string;
  height: number;
  modules?: ThreeRubiksModules;
  seed: number;
  simulationFrame?: number;
  width: number;
};
