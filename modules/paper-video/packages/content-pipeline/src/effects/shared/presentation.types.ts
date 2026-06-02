import type * as THREE from "three";

export type OrbitRigInput = {
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  time: number;
  orbitSpeed: number;
  radius: number;
  radiusJitter?: number;
  centerY: number;
  heightJitter?: number;
  lateralJitter?: number;
  targetX?: number;
  targetXJitter?: number;
  targetY?: number;
  targetYJitter?: number;
  targetZ?: number;
  targetZJitter?: number;
};

export type DollyRigInput = {
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  time: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  dollyOffset: number;
  dollyMultiplier: number;
  xDrift?: number;
  yDrift?: number;
  zDrift?: number;
  targetX?: number;
  targetY: number;
  targetZ: number;
  targetXDrift?: number;
  targetYDrift?: number;
  targetZDrift?: number;
};
