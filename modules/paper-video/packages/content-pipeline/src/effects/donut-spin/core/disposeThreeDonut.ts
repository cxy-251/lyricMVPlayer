import type * as THREE from "three";
import type {ThreeDonutMeshBundle} from "../donut-spin.types";

export const disposeThreeDonut = ({
  bundle,
  renderer,
  root,
  scene,
}: {
  bundle: ThreeDonutMeshBundle;
  renderer: THREE.WebGLRenderer;
  root: THREE.Group;
  scene: THREE.Scene;
}) => {
  root.remove(bundle.bodyMesh, bundle.glowMesh, bundle.wireMesh, bundle.pearlMesh);
  scene.remove(bundle.shadowDisc.mesh, bundle.haloDisc.mesh);

  bundle.bodyGeometry.dispose();
  bundle.bodyMaterial.dispose();
  bundle.glowGeometry.dispose();
  bundle.glowMaterial.dispose();
  bundle.wireGeometry.dispose();
  bundle.wireMaterial.dispose();
  bundle.pearlGeometry.dispose();
  bundle.pearlMaterial.dispose();
  bundle.shadowDisc.geometry.dispose();
  bundle.shadowDisc.material.dispose();
  bundle.haloDisc.geometry.dispose();
  bundle.haloDisc.material.dispose();

  renderer.dispose();
};
