import type {LightsEffectConfig, RenderManifest} from "@paper-to-video/shared-types";
import type * as THREE from "three";

export type ThreeLightsModules = RenderManifest["modules"];

export type LightsBeamSeed = {
  baseAngle: number;
  depth: number;
  drift: number;
  lane: number;
  orbit: number;
  phase: number;
  pulse: number;
  speed: number;
};

export type LightsMeshLayerName = "accent" | "core" | "glow";

export type LightsMeshLayer = {
  material: THREE.MeshBasicMaterial;
  mesh: THREE.InstancedMesh;
  name: LightsMeshLayerName;
};

export type ThreeLightsFloorTile = {
  basePositions: Float32Array;
  fillMaterial: THREE.MeshBasicMaterial;
  fillMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  geometry: THREE.PlaneGeometry;
  guideDashes: ThreeLightsGuidePlane[];
  guideRails: ThreeLightsGuidePlane[];
  wireMaterial: THREE.MeshBasicMaterial;
  wireMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
};

export type ThreeLightsGuidePlane = {
  basePositions: Float32Array;
  geometry: THREE.PlaneGeometry;
  material: THREE.MeshBasicMaterial;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  xOffset: number;
  zOffset: number;
};

export type ThreeLightsStarField = {
  colors: Float32Array;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  positions: Float32Array;
};

export type ThreeLightsPulseHeroes = {
  materials: THREE.MeshStandardMaterial[];
  meshes: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>[];
};

export type ThreeLightsMeshBundle = {
  accent: LightsMeshLayer;
  core: LightsMeshLayer;
  dotGeometry: THREE.SphereGeometry;
  groundDiscGeometry: THREE.CircleGeometry;
  groundRingGeometry: THREE.RingGeometry;
  orbGeometry: THREE.SphereGeometry;
  floorTiles: ThreeLightsFloorTile[];
  glow: LightsMeshLayer;
  groundAura: LightsMeshLayer;
  groundGlow: LightsMeshLayer;
  groundRim: LightsMeshLayer;
  horizonGeometry: THREE.CircleGeometry;
  horizonMaterial: THREE.MeshBasicMaterial;
  horizonMesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  pulseHeroes: ThreeLightsPulseHeroes;
  signature: string;
  stars: ThreeLightsStarField;
  surfaceAccent: LightsMeshLayer;
  surfaceDots: LightsMeshLayer;
};

export type UpdateLightsInstancesInput = {
  choreography: {
    auraGain: number;
    fieldGain: number;
    nearBias: number;
    orbGain: number;
    rimGain: number;
  };
  config: LightsEffectConfig;
  floorTiles: ThreeLightsMeshBundle["floorTiles"];
  frame: number;
  helper: THREE.Object3D;
  meshes: Pick<
    ThreeLightsMeshBundle,
    | "accent"
    | "core"
    | "glow"
    | "groundAura"
    | "groundGlow"
    | "groundRim"
    | "surfaceAccent"
    | "surfaceDots"
  >;
  pulseHeroes: ThreeLightsMeshBundle["pulseHeroes"];
  stars: ThreeLightsMeshBundle["stars"];
  seeds: LightsBeamSeed[];
};

