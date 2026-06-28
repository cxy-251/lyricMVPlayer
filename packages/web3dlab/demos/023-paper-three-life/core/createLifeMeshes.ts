import * as THREE from "three";
import type {CellularEffectConfig} from "@paper-to-video/shared-types";
import type {ThreeLifeMeshBundle, ThreeLifeMeshLayer, ThreeLifeMeshLayerName} from "../three-life.types";

const createLayer = ({
  color,
  geometry,
  name,
  capacity,
  scene,
}: {
  color: string;
  geometry: THREE.PlaneGeometry;
  name: ThreeLifeMeshLayerName;
  capacity: number;
  scene: THREE.Scene;
}): ThreeLifeMeshLayer => {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 1,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  return {
    material,
    mesh,
    name,
  };
};

export const createLifeMeshes = ({
  config,
  scene,
}: {
  config: CellularEffectConfig;
  scene: THREE.Scene;
}): ThreeLifeMeshBundle => {
  const cols = Math.max(1, Math.round(config.cellColumns));
  const rows = Math.max(1, Math.round(config.cellRows));
  const capacity = cols * rows;
  const signature = `${cols}x${rows}`;
  const geometry = new THREE.PlaneGeometry(1, 1);

  return {
    birth: createLayer({
      color: config.birthColor,
      geometry,
      name: "birth",
      capacity,
      scene,
    }),
    geometry,
    primary: createLayer({
      color: config.primaryColor,
      geometry,
      name: "primary",
      capacity,
      scene,
    }),
    secondary: createLayer({
      color: config.secondaryColor,
      geometry,
      name: "secondary",
      capacity,
      scene,
    }),
    signature,
  };
};
