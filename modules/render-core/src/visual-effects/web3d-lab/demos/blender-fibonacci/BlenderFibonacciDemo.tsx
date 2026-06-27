import { useEffect, useRef, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Center, Environment } from '@react-three/drei';
import { useControls } from 'leva';
import * as THREE from 'three';

import { DemoScene } from '../../core/DemoScene';

function FibonacciModel({ speed, isPaused }: { speed: number; isPaused: boolean }) {
  const { scene } = useGLTF('/models/fibonacci_orb.glb');
  const outerRef = useRef<THREE.Group>(null);

  useFrame((_state, delta) => {
    if (!outerRef.current || isPaused) return;
    outerRef.current.rotation.y += delta * 0.15 * speed;
  });

  return (
    <group ref={outerRef}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

function KeyboardControls({ setSpeed, setIsPaused }: {
  setSpeed: React.Dispatch<React.SetStateAction<number>>;
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { camera, controls } = useThree();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setIsPaused(p => !p);
          break;
        case 'KeyR':
          camera.position.set(6, 14, 10);
          if (controls) {
            // @ts-ignore: target is a valid property on OrbitControls
            controls.target.set(0, 0, 0);
            // @ts-ignore: update is a valid method on OrbitControls
            controls.update();
          }
          break;
        case 'Digit1': setSpeed(0.5); break;
        case 'Digit2': setSpeed(1.0); break;
        case 'Digit3': setSpeed(2.0); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [camera, controls, setSpeed, setIsPaused]);

  return null;
}

export default function BlenderFibonacciDemo() {
  const { showStats } = useControls('Debug', { showStats: false });
  const [speed, setSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  return (
    <DemoScene
      debug={showStats}
      engineConfig={{
        background: '#060810',
        camera: { fov: 50, far: 200, near: 0.1, position: [6, 14, 10] },
        bloom: { intensity: 0.1, luminanceThreshold: 0.2, luminanceSmoothing: 0.2 },
      }}
      orbitControls={true}
      orbitConfig={{
        enablePan: true,
        enableZoom: true,
        minDistance: 3,
        maxDistance: 50,
      }}
    >
      {/* <Environment preset="city" /> */}
      {/* <ambientLight intensity={0.1} /> */}
      {/* <directionalLight position={[5, 15, 8]} intensity={1.5} castShadow /> */}
      {/* <pointLight position={[-5, 3, -5]} intensity={100} color="#3388ff" distance={50} /> */}
      <FibonacciModel speed={speed} isPaused={isPaused} />
      <KeyboardControls setSpeed={setSpeed} setIsPaused={setIsPaused} />
    </DemoScene>
  );
}

useGLTF.preload('/models/fibonacci_orb.glb');
