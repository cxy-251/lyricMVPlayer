import {useControls} from 'leva';
import {useMemo} from 'react';
import * as THREE from 'three';

import {AutoShaderMaterial} from '../../core/AutoShaderMaterial';
import {DemoScene} from '../../core/DemoScene';
import simplex3d from '../../shaders/includes/simplex3d.glsl?raw';
import cosmicNebulaVert from './shaders/cosmicNebula.vert?raw';
import cosmicNebulaFrag from './shaders/cosmicNebula.frag?raw';

const PARTICLE_COUNT = 180000;
const FILAMENT_COUNT = 5;

function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function CurlFluidVolume({controls}: {controls: any}) {

  // Generate readable nebula filaments instead of an opaque uniform particle fog.
  const positions = useMemo(() => {
    const rand = seededRandom(606);
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const arm = Math.floor(rand() * FILAMENT_COUNT);
      const radius = Math.pow(rand(), 0.62) * 7.2;
      const angle = radius * 1.14 + (arm / FILAMENT_COUNT) * Math.PI * 2 + (rand() - 0.5) * 0.48;
      const tube = 0.12 + radius * 0.045;
      const bandLift = Math.sin(angle * 1.8 + arm * 0.7) * (0.22 + radius * 0.035);
      const vertical = (rand() + rand() + rand() - 1.5) * tube * 1.6 + bandLift;
      const lateral = (rand() + rand() + rand() - 1.5) * tube;
      const depth = (rand() + rand() + rand() - 1.5) * tube * 1.9;

      pos[i * 3] = Math.cos(angle) * radius + Math.cos(angle + Math.PI * 0.5) * lateral;
      pos[i * 3 + 1] = vertical;
      pos[i * 3 + 2] = Math.sin(angle) * radius * 0.62 + Math.sin(angle + Math.PI * 0.5) * lateral + depth;
    }
    return pos;
  }, []);

  return (
    <group rotation={[0.18, -0.28, -0.06]}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <AutoShaderMaterial
          controls={controls}
          vertexShader={cosmicNebulaVert.replace('#include <simplex3d>', simplex3d)}
          fragmentShader={cosmicNebulaFrag}
          transparent={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending} // Gas physics require additive!
        />
      </points>
    </group>
  );
}

function HolographicScene({controls}: {controls: any}) {
  return (
    <DemoScene
      engineConfig={{
        background: '#010005', // Deep space
        camera: {fov: 42, far: 50, near: 0.1, position: [0, 0.25, 12.5]},
        bloom: { intensity: controls.bloomIntensity, luminanceThreshold: 0.18, luminanceSmoothing: 0.62 } // Particle cores glow, but filaments stay readable
      }}
      orbitConfig={{
        enablePan: true,
        autoRotate: true,
        autoRotateSpeed: 0.18,
      }}
    >
      <CurlFluidVolume controls={controls} />
    </DemoScene>
  );
}

/**
 * Ethereal Cosmic Fluid Demo
 */
export default function Demo006CosmicNebula() {
  const fluidControls = useControls('Ethereal Cosmic Fluid', {
    noiseScale: { value: 0.18, min: 0.04, max: 0.55, step: 0.01 },
    flowSpeed: { value: 0.18, min: 0.0, max: 0.65, step: 0.01 },
    twist: { value: 0.35, min: 0.0, max: 1.4, step: 0.05 },
    opacity: { value: 0.18, min: 0.02, max: 0.32, step: 0.005 },
    particleSize: { value: 3.6, min: 1.2, max: 7.0, step: 0.1 },
    ribbonLength: { value: 1.15, min: 0.0, max: 3.2, step: 0.05 },
    bloomIntensity: { value: 1.55, min: 0.0, max: 3.0, step: 0.1 },
    color1: '#ff0055', // Deep Magenta / Crimson
    color2: '#00ffee', // Bright Cyan / Teal
  });

  return <HolographicScene controls={fluidControls} />;
}
