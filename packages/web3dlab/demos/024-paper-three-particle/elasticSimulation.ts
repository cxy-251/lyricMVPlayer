import * as THREE from 'three';

export type ChamberBounds = {
  x: number;
  y: number;
  z: number;
};

export type ElasticBallSeed = {
  colorIndex: number;
  id: number;
  position: [number, number, number];
  velocity: [number, number, number];
};

const hashNoise = (value: number, seed: number) => {
  const result = Math.sin(value * 12.9898 + seed * 78.233) * 43758.5453;
  return result - Math.floor(result);
};

const randomDirection = (index: number, seed: number) => {
  const direction = new THREE.Vector3(
    hashNoise(index * 19 + 3, seed) * 2 - 1,
    hashNoise(index * 29 + 7, seed + 11) * 2 - 1,
    hashNoise(index * 43 + 13, seed + 23) * 2 - 1,
  );
  if (direction.lengthSq() < 0.01) direction.set(1, 0.3, -0.2);
  return direction.normalize();
};

export const buildElasticBallSeeds = ({
  bounds,
  count,
  radius,
  seed,
  speed,
}: {
  bounds: ChamberBounds;
  count: number;
  radius: number;
  seed: number;
  speed: number;
}) => {
  const resolvedCount = Math.max(2, Math.min(48, Math.round(count)));
  const resolvedRadius = THREE.MathUtils.clamp(radius, 0.22, 0.68);
  const resolvedSpeed = THREE.MathUtils.clamp(speed, 1.5, 9);
  const minimumDistance = resolvedRadius * 2.12;
  const positions: THREE.Vector3[] = [];

  for (let index = 0; index < resolvedCount; index += 1) {
    let accepted: THREE.Vector3 | null = null;
    for (let attempt = 0; attempt < 1200; attempt += 1) {
      const sample = index * 1301 + attempt;
      const candidate = new THREE.Vector3(
        (hashNoise(sample * 7 + 1, seed) * 2 - 1) * (bounds.x - resolvedRadius),
        (hashNoise(sample * 11 + 5, seed + 17) * 2 - 1) * (bounds.y - resolvedRadius),
        (hashNoise(sample * 17 + 9, seed + 31) * 2 - 1) * (bounds.z - resolvedRadius),
      );
      if (positions.every((position) => position.distanceTo(candidate) >= minimumDistance)) {
        accepted = candidate;
        break;
      }
    }
    if (!accepted) break;
    positions.push(accepted);
  }

  return positions.map((position, index): ElasticBallSeed => {
    const velocity = randomDirection(index + 1, seed).multiplyScalar(resolvedSpeed);
    return {
      colorIndex: Math.floor(hashNoise(index * 59 + 17, seed + 47) * 6),
      id: index,
      position: position.toArray() as [number, number, number],
      velocity: velocity.toArray() as [number, number, number],
    };
  });
};

export const getMinimumSeedDistance = (seeds: ElasticBallSeed[]) => {
  let minimum = Number.POSITIVE_INFINITY;
  for (let left = 0; left < seeds.length; left += 1) {
    for (let right = left + 1; right < seeds.length; right += 1) {
      const leftPosition = new THREE.Vector3(...seeds[left]!.position);
      const rightPosition = new THREE.Vector3(...seeds[right]!.position);
      minimum = Math.min(minimum, leftPosition.distanceTo(rightPosition));
    }
  }
  return minimum;
};
