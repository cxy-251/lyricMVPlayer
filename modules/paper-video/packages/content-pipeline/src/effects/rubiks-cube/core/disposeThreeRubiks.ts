import * as THREE from "three";
import type {ThreeRubiksCubeletBundle} from "../rubiks-cube.types";

const disposeObjectMaterials = (object: ThreeRubiksCubeletBundle["cubelets"][number]["object"]) => {
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) {
      return;
    }

    if (Array.isArray(node.material)) {
      node.material.forEach((material) => material.dispose());
      return;
    }

    node.material.dispose();
  });
};

export const disposeThreeRubiks = ({
  bundle,
  renderer,
  root,
  scene,
}: {
  bundle: ThreeRubiksCubeletBundle;
  renderer: THREE.WebGLRenderer;
  root: THREE.Group;
  scene: THREE.Scene;
}) => {
  bundle.cubelets.forEach((cubie) => {
    disposeObjectMaterials(cubie.object);
    root.remove(cubie.object);
  });
  bundle.bodyGeometry.dispose();
  bundle.stickerGeometry.dispose();
  scene.remove(root);
  renderer.dispose();
};
