import type * as THREE from "three";
import type {ThreeLifeMeshBundle} from "../three-life.types";

const removeMesh = (scene: THREE.Scene, meshLayer: ThreeLifeMeshBundle["birth"]) => {
  scene.remove(meshLayer.mesh);
  meshLayer.material.dispose();
  meshLayer.mesh.dispose();
};

export const disposeLifeMeshes = ({
  meshBundle,
  scene,
}: {
  meshBundle: ThreeLifeMeshBundle | null;
  scene: THREE.Scene;
}) => {
  if (!meshBundle) {
    return;
  }

  removeMesh(scene, meshBundle.birth);
  removeMesh(scene, meshBundle.primary);
  removeMesh(scene, meshBundle.secondary);
  meshBundle.geometry.dispose();
};

export const disposeThreeLife = ({
  meshBundle,
  renderer,
  scene,
}: {
  meshBundle: ThreeLifeMeshBundle | null;
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene;
}) => {
  disposeLifeMeshes({meshBundle, scene});
  renderer?.dispose();
};
