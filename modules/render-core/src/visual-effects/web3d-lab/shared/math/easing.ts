import * as THREE from 'three';

export function dampFactor(lambda: number, delta: number) {
  return 1 - Math.exp(-lambda * delta);
}

export function damp(current: number, target: number, lambda: number, delta: number) {
  return THREE.MathUtils.lerp(current, target, dampFactor(lambda, delta));
}

export function decay(current: number, lambda: number, delta: number) {
  return current * Math.exp(-lambda * delta);
}

export function dampVector2(
  current: THREE.Vector2,
  target: THREE.Vector2,
  lambda: number,
  delta: number,
) {
  return current.lerp(target, dampFactor(lambda, delta));
}
