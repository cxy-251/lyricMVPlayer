import * as THREE from 'three';

export function clampToStep(value: number, min: number, max: number, step: number) {
  const stepped = Math.round(value / step) * step;
  return THREE.MathUtils.clamp(stepped, min, max);
}
