import * as THREE from "three";

export const GALAXY_RADIUS = 12;

const createSeededRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const createGalaxyGeometry = (count: number, seed: number) => {
  const random = createSeededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);
  const randoms = new Float32Array(count);
  const radii = new Float32Array(count);
  const arms = 5;

  for (let i = 0; i < count; i += 1) {
    const index = i * 3;
    const branchAngle = ((i % arms) / arms) * Math.PI * 2;
    const radius = Math.pow(random(), 0.62) * GALAXY_RADIUS;
    const spinAngle = radius * 0.62;
    const spread = Math.pow(random(), 2.4) * (0.38 + radius * 0.055);
    const spreadAngle = random() * Math.PI * 2;

    positions[index] = Math.cos(branchAngle + spinAngle) * radius + Math.cos(spreadAngle) * spread;
    positions[index + 1] = Math.sin(branchAngle + spinAngle) * radius + Math.sin(spreadAngle) * spread;
    positions[index + 2] = (random() - 0.5) * Math.pow(random(), 2.8) * 1.1;

    scales[i] = THREE.MathUtils.lerp(1.15, 4.6, Math.pow(random(), 2.1));
    phases[i] = random();
    randoms[i] = random();
    radii[i] = radius;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));
  geometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
  geometry.computeBoundingSphere();

  return geometry;
};

