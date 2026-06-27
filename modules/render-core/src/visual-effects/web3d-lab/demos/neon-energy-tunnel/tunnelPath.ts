import * as THREE from 'three';

export const TAU = Math.PI * 2;

export function getTunnelCenter(
  z: number,
  travel: number,
  distortion: number,
  pointer: THREE.Vector2,
  target: THREE.Vector3,
) {
  const depth = Math.abs(z);
  const slowTime = travel * 0.045;
  const curveScale = 0.34 + distortion * 0.42;

  target.set(
    Math.sin(depth * 0.16 + slowTime) * curveScale +
      Math.sin(depth * 0.047 - slowTime * 1.7) * curveScale * 0.75 +
      pointer.x * 0.48,
    Math.cos(depth * 0.13 - slowTime * 0.8) * curveScale * 0.68 +
      Math.sin(depth * 0.055 + slowTime * 1.2) * curveScale * 0.42 +
      pointer.y * 0.34,
    z,
  );

  return target;
}

export function getTunnelRadius(baseRadius: number, z: number, travel: number, distortion: number) {
  const depth = Math.abs(z);
  const wave =
    Math.sin(depth * 0.72 + travel * 0.16) * 0.055 +
    Math.sin(depth * 0.23 - travel * 0.11) * 0.045;
  return baseRadius * (1 + wave * Math.max(distortion, 0.08));
}

export function getWrappedTunnelZ(index: number, spacing: number, travel: number, totalDepth: number) {
  return -totalDepth + ((index * spacing + travel) % totalDepth);
}
