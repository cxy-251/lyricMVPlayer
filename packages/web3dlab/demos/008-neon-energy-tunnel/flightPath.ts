import * as THREE from 'three';

export const FLIGHT_PATH_SEGMENTS = 620;

export type FlightPathData = {
  curve: THREE.CatmullRomCurve3;
  frames: ReturnType<THREE.CatmullRomCurve3['computeFrenetFrames']>;
  length: number;
  segments: number;
};

export function createFlightPathData(segments = FLIGHT_PATH_SEGMENTS): FlightPathData {
  const controlPointCount = 18;
  const controlPoints = Array.from({length: controlPointCount}, (_, index) => {
    const angle = index / controlPointCount * Math.PI * 2;
    const radius = 44 + Math.sin(angle * 3) * 8 + Math.cos(angle * 5) * 4;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle * 2) * 16 + Math.cos(angle * 4) * 4,
      Math.sin(angle) * radius,
    );
  });
  const curve = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal', 0.45);
  return {
    curve,
    frames: curve.computeFrenetFrames(segments, true),
    length: curve.getLength(),
    segments,
  };
}

export function getFlightFrameIndex(path: FlightPathData, progress: number) {
  const wrappedProgress = ((progress % 1) + 1) % 1;
  return Math.min(path.segments, Math.floor(wrappedProgress * path.segments));
}
