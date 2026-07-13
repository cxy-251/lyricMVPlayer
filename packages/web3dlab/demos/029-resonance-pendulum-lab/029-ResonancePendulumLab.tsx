import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type ResonanceControls = {
  driveFrequency: number;
  driveStrength: number;
  dampingRatio: number;
  timeScale: number;
  frequencySweep: boolean;
  sweepPeriod: number;
  responseBars: boolean;
};

type PendulumDatum = {
  x: number;
  length: number;
  naturalFrequency: number;
  color: string;
};

const PENDULUM_COUNT = 17;
const EFFECTIVE_GRAVITY = 64;
const MIN_DRIVE_FREQUENCY = 0.55;
const MAX_DRIVE_FREQUENCY = 1.45;

const makePendulums = (): PendulumDatum[] =>
  Array.from({length: PENDULUM_COUNT}, (_, index) => {
    const ratio = index / (PENDULUM_COUNT - 1);
    const length = THREE.MathUtils.lerp(3.05, 1.05, ratio);
    const naturalFrequency = Math.sqrt(EFFECTIVE_GRAVITY / length) / (Math.PI * 2);
    return {
      x: (index - (PENDULUM_COUNT - 1) / 2) * 0.43,
      length,
      naturalFrequency,
      color: `hsl(${188 + ratio * 145}, 88%, ${54 + Math.sin(ratio * Math.PI) * 9}%)`,
    };
  });

const getDriveFrequency = (controls: ResonanceControls, time: number) => {
  if (!controls.frequencySweep) return controls.driveFrequency;
  const phase = (Math.sin((time / controls.sweepPeriod) * Math.PI * 2 - Math.PI / 2) + 1) * 0.5;
  return THREE.MathUtils.lerp(MIN_DRIVE_FREQUENCY, MAX_DRIVE_FREQUENCY, phase);
};

function Pendulum({datum, controls}: {datum: PendulumDatum; controls: ResonanceControls}) {
  const swingRef = useRef<THREE.Group>(null);
  const responseRef = useRef<THREE.Mesh>(null);
  const bobMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const physicsRef = useRef({angle: 0, angularVelocity: 0, response: 0});
  const baseColor = useMemo(() => new THREE.Color(datum.color), [datum.color]);
  const hotColor = useMemo(() => new THREE.Color('#fff1a8'), []);

  useFrame((state, delta) => {
    const swing = swingRef.current;
    if (!swing) return;
    const scaledDelta = Math.min(delta, 0.025) * controls.timeScale;
    const time = state.clock.elapsedTime * controls.timeScale;
    const driveFrequency = getDriveFrequency(controls, time);
    const driveOmega = Math.PI * 2 * driveFrequency;
    const naturalOmega = Math.PI * 2 * datum.naturalFrequency;
    const physics = physicsRef.current;
    const drive = Math.sin(time * driveOmega) * controls.driveStrength;
    const acceleration = drive
      - 2 * controls.dampingRatio * naturalOmega * physics.angularVelocity
      - naturalOmega * naturalOmega * physics.angle;

    physics.angularVelocity += acceleration * scaledDelta;
    physics.angle += physics.angularVelocity * scaledDelta;
    physics.angle = THREE.MathUtils.clamp(physics.angle, -0.9, 0.9);
    physics.response = THREE.MathUtils.damp(
      physics.response,
      Math.min(1, Math.abs(physics.angle) / 0.72),
      5,
      scaledDelta,
    );
    swing.rotation.z = physics.angle;

    if (responseRef.current) {
      const height = 0.04 + physics.response * 0.9;
      responseRef.current.scale.y = height;
      responseRef.current.position.y = -3.36 + height * 0.5;
      responseRef.current.visible = controls.responseBars;
    }

    if (bobMaterialRef.current) {
      const frequencyDistance = Math.abs(driveFrequency - datum.naturalFrequency);
      const resonanceMatch = Math.exp(-frequencyDistance * frequencyDistance * 70);
      const heat = Math.min(1, physics.response * 0.72 + resonanceMatch * physics.response * 0.55);
      bobMaterialRef.current.color.copy(baseColor).lerp(hotColor, heat * 0.58);
      bobMaterialRef.current.emissive.copy(baseColor);
      bobMaterialRef.current.emissiveIntensity = 0.06 + heat * 0.72;
    }
  });

  return (
    <group position={[datum.x, 0, 0]}>
      <mesh>
        <sphereGeometry args={[0.034, 12, 8]} />
        <meshBasicMaterial color="#d7e7ff" />
      </mesh>
      <mesh ref={responseRef} position={[0, -3.34, -0.24]}>
        <boxGeometry args={[0.13, 1, 0.035]} />
        <meshBasicMaterial color={datum.color} opacity={0.46} transparent />
      </mesh>
      <group ref={swingRef}>
        <mesh position={[0, -datum.length / 2, 0]}>
          <cylinderGeometry args={[0.009, 0.009, datum.length, 7]} />
          <meshStandardMaterial color="#b9c8dd" metalness={0.48} roughness={0.34} />
        </mesh>
        <mesh position={[0, -datum.length, 0]}>
          <sphereGeometry args={[0.105, 20, 14]} />
          <meshStandardMaterial
            ref={bobMaterialRef}
            color={datum.color}
            metalness={0.38}
            roughness={0.26}
          />
        </mesh>
      </group>
    </group>
  );
}

function PendulumLab({controls}: {controls: ResonanceControls}) {
  const pendulums = useMemo(makePendulums, []);
  const driveRef = useRef<THREE.Group>(null);
  const indicatorRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime * controls.timeScale;
    const frequency = getDriveFrequency(controls, time);
    const driveOmega = Math.PI * 2 * frequency;
    const displacement = Math.sin(time * driveOmega) * controls.driveStrength * 0.013;
    if (driveRef.current) driveRef.current.position.x = displacement;
    if (indicatorRef.current) {
      const ratio = (frequency - MIN_DRIVE_FREQUENCY)
        / (MAX_DRIVE_FREQUENCY - MIN_DRIVE_FREQUENCY);
      indicatorRef.current.position.x = THREE.MathUtils.lerp(-3.55, 3.55, ratio);
    }
  });

  return (
    <group>
      <group ref={driveRef} position={[0, 1.5, 0]}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[7.5, 0.075, 0.1]} />
          <meshStandardMaterial color="#b9cde7" metalness={0.6} roughness={0.24} />
        </mesh>
        {pendulums.map((datum) => (
          <Pendulum key={datum.naturalFrequency} controls={controls} datum={datum} />
        ))}
      </group>

      <mesh position={[0, -1.94, -0.28]}>
        <boxGeometry args={[7.5, 0.025, 0.05]} />
        <meshBasicMaterial color="#20324c" opacity={0.78} transparent />
      </mesh>
      <mesh ref={indicatorRef} position={[0, -1.94, -0.22]}>
        <sphereGeometry args={[0.07, 16, 10]} />
        <meshBasicMaterial color="#fff0a8" />
      </mesh>
    </group>
  );
}

export default function Demo029ResonancePendulumLab() {
  const controls = useControls('Resonance Pendulum Lab', {
    driveFrequency: {
      value: 0.94,
      min: MIN_DRIVE_FREQUENCY,
      max: MAX_DRIVE_FREQUENCY,
      step: 0.01,
      label: 'Drive frequency',
    },
    driveStrength: {
      value: 5.2,
      min: 1.5,
      max: 8,
      step: 0.1,
      label: 'Drive force',
    },
    dampingRatio: {
      value: 0.075,
      min: 0.025,
      max: 0.22,
      step: 0.005,
      label: 'Damping ratio',
    },
    timeScale: {
      value: 0.82,
      min: 0.35,
      max: 1.15,
      step: 0.01,
      label: 'Simulation speed',
    },
    frequencySweep: {value: false, label: 'Frequency sweep'},
    sweepPeriod: {
      value: 20,
      min: 10,
      max: 36,
      step: 1,
      label: 'Sweep duration',
    },
    responseBars: {value: true, label: 'Response bars'},
  }) as ResonanceControls;

  return (
    <DemoScene
      engineConfig={{
        background: '#03050b',
        bloom: {intensity: 0.48, luminanceSmoothing: 0.5, luminanceThreshold: 0.52},
        camera: {position: [0, 0.1, 8.5], fov: 42, near: 0.1, far: 35},
        vignette: {darkness: 0.42, offset: 0.3},
      }}
      orbitConfig={{enablePan: false, enableZoom: true, minDistance: 6.5, maxDistance: 12}}
    >
      <ambientLight intensity={0.38} />
      <pointLight color="#bfe9ff" intensity={2.1} position={[0, 3.5, 4.8]} />
      <pointLight color="#ff73c9" intensity={1.1} position={[-3.8, -1.2, 3.2]} />
      <PendulumLab controls={controls} />
    </DemoScene>
  );
}
