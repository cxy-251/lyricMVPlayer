import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {Environment} from '@react-three/drei';

import {DemoScene} from '../../core/DemoScene';

const BASE_PARTICLE_COUNT = 200000;
const CITY_SIZE = 120.0;

import vertexShader from './vertex.glsl?raw';
import fragmentShader from './fragment.glsl?raw';

function MatrixCity({controls}: {controls: any}) {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  const [geometry] = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const particleCount = Math.floor(BASE_PARTICLE_COUNT * controls.gridDensity);
    const pos = new Float32Array(particleCount * 3);
    const rnd = new Float32Array(particleCount);

    // Seeded random for consistent city generation
    const m = Math as any;
    m.seedrandom = function(s: number) {
      return function() { s = Math.sin(s) * 10000; return s - Math.floor(s); };
    };
    const random = m.seedrandom(12345);

    for (let i = 0; i < particleCount; i++) {
      const x = (random() - 0.5) * CITY_SIZE;
      const z = (random() - 0.5) * CITY_SIZE;

      // Grid-based building height generation (Matrix Grid)
      // Higher gridDensity creates a tighter matrix
      const gridSpacing = 1.5;
      const gridX = Math.floor(x * gridSpacing);
      const gridZ = Math.floor(z * gridSpacing);
      const buildingRand = Math.abs((Math.sin(gridX * 12.9898 + gridZ * 78.233) * 43758.5453) % 1.0);

      // Skyscrapers are rare but very tall
      const maxHeight = Math.pow(buildingRand, 4.0) * 50.0 + 1.0;
      const y = random() * maxHeight;

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      rnd[i] = random();
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aRandom', new THREE.BufferAttribute(rnd, 1));
    return [geo];
  }, [controls.gridDensity]); // Rebuild when density changes

  useFrame((state) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      shaderRef.current.uniforms.uScanColor.value.set(controls.scanColor);
      shaderRef.current.uniforms.uScanSpeed.value = controls.scanSpeed;
      shaderRef.current.uniforms.uScanWidth.value = controls.scanWidth;
      shaderRef.current.uniforms.uTransmission.value = controls.transmission;
    }
  });

  return (
    <points>
      <bufferGeometry attach="geometry" {...geometry} />
      <shaderMaterial
        ref={shaderRef}
        attach="material"
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uScanColor: { value: new THREE.Color(controls.scanColor) },
          uScanSpeed: { value: controls.scanSpeed },
          uScanWidth: { value: controls.scanWidth },
          uTransmission: { value: controls.transmission },
          uCameraPos: { value: new THREE.Vector3() }
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </points>
  );
}

function HolographicScene({controls}: {controls: any}) {
  return (
    <DemoScene
      engineConfig={{
        background: '#000205',
        camera: {fov: 50, far: 150, near: 0.1, position: [0, 15, 60]},
        bloom: { intensity: 1.8, luminanceThreshold: 0.1, luminanceSmoothing: 0.8 },
      }}
      orbitConfig={{
        enablePan: true,
        autoRotate: controls.autoRotate ?? false,
        autoRotateSpeed: 0.5,
        maxDistance: 120,
      }}
    >
      <MatrixCity controls={controls} />
    </DemoScene>
  );
}

export default function Demo() {
  const cityControls = useControls('Cyber Matrix Scanner', {
    autoRotate: true,
    scanColor: '#00ffff',
    scanSpeed: { value: 35.0, min: 0.0, max: 150.0, step: 1.0 },
    scanWidth: { value: 2.0, min: 0.1, max: 10.0, step: 0.1 },
    gridDensity: { value: 2.5, min: 0.5, max: 5.0, step: 0.1 },
    transmission: { value: 0.2, min: 0.0, max: 1.0, step: 0.05 },
  });

  return <HolographicScene controls={cityControls} />;
}
