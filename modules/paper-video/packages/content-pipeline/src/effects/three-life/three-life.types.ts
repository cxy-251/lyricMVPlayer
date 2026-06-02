import type {
  CellularEffectConfig,
  RenderManifest,
} from "@paper-to-video/shared-types";
import type * as THREE from "three";

export type ThreeLifeModules = RenderManifest["modules"];

export type ThreeLifeEngineOptions = {
  width: number;
  height: number;
};

export type ThreeLifeRenderParams = {
  absoluteFrame: number;
  activationFrame: number;
  simulationFrame?: number;
  seed: number;
  modules?: ThreeLifeModules;
};

export type ThreeLifeMeshLayerName = "birth" | "primary" | "secondary";

export type ThreeLifeMeshLayer = {
  material: THREE.MeshBasicMaterial;
  mesh: THREE.InstancedMesh;
  name: ThreeLifeMeshLayerName;
};

export type ThreeLifeMeshBundle = {
  birth: ThreeLifeMeshLayer;
  geometry: THREE.PlaneGeometry;
  primary: ThreeLifeMeshLayer;
  secondary: ThreeLifeMeshLayer;
  signature: string;
};

export type UpdateLifeInstancesInput = {
  cells: Array<{
    x: number;
    y: number;
    age: number;
    tone: number;
  }>;
  config: CellularEffectConfig;
  helper: THREE.Object3D;
  height: number;
  meshes: Pick<ThreeLifeMeshBundle, "birth" | "primary" | "secondary">;
  width: number;
};

export type WebThreeLifeLayerProps = {
  activationFrame: number;
  className?: string;
  height: number;
  isRunning?: boolean;
  modules?: ThreeLifeModules;
  resetToken?: number;
  seed: number;
  width: number;
};

export type RemotionThreeLifeLayerProps = {
  absoluteFrame?: number;
  activationFrame: number;
  className?: string;
  height: number;
  modules?: ThreeLifeModules;
  seed: number;
  simulationFrame?: number;
  width: number;
};
