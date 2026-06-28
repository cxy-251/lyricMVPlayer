import type {
  CellularEffectConfig,
  RenderManifest,
} from "@paper-to-video/shared-types";
import type * as THREE from "three";

export type ThreeLifeModules = RenderManifest["modules"];

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

