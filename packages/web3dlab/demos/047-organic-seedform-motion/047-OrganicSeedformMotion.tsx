import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type PhyllotaxisControls = {
  seedCount: number;
  divergenceAngle: number;
  growthRate: number;
  domeHeight: number;
  kernelScale: number;
  colorSpread: number;
};

function PhyllotaxisHead({controls, paused, progressRef}: {
  controls: PhyllotaxisControls;
  paused: boolean;
  progressRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!meshRef.current) return;
    const color = new THREE.Color();
    for (let index = 0; index < controls.seedCount; index++) {
      const t = index / Math.max(1, controls.seedCount - 1);
      color.setHSL(0.09 + t * controls.colorSpread * 0.22, 0.72, 0.48 + t * 0.16);
      meshRef.current.setColorAt(index, color);
    }
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [controls.colorSpread, controls.seedCount]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!paused) progressRef.current = Math.min(1, progressRef.current + delta * controls.growthRate);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const angleStep = THREE.MathUtils.degToRad(controls.divergenceAngle);
    for (let index = 0; index < controls.seedCount; index++) {
      const t = index / Math.max(1, controls.seedCount - 1);
      const angle = index * angleStep;
      const radius = Math.sqrt(t) * 2.18;
      const reveal = THREE.MathUtils.smoothstep(progressRef.current, t * 0.92, t * 0.92 + 0.08);
      const dome = controls.domeHeight * (1 - t) * (1 - t);
      position.set(Math.cos(angle) * radius, dome, Math.sin(angle) * radius);
      euler.set(-0.32 - t * 0.5, -angle, Math.sin(angle * 0.5) * 0.08);
      quaternion.setFromEuler(euler);
      const size = controls.kernelScale * (0.68 + t * 0.48) * reveal;
      scale.set(size * 0.72, size * 0.32, size * 1.35);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.055;
  });

  return (
    <group ref={groupRef} rotation={[0.16, 0, -0.08]}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, controls.seedCount]} frustumCulled={false}>
        <sphereGeometry args={[0.12, 12, 8]} />
        <meshStandardMaterial metalness={0.12} roughness={0.4} vertexColors />
      </instancedMesh>
      <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.24, 96]} />
        <meshStandardMaterial color="#18251d" metalness={0.1} roughness={0.76} />
      </mesh>
    </group>
  );
}

export default function Demo047OrganicSeedformMotion() {
  const progressRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const controls = useControls('Phyllotaxis Growth', {
    seedCount: {value: 1400, min: 300, max: 2400, step: 100, label: 'Kernel count'},
    divergenceAngle: {value: 137.508, min: 130, max: 145, step: 0.01, label: 'Divergence angle'},
    growthRate: {value: 0.12, min: 0.035, max: 0.28, step: 0.005, label: 'Growth rate'},
    domeHeight: {value: 0.86, min: 0, max: 1.4, step: 0.01, label: 'Head curvature'},
    kernelScale: {value: 0.82, min: 0.45, max: 1.2, step: 0.01, label: 'Kernel scale'},
    colorSpread: {value: 0.62, min: 0, max: 1, step: 0.01, label: 'Maturation color'},
  }) as PhyllotaxisControls;

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#07100c'}}>
      <DemoScene
        engineConfig={{
          background: '#07100c',
          bloom: {intensity: 0.22, luminanceSmoothing: 0.68, luminanceThreshold: 0.7},
          camera: {position: [3.8, 3.7, 5.2], fov: 42, near: 0.1, far: 30},
          fog: {color: '#07100c', near: 9, far: 17},
          vignette: {darkness: 0.5, offset: 0.28},
        }}
        orbitConfig={{autoRotate: false, enablePan: false, minDistance: 4.8, maxDistance: 10}}
      >
        <ambientLight intensity={0.42} />
        <directionalLight color="#fff0c4" intensity={2.2} position={[3, 5, 4]} />
        <pointLight color="#72d89a" intensity={0.7} position={[-3, 1, 2]} />
        <PhyllotaxisHead controls={controls} paused={paused} progressRef={progressRef} />
      </DemoScene>
      <div style={growthControlsStyle}>
        <button onClick={() => setPaused(value => !value)} style={buttonStyle} type="button">{paused ? 'Resume' : 'Pause'}</button>
        <button onClick={() => { progressRef.current = 0; setPaused(false); }} style={buttonStyle} type="button">Replay growth</button>
        <span>golden angle 137.508°</span>
      </div>
    </div>
  );
}

const growthControlsStyle = {
  position: 'absolute', left: '50%', bottom: 18, display: 'flex', alignItems: 'center', gap: 9,
  transform: 'translateX(-50%)', padding: 7, border: '1px solid rgba(238,194,100,0.18)',
  borderRadius: 7, background: 'rgba(7,16,12,0.82)', color: '#a89c79',
  fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10,
} as const;

const buttonStyle = {
  border: '1px solid rgba(238,194,100,0.28)', borderRadius: 5, background: 'rgba(238,194,100,0.08)',
  color: '#e8dcb9', cursor: 'pointer', padding: '7px 9px', font: 'inherit', fontWeight: 700,
} as const;
