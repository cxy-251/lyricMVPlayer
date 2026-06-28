import type * as THREE from 'three';

export type UniformMap<T extends Record<string, unknown>> = {
  [K in keyof T]: THREE.IUniform<T[K]>;
};

export function createUniforms<T extends Record<string, unknown>>(values: T): UniformMap<T> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, {value}])) as UniformMap<T>;
}
