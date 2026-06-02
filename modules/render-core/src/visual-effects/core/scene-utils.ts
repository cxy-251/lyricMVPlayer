import * as THREE from "three";

export const dampFactor = (lambda: number, delta: number) => 1 - Math.exp(-lambda * delta);

export const damp = (current: number, target: number, lambda: number, delta: number) =>
  THREE.MathUtils.lerp(current, target, dampFactor(lambda, delta));

export const decay = (current: number, lambda: number, delta: number) => current * Math.exp(-lambda * delta);

export const clampToStep = (value: number, min: number, max: number, step: number) => {
  const clamped = THREE.MathUtils.clamp(value, min, max);
  return Math.round(clamped / step) * step;
};

export const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

export const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }
  material.dispose();
};

export const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      disposeMaterial(child.material);
    }
  });
};
