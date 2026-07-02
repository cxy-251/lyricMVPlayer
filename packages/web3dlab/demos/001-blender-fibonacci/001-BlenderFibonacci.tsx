import { useEffect, useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, useAnimations } from '@react-three/drei';
import { useControls, button, folder } from 'leva';
import * as THREE from 'three';

import { DemoScene } from '../../core/DemoScene';

import fibonacciOrbGlbUrl from './assets/fibonacci_orb.glb?url';

function FibonacciModel({ 
  speed, 
  isPaused, 
  resetKey, 
  particleColor, 
  emissiveIntensity,
  metalness,
  roughness,
  isPoints,
  highlightSpiral
}: { 
  speed: number; 
  isPaused: boolean; 
  resetKey: number;
  particleColor: string;
  emissiveIntensity: number;
  metalness: number;
  roughness: number;
  isPoints: boolean;
  highlightSpiral: number;
}) {
  const { scene, animations } = useGLTF(fibonacciOrbGlbUrl);
  const outerRef = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(animations, outerRef);
  const { camera, controls } = useThree();

  useEffect(() => {
    Object.values(actions).forEach(action => {
      if (action) {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
      }
    });

    return () => {
      Object.values(actions).forEach(action => {
        if (action) {
          action.stop();
        }
      });
    };
  }, [actions]);

  // Create a stunning premium material function
  const createMaterial = (hue: number | null) => {
    const finalColor = hue !== null 
      ? new THREE.Color().setHSL(hue, 1.0, 0.6)
      : new THREE.Color(particleColor);
      
    if (isPoints) {
      return new THREE.PointsMaterial({
        color: finalColor,
        size: 0.05,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true,
      });
    }
    return new THREE.MeshPhysicalMaterial({
      color: finalColor,
      emissive: finalColor,
      emissiveIntensity: emissiveIntensity,
      roughness: roughness,
      metalness: metalness,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide
    });
  };

  useEffect(() => {
    // Apply material dynamically, caching materials for each hue
    const materialCache = new Map<number | null, THREE.Material>();
    const getMat = (hue: number | null) => {
      if (!materialCache.has(hue)) {
        materialCache.set(hue, createMaterial(hue));
      }
      return materialCache.get(hue)!;
    };

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh || (child as THREE.Points).isPoints) {
        let hue: number | null = null;
        // Parse the index from the mesh name (e.g., "fib_orb_0123")
        if (highlightSpiral > 0 && child.name.startsWith('fib_orb_')) {
          const idxStr = child.name.replace('fib_orb_', '');
          const idx = parseInt(idxStr, 10);
          if (!isNaN(idx)) {
            const spiralArmIndex = idx % highlightSpiral;
            hue = spiralArmIndex / highlightSpiral;
          }
        }
        (child as THREE.Mesh).material = getMat(hue);
      }
    });
  }, [scene, particleColor, emissiveIntensity, metalness, roughness, isPoints, highlightSpiral]);

  useEffect(() => {
    if (resetKey > 0) {
      camera.position.set(6, 14, 10);
      if (controls) {
        // @ts-ignore: target is a valid property on OrbitControls
        controls.target.set(0, 0, 0);
        // @ts-ignore: update is a valid method on OrbitControls
        controls.update();
      }
    }
  }, [resetKey, camera, controls]);

  useEffect(() => {
    if (mixer) {
      mixer.timeScale = isPaused ? 0 : speed;
    }
  }, [mixer, isPaused, speed]);

  // Add an organic floating effect combined with the rotation
  useFrame((state, delta) => {
    if (!outerRef.current || isPaused) return;
    outerRef.current.rotation.y += delta * 0.15 * speed;
    outerRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5 * speed) * 0.5;
  });

  return (
    <group ref={outerRef}>
      <primitive object={scene} />
    </group>
  );
}

export default function Demo001BlenderFibonacci() {
  const { showStats } = useControls('Debug', { showStats: false });
  const [resetKey, setResetKey] = useState(0);

  const { 
    speed, 
    isPaused, 
    bloomIntensity, 
    highlightSpiral,
    particleColor, 
    emissiveIntensity,
    metalness,
    roughness,
    bgColor,
    isPoints
  } = useControls('Fibonacci Controls', {
    Fibonacci_Math: folder({
      highlightSpiral: { options: { 'None (Gradient)': 0, '8 Arms': 8, '13 Arms': 13, '21 Arms': 21, '34 Arms': 34, '55 Arms': 55, '89 Arms': 89 }, value: 34 },
    }),
    Animation: folder({
      speed: { value: 1.0, min: 0.1, max: 5.0, step: 0.1 },
      isPaused: false,
    }),
    Aesthetics: folder({
      bgColor: { value: '#010205' },
      particleColor: { value: '#00ffff' },
      emissiveIntensity: { value: 2.0, min: 0, max: 10, step: 0.1 },
      metalness: { value: 0.8, min: 0, max: 1, step: 0.01 },
      roughness: { value: 0.2, min: 0, max: 1, step: 0.01 },
      bloomIntensity: { value: 1.5, min: 0, max: 5, step: 0.1 },
      isPoints: false,
    }),
    'Reset Camera': button(() => {
      setResetKey(k => k + 1);
    }),
  });

  return (
    <DemoScene
      debug={showStats}
      engineConfig={{
        background: bgColor,
        camera: { fov: 50, far: 200, near: 0.1, position: [6, 14, 10] },
        bloom: { intensity: bloomIntensity, luminanceThreshold: 0.1, luminanceSmoothing: 0.8 },
      }}
      orbitControls={true}
      orbitConfig={{
        enablePan: true,
        enableZoom: true,
        minDistance: 3,
        maxDistance: 50,
      }}
    >
      {/* Add subtle environmental reflections for the metallic material to catch */}
      <Environment preset="city" environmentIntensity={0.2} />
      <FibonacciModel 
        speed={speed} 
        isPaused={isPaused} 
        resetKey={resetKey} 
        particleColor={particleColor}
        emissiveIntensity={emissiveIntensity}
        metalness={metalness}
        roughness={roughness}
        isPoints={isPoints}
        highlightSpiral={highlightSpiral}
      />
    </DemoScene>
  );
}

useGLTF.preload(fibonacciOrbGlbUrl);
