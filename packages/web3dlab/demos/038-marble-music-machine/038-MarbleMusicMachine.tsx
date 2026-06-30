import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type MarbleControls = {
  tempo: number;
  balls: number;
  glow: number;
  machineTilt: number;
};

type BellDatum = {
  x: number;
  y: number;
  note: string;
  phase: number;
};

const BELLS: BellDatum[] = [
  {x: -2.2, y: 1.1, note: 'C3', phase: 0},
  {x: -1.15, y: 0.25, note: 'E3', phase: 0.18},
  {x: 0.0, y: 0.95, note: 'G3', phase: 0.34},
  {x: 1.1, y: -0.12, note: 'B3', phase: 0.52},
  {x: 2.05, y: 0.72, note: 'D4', phase: 0.72},
  {x: -0.45, y: -0.92, note: 'A3', phase: 0.86},
];

function Bell({datum, controls}: {datum: BellDatum; controls: MarbleControls}) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const glowRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const beat = (state.clock.elapsedTime * controls.tempo * 0.18 + datum.phase) % 1;
    const hit = Math.max(0, 1 - Math.abs(beat - 0.08) * 10);
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = hit * controls.glow;
    }
    if (glowRef.current) {
      glowRef.current.opacity = 0.18 + hit * 0.75;
    }
  });

  return (
    <group position={[datum.x, datum.y, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.3, 0.08, 32]} />
        <meshStandardMaterial ref={materialRef} color="#cfd8dd" metalness={0.75} roughness={0.18} emissive="#ff9c33" emissiveIntensity={0} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshBasicMaterial ref={glowRef} color="#ffd37a" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function Marble({index, total, tempo}: {index: number; total: number; tempo: number}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const offset = index / total;
    const t = (state.clock.elapsedTime * tempo * 0.18 + offset) % 1;
    meshRef.current.position.set(
      -2.6 + t * 5.2,
      1.55 - Math.abs(Math.sin(t * Math.PI * 3 + offset)) * 2.35 + Math.sin(t * Math.PI * 2) * 0.18,
      0.42,
    );
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.085, 24, 16]} />
      <meshStandardMaterial color="#f6f8ff" metalness={0.35} roughness={0.16} emissive="#7de7ff" emissiveIntensity={0.15} />
    </mesh>
  );
}

function Machine({controls}: {controls: MarbleControls}) {
  const groupRef = useRef<THREE.Group>(null);
  const marbles = useMemo(() => Array.from({length: controls.balls}, (_, index) => index), [controls.balls]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, THREE.MathUtils.degToRad(controls.machineTilt), delta * 8);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.1, -0.08]}>
        <boxGeometry args={[5.8, 3.7, 0.08]} />
        <meshStandardMaterial color="#17181c" metalness={0.3} roughness={0.62} />
      </mesh>
      {[-1.2, 0, 1.2].map((y) => (
        <mesh key={y} position={[0, y, 0.08]} rotation={[0, 0, -0.12]}>
          <boxGeometry args={[5.3, 0.035, 0.035]} />
          <meshStandardMaterial color="#8e979c" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      {BELLS.map((datum) => (
        <Bell key={datum.note} datum={datum} controls={controls} />
      ))}
      {marbles.map((index) => (
        <Marble key={index} index={index} total={marbles.length} tempo={controls.tempo} />
      ))}
    </group>
  );
}

export default function Demo038MarbleMusicMachine() {
  const controls = useControls('Marble Music Machine', {
    tempo: {value: 1, min: 0.2, max: 2.6, step: 0.01},
    balls: {value: 7, min: 2, max: 16, step: 1},
    glow: {value: 1.1, min: 0.2, max: 2.5, step: 0.01},
    machineTilt: {value: -3, min: -12, max: 12, step: 0.5},
  }) as MarbleControls;

  return (
    <DemoScene
      engineConfig={{
        background: '#090912',
        camera: {position: [0, 0.1, 6.4], fov: 44, near: 0.1, far: 30},
        bloom: {intensity: 0.8, luminanceSmoothing: 0.5, luminanceThreshold: 0.18},
        vignette: {darkness: 0.55, offset: 0.2},
      }}
      orbitConfig={{enableZoom: true, minDistance: 4, maxDistance: 9}}
    >
      <ambientLight intensity={0.56} />
      <pointLight position={[0, 3.2, 4.2]} intensity={2.5} color="#eef7ff" />
      <pointLight position={[2.8, -1.8, 2.6]} intensity={1.4} color="#ff9c33" />
      <Machine controls={controls} />
    </DemoScene>
  );
}
