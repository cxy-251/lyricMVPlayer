import * as THREE from "three";
import type {EffectViewport, EffectControl} from "../../types";

export const clamp = (value: unknown, fallback: number, min: number, max: number) =>
  THREE.MathUtils.clamp(typeof value === "number" && Number.isFinite(value) ? value : fallback, min, max);

export const record = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};

export const resizeTarget = (target: THREE.WebGLRenderTarget, viewport: EffectViewport) => {
  target.setSize(
    Math.max(1, Math.round(viewport.width * Math.min(2, viewport.pixelRatio))),
    Math.max(1, Math.round(viewport.height * Math.min(2, viewport.pixelRatio))),
  );
};

export const disposeScene = (scene: THREE.Scene) => {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
  scene.clear();
};

export const disposeSceneObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
};

export const controls = (items: Array<[string, string, number, number, number]>): EffectControl[] => items.map(([field, label, min, max, step]) => ({kind: "number", field, label, min, max, step}));
