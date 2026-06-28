import * as THREE from "three";

export const createStageDisc = ({
  color,
  opacity,
  radius,
  x = 0,
  y = 0,
  z = 0,
  rotationX = -Math.PI / 2,
  scaleX = 1,
  scaleY = 1,
  segments = 48,
  additive = false,
}: {
  additive?: boolean;
  color: number;
  opacity: number;
  radius: number;
  rotationX?: number;
  scaleX?: number;
  scaleY?: number;
  segments?: number;
  x?: number;
  y?: number;
  z?: number;
}) => {
  const geometry = new THREE.CircleGeometry(radius, segments);
  const material = new THREE.MeshBasicMaterial({
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    color,
    depthWrite: false,
    opacity,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = rotationX;
  mesh.position.set(x, y, z);
  mesh.scale.set(scaleX, scaleY, 1);

  return {
    geometry,
    material,
    mesh,
  } as const;
};
