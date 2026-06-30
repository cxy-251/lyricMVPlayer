import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type ResonanceControls = {
  driveFrequency: number;
  damping: number;
  gain: number;
  slowMotion: number;
  showSweep: boolean;
};

type PendulumDatum = {
  x: number;
  length: number;
  naturalFrequency: number;
  phase: number;
  color: string;
};

const PENDULUM_COUNT = 17;

const makePendulums = (): PendulumDatum[] => Array.from({length: PENDULUM_COUNT}, (_, index) => {
  const ratio = index / (PENDULUM_COUNT - 1);
  return {
    x: (index - (PENDULUM_COUNT - 1) / 2) * 0.42,
    length: 1.0 + ratio * 2.15,
    naturalFrequency: 0.42 + ratio * 1.54,
    phase: ratio * Math.PI * 0.35,
    color: `hsl(${190 + ratio * 140}, 90%, ${54 + Math.sin(ratio * Math.PI) * 12}%)`,
  };
});

const getAmplitude = (controls: ResonanceControls, naturalFrequency: number) => {
  const drive = Math.max(0.05, controls.driveFrequency);
  const damping = Math.max(0.015, controls.damping);
  const stiffnessGap = naturalFrequency * naturalFrequency - drive * drive;
  const denominator = Math.sqrt(stiffnessGap * stiffnessGap + Math.pow(2 * damping * drive, 2));
  return Math.min(0.78, (controls.gain * 0.095) / Math.max(0.065, denominator));
};

function Pendulum({datum, controls}: {datum: PendulumDatum; controls: ResonanceControls}) {
  const swingRef = useRef<THREE.Group>(null);
  const bobMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const color = useMemo(() => new THREE.Color(datum.color), [datum.color]);
  const hotColor = useMemo(() => new THREE.Color('#fff4b8'), []);

  useFrame((state) => {
    const swing = swingRef.current;
    if (!swing) return;

    const amplitude = getAmplitude(controls, datum.naturalFrequency);
    const time = state.clock.elapsedTime * controls.slowMotion;
    swing.rotation.z = amplitude * Math.sin(time * controls.driveFrequency * Math.PI * 2 + datum.phase);

    if (bobMaterialRef.current) {
      const resonance = Math.min(1, amplitude / 0.72);
      bobMaterialRef.current.color.copy(color).lerp(hotColor, resonance * 0.46);
      bobMaterialRef.current.emissive.copy(color);
      bobMaterialRef.current.emissiveIntensity = 0.08 + resonance * 0.86;
    }
  });

  const sweepHeight = Math.max(0.08, getAmplitude(controls, datum.naturalFrequency) * 2.4);

  return (
    <group position={[datum.x, 1.45, 0]}>
      <mesh>
        <sphereGeometry args={[0.035, 12, 8]} />
        <meshBasicMaterial color="#d7e7ff" />
      </mesh>

      {controls.showSweep ? (
        <mesh position={[0, -3.45 + sweepHeight * 0.5, -0.28]}>
          <boxGeometry args={[0.11, sweepHeight, 0.035]} />
          <meshBasicMaterial color={datum.color} transparent opacity={0.42} />
        </mesh>
      ) : null}

      <group ref={swingRef}>
        <mesh position={[0, -datum.length / 2, 0]}>
          <cylinderGeometry args={[0.01, 0.01, datum.length, 8]} />
          <meshStandardMaterial color="#d9e7ff" metalness={0.45} roughness={0.32} />
        </mesh>
        <mesh position={[0, -datum.length, 0]}>
          <sphereGeometry args={[0.105, 24, 16]} />
          <meshStandardMaterial ref={bobMaterialRef} color={datum.color} metalness={0.42} roughness={0.24} />
        </mesh>
      </group>
    </group>
  );
}

function PendulumLab({controls}: {controls: ResonanceControls}) {
  const pendulums = useMemo(makePendulums, []);
  const driveRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!driveRef.current) return;
    driveRef.current.position.x = Math.sin(state.clock.elapsedTime * controls.driveFrequency * Math.PI * 2) * 0.16;
  });

  return (
    <group>
      <group ref={driveRef}>
        <mesh position={[0, 1.52, 0]}>
          <boxGeometry args={[7.4, 0.07, 0.09]} />
          <meshStandardMaterial color="#c6dcff" metalness={0.58} roughness={0.22} />
        </mesh>
        <mesh position={[0, 1.65, -0.04]}>
          <boxGeometry args={[7.72, 0.018, 0.035]} />
          <meshBasicMaterial color="#7ef5ff" transparent opacity={0.72} />
        </mesh>
      </group>

      <mesh position={[0, -2.16, -0.34]}>
        <boxGeometry args={[7.8, 0.04, 0.08]} />
        <meshBasicMaterial color="#243047" transparent opacity={0.7} />
      </mesh>

      {pendulums.map((datum) => (
        <Pendulum key={datum.naturalFrequency} datum={datum} controls={controls} />
      ))}
    </group>
  );
}

export default function Demo029ResonancePendulumLab() {
  const controls = useControls('Resonance Pendulum Lab', {
    driveFrequency: {value: 0.94, min: 0.25, max: 2.2, step: 0.01},
    damping: {value: 0.12, min: 0.02, max: 0.7, step: 0.01},
    gain: {value: 1.12, min: 0.2, max: 2.4, step: 0.01},
    slowMotion: {value: 0.82, min: 0.2, max: 1.6, step: 0.01},
    showSweep: true,
  }) as ResonanceControls;

  return (
    <DemoScene
      engineConfig={{
        background: '#03050b',
        camera: {position: [0, 0.15, 8.4], fov: 42, near: 0.1, far: 35},
        bloom: {intensity: 0.95, luminanceSmoothing: 0.48, luminanceThreshold: 0.18},
        vignette: {darkness: 0.5, offset: 0.25},
      }}
      orbitConfig={{enableZoom: true, minDistance: 5, maxDistance: 12}}
    >
      <ambientLight intensity={0.42} />
      <pointLight position={[0, 3.5, 4.8]} intensity={2.4} color="#bfe9ff" />
      <pointLight position={[-3.8, -1.2, 3.2]} intensity={1.6} color="#ff56c7" />
      <PendulumLab controls={controls} />
    </DemoScene>
  );
}
