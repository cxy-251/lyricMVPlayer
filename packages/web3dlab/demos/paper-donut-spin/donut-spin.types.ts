import type {DonutEffectConfig, RenderManifest} from "@paper-to-video/shared-types";
import type * as THREE from "three";

export type ThreeDonutModules = RenderManifest["modules"];

export type DonutOrbitSeed = {
  angle: number;
  lane: number;
  offset: number;
  pulse: number;
  speed: number;
};

export type ThreeDonutMeshBundle = {
  bodyGeometry: THREE.TorusGeometry;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  bodyMesh: THREE.Mesh<THREE.TorusGeometry, THREE.MeshPhysicalMaterial>;
  glowGeometry: THREE.TorusGeometry;
  glowMaterial: THREE.MeshBasicMaterial;
  glowMesh: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  wireGeometry: THREE.TorusGeometry;
  wireMaterial: THREE.MeshBasicMaterial;
  wireMesh: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  pearlGeometry: THREE.SphereGeometry;
  pearlMaterial: THREE.MeshStandardMaterial;
  pearlMesh: THREE.InstancedMesh;
  shadowDisc: {
    geometry: THREE.CircleGeometry;
    material: THREE.MeshBasicMaterial;
    mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  };
  haloDisc: {
    geometry: THREE.CircleGeometry;
    material: THREE.MeshBasicMaterial;
    mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  };
  signature: string;
};

