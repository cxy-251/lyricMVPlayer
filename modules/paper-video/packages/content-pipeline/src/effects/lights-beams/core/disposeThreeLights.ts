import type {ThreeLightsMeshBundle} from "../lights-beams.types";
import type * as THREE from "three";

export const disposeThreeLights = ({
  bundle,
  renderer,
  root,
  scene,
}: {
  bundle: ThreeLightsMeshBundle;
  renderer: THREE.WebGLRenderer;
  root: THREE.Group;
  scene: THREE.Scene;
}) => {
  bundle.orbGeometry?.dispose();
  bundle.dotGeometry?.dispose();
  bundle.groundDiscGeometry?.dispose();
  bundle.groundRingGeometry?.dispose();
  bundle.floorTiles?.forEach((tile) => {
    tile.geometry?.dispose();
    tile.fillMaterial?.dispose();
    tile.wireMaterial?.dispose();
    tile.guideRails?.forEach((plane) => {
      plane.geometry?.dispose();
      plane.material?.dispose();
    });
    tile.guideDashes?.forEach((plane) => {
      plane.geometry?.dispose();
      plane.material?.dispose();
    });
  });
  bundle.horizonGeometry?.dispose();
  bundle.horizonMaterial?.dispose();
  bundle.stars?.geometry?.dispose();
  bundle.stars?.material?.dispose();
  bundle.pulseHeroes?.meshes?.forEach((mesh) => mesh.removeFromParent());
  bundle.pulseHeroes?.materials?.forEach((material) => material?.dispose());
  bundle.glow?.mesh?.dispose();
  bundle.core?.mesh?.dispose();
  bundle.accent?.mesh?.dispose();
  bundle.groundAura?.mesh?.dispose();
  bundle.groundGlow?.mesh?.dispose();
  bundle.groundRim?.mesh?.dispose();
  bundle.surfaceDots?.mesh?.dispose();
  bundle.surfaceAccent?.mesh?.dispose();
  bundle.glow?.material?.dispose();
  bundle.core?.material?.dispose();
  bundle.accent?.material?.dispose();
  bundle.groundAura?.material?.dispose();
  bundle.groundGlow?.material?.dispose();
  bundle.groundRim?.material?.dispose();
  bundle.surfaceDots?.material?.dispose();
  bundle.surfaceAccent?.material?.dispose();
  bundle.stars?.points?.removeFromParent();
  root.clear();
  scene.clear();
  renderer.dispose();
};
