import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Environment, useAnimations, Clone } from '@react-three/drei';
import { useControls } from 'leva';
import * as THREE from 'three';

import { DemoScene } from '../../core/DemoScene';
import fibonacciOrbGlbUrl from './assets/fibonacci_orb.glb?url';

const SPEED_PRESETS = {
  '0.03 - almost still': 0.03,
  '0.05 - slow breath': 0.05,
  '0.08 - soft rise': 0.08,
  '0.10 - default flow': 0.1,
  '0.16 - visible flow': 0.16,
  '0.24 - active flow': 0.24,
  '0.36 - fast flow': 0.36,
  '0.60 - max readable': 0.6,
};

function clampSpeed(value: number) {
  if (!Number.isFinite(value)) return 0.1;
  return Math.min(0.6, Math.max(0.03, value));
}

function BlenderModel({ speed, isPaused }: { speed: number; isPaused: boolean }) {
  const { scene, animations } = useGLTF(fibonacciOrbGlbUrl);
  const outerRef = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(animations, outerRef);

  useEffect(() => {
    Object.values(actions).forEach(action => {
      if (action) {
        action.play();
      }
    });
  }, [actions]);

  useEffect(() => {
    if (mixer) {
      mixer.timeScale = isPaused ? 0 : speed;
    }
  }, [mixer, isPaused, speed]);

  useFrame((_state, delta) => {
    if (!outerRef.current || isPaused) return;
    outerRef.current.rotation.y += delta * 0.15 * speed;
  });

  return (
    <group ref={outerRef} position={[0, -4, 0]} scale={0.78}>
      <Clone object={scene} />
    </group>
  );
}

export default function Demo001BlenderFibonacci() {
  const [speed, setSpeed] = useState(0.1);
  const [isPaused, setIsPaused] = useState(false);

  useControls('Animation', {
    speed: { value: 0.1, options: SPEED_PRESETS, onChange: (v) => setSpeed(clampSpeed(v)) },
    isPaused: { value: false, onChange: (v) => setIsPaused(v) }
  });

  return (
    <DemoScene
      engineConfig={{
        background: '#010205',
        camera: { fov: 52, far: 200, near: 0.1, position: [8, 18, 20] },
        bloom: { intensity: 0.9, luminanceThreshold: 0.28, luminanceSmoothing: 0.8 },
      }}
      orbitControls={true}
      orbitConfig={{
        enablePan: true,
        enableZoom: true,
        minDistance: 3,
        maxDistance: 80,
      }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 15, 10]} intensity={3.5} color="#fff0dd" castShadow />
      <directionalLight position={[-10, 5, -10]} intensity={1.2} color="#aaccff" />
      <Environment preset="city" environmentIntensity={1.0} />
      <BlenderModel speed={speed} isPaused={isPaused} />
    </DemoScene>
  );
}

useGLTF.preload(fibonacciOrbGlbUrl);
