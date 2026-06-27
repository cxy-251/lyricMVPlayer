import * as THREE from 'three';

export const MORPH_SHAPES = ['sphere', 'torus', 'spiral galaxy', 'wave grid'] as const;
export type MorphShapeName = (typeof MORPH_SHAPES)[number];

export type MorphTargetSet = {
  count: number;
  galaxy: Float32Array;
  grid: Float32Array;
  seed: Float32Array;
  sphere: Float32Array;
  torus: Float32Array;
};

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function fract(value: number) {
  return value - Math.floor(value);
}

function hash(seed: number) {
  return fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453123);
}

function writeVector(array: Float32Array, index: number, x: number, y: number, z: number) {
  const cursor = index * 3;

  array[cursor] = x;
  array[cursor + 1] = y;
  array[cursor + 2] = z;
}

function writeSphere(array: Float32Array, index: number, count: number) {
  const t = (index + 0.5) / count;
  const y = 1 - t * 2;
  const radius = Math.sqrt(Math.max(1 - y * y, 0));
  const theta = index * GOLDEN_ANGLE;
  const shell = 2.45 + (hash(index + 4.2) - 0.5) * 0.18;

  writeVector(array, index, Math.cos(theta) * radius * shell, y * shell, Math.sin(theta) * radius * shell);
}

function writeTorus(array: Float32Array, index: number) {
  const major = 2.15 + (hash(index + 33.1) - 0.5) * 0.08;
  const minor = 0.74 + (hash(index + 91.7) - 0.5) * 0.12;
  const u = fract(index * 0.61803398875) * TAU;
  const v = fract(index * 0.38196601125 + hash(index + 8.4) * 0.12) * TAU;
  const tube = major + Math.cos(v) * minor;

  writeVector(array, index, Math.cos(u) * tube, Math.sin(v) * minor, Math.sin(u) * tube);
}

function writeGalaxy(array: Float32Array, index: number, count: number) {
  const t = (index + 0.5) / count;
  const armCount = 4;
  const arm = Math.floor(hash(index + 17.8) * armCount);
  const radius = Math.pow(t, 0.58) * 3.65;
  const angle =
    (arm / armCount) * TAU +
    radius * 1.85 +
    (hash(index + 22.9) - 0.5) * (0.88 - Math.min(radius * 0.12, 0.62));
  const thickness = (hash(index + 12.4) - 0.5) * (0.26 + radius * 0.04);

  writeVector(
    array,
    index,
    Math.cos(angle) * radius + thickness * Math.cos(angle + Math.PI * 0.5),
    (hash(index + 76.2) - 0.5) * (0.24 + radius * 0.055),
    Math.sin(angle) * radius + thickness * Math.sin(angle + Math.PI * 0.5),
  );
}

function writeWaveGrid(array: Float32Array, index: number, count: number) {
  const columns = Math.ceil(Math.sqrt(count * 1.62));
  const rows = Math.ceil(count / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const u = columns > 1 ? column / (columns - 1) : 0;
  const v = rows > 1 ? row / (rows - 1) : 0;
  const x = (u - 0.5) * 6.4;
  const z = (v - 0.5) * 4.2;
  const jitterX = (hash(index + 41.2) - 0.5) * 0.035;
  const jitterZ = (hash(index + 63.5) - 0.5) * 0.035;
  const y = Math.sin(x * 1.15 + z * 0.65) * 0.28 + Math.cos(z * 1.55) * 0.18;

  writeVector(array, index, x + jitterX, y, z + jitterZ);
}

export function generateMorphTargets(count: number): MorphTargetSet {
  const sphere = new Float32Array(count * 3);
  const torus = new Float32Array(count * 3);
  const galaxy = new Float32Array(count * 3);
  const grid = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);

  for (let i = 0; i < count; i += 1) {
    writeSphere(sphere, i, count);
    writeTorus(torus, i);
    writeGalaxy(galaxy, i, count);
    writeWaveGrid(grid, i, count);

    const cursor = i * 4;
    seed[cursor] = hash(i + 1.3);
    seed[cursor + 1] = hash(i + 5.8);
    seed[cursor + 2] = hash(i + 9.1);
    seed[cursor + 3] = THREE.MathUtils.lerp(0.68, 1.52, hash(i + 13.6));
  }

  return {count, galaxy, grid, seed, sphere, torus};
}

export function createMorphGeometryFromTargets(targets: MorphTargetSet) {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(targets.sphere.slice(), 3));
  geometry.setAttribute('aSphere', new THREE.BufferAttribute(targets.sphere, 3));
  geometry.setAttribute('aTorus', new THREE.BufferAttribute(targets.torus, 3));
  geometry.setAttribute('aGalaxy', new THREE.BufferAttribute(targets.galaxy, 3));
  geometry.setAttribute('aGrid', new THREE.BufferAttribute(targets.grid, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(targets.seed, 4));
  geometry.computeBoundingSphere();

  return geometry;
}
