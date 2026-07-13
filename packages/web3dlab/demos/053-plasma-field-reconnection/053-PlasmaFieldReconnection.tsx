import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type AttractorSystem = 'lorenz' | 'rossler' | 'thomas';
type AttractorControls = {
  system: AttractorSystem;
  trajectoryCount: number;
  trailLength: number;
  chaos: number;
  integrationSpeed: number;
  rotationSpeed: number;
};

type PathData = {geometry: THREE.BufferGeometry; line: THREE.Line; points: THREE.Vector3[]};

function derivative(system: AttractorSystem, point: THREE.Vector3, parameter: number) {
  if (system === 'rossler') {
    return new THREE.Vector3(-point.y - point.z, point.x + 0.2 * point.y, 0.2 + point.z * (point.x - parameter));
  }
  if (system === 'thomas') {
    return new THREE.Vector3(
      Math.sin(point.y) - parameter * point.x,
      Math.sin(point.z) - parameter * point.y,
      Math.sin(point.x) - parameter * point.z,
    );
  }
  return new THREE.Vector3(
    10 * (point.y - point.x),
    point.x * (parameter - point.z) - point.y,
    point.x * point.y - (8 / 3) * point.z,
  );
}

function mapPoint(system: AttractorSystem, point: THREE.Vector3) {
  if (system === 'rossler') return new THREE.Vector3(point.x * 0.22, point.z * 0.22 - 1.5, point.y * 0.22);
  if (system === 'thomas') return point.clone().multiplyScalar(0.72);
  return new THREE.Vector3(point.x * 0.09, (point.z - 24) * 0.09, point.y * 0.09);
}

function createPaths(controls: AttractorControls): PathData[] {
  const dt = controls.system === 'rossler' ? 0.018 : controls.system === 'thomas' ? 0.055 : 0.006;
  const warmup = controls.system === 'thomas' ? 420 : 700;
  const parameter = controls.system === 'lorenz'
    ? 20 + controls.chaos * 16
    : controls.system === 'rossler'
      ? 4.5 + controls.chaos * 2.5
      : 0.16 + controls.chaos * 0.12;
  return Array.from({length: controls.trajectoryCount}, (_, pathIndex) => {
    const offset = (pathIndex - (controls.trajectoryCount - 1) / 2) * 0.0008;
    let point = controls.system === 'rossler'
      ? new THREE.Vector3(0.1 + offset, 0, 0)
      : controls.system === 'thomas'
        ? new THREE.Vector3(0.12 + offset, 0.08, -0.05)
        : new THREE.Vector3(0.1 + offset, 0, 0);
    const points: THREE.Vector3[] = [];
    for (let step = 0; step < warmup + controls.trailLength; step++) {
      const k1 = derivative(controls.system, point, parameter);
      const k2 = derivative(controls.system, point.clone().addScaledVector(k1, dt * 0.5), parameter);
      const k3 = derivative(controls.system, point.clone().addScaledVector(k2, dt * 0.5), parameter);
      const k4 = derivative(controls.system, point.clone().addScaledVector(k3, dt), parameter);
      point.addScaledVector(k1, dt / 6).addScaledVector(k2, dt / 3).addScaledVector(k3, dt / 3).addScaledVector(k4, dt / 6);
      if (step >= warmup) points.push(mapPoint(controls.system, point));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const hue = 0.5 + pathIndex / Math.max(1, controls.trajectoryCount - 1) * 0.32;
    const material = new THREE.LineBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: new THREE.Color().setHSL(hue, 0.82, 0.62),
      depthWrite: false,
      opacity: 0.16 + pathIndex / controls.trajectoryCount * 0.28,
      transparent: true,
    });
    return {geometry, line: new THREE.Line(geometry, material), points};
  });
}

function AttractorFlow({controls}: {controls: AttractorControls}) {
  const groupRef = useRef<THREE.Group>(null);
  const headsRef = useRef<THREE.InstancedMesh>(null);
  const paths = useMemo(() => createPaths(controls), [controls.chaos, controls.system, controls.trailLength, controls.trajectoryCount]);

  useEffect(() => () => paths.forEach(path => {
    path.geometry.dispose();
    (path.line.material as THREE.Material).dispose();
  }), [paths]);

  useFrame((state, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * controls.rotationSpeed * 0.22;
    if (!headsRef.current) return;
    const matrix = new THREE.Matrix4();
    paths.forEach((path, index) => {
      const sample = Math.floor((state.clock.elapsedTime * controls.integrationSpeed * 90 + index * 31) % path.points.length);
      matrix.makeTranslation(path.points[sample].x, path.points[sample].y, path.points[sample].z);
      headsRef.current?.setMatrixAt(index, matrix);
    });
    headsRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={groupRef} rotation={[-0.12, 0.2, 0]}>
      {paths.map((path, index) => <primitive key={index} object={path.line} />)}
      <instancedMesh ref={headsRef} args={[undefined, undefined, paths.length]}>
        <sphereGeometry args={[0.035, 10, 8]} />
        <meshBasicMaterial color="#e7fbff" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

export default function Demo053PlasmaFieldReconnection() {
  const controls = useControls('Strange Attractor', {
    system: {value: 'lorenz', options: {Lorenz: 'lorenz', Rössler: 'rossler', Thomas: 'thomas'}, label: 'Dynamical system'},
    trajectoryCount: {value: 14, min: 4, max: 26, step: 1, label: 'Nearby trajectories'},
    trailLength: {value: 1300, min: 500, max: 2200, step: 100, label: 'Integration samples'},
    chaos: {value: 0.5, min: 0, max: 1, step: 0.01, label: 'System parameter'},
    integrationSpeed: {value: 0.74, min: 0.15, max: 1.5, step: 0.01, label: 'Tracer speed'},
    rotationSpeed: {value: 0.18, min: 0, max: 0.65, step: 0.01, label: 'Field rotation'},
  }) as AttractorControls;

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#02040a'}}>
      <DemoScene
        engineConfig={{
          background: '#02040a', bloom: {intensity: 0.58, luminanceSmoothing: 0.7, luminanceThreshold: 0.38},
          camera: {position: [0, 0.2, 7], fov: 45, near: 0.1, far: 30}, fog: {color: '#02040a', near: 9, far: 18},
        }}
        orbitConfig={{autoRotate: false, enablePan: false, minDistance: 4.5, maxDistance: 11}}
      >
        <AttractorFlow controls={controls} />
      </DemoScene>
      <div style={attractorLegendStyle}><strong>{controls.system.toUpperCase()}</strong><span>RK4 · nearby initial conditions</span></div>
    </div>
  );
}

const attractorLegendStyle = {
  position: 'absolute', left: 18, bottom: 18, display: 'flex', gap: 10, padding: '8px 10px',
  border: '1px solid rgba(105,207,255,0.18)', borderRadius: 6, background: 'rgba(3,6,13,0.78)',
  color: '#7892a3', pointerEvents: 'none', fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10,
} as const;
