import {useControls} from 'leva';
import {useMemo} from 'react';
import * as THREE from 'three';

import {AutoShaderMaterial} from '../../core/AutoShaderMaterial';
import {DemoScene} from '../../core/DemoScene';
import simplex3d from '../../shaders/includes/simplex3d.glsl?raw';
import cosmicNebulaVert from './shaders/cosmicNebula.vert?raw';
import cosmicNebulaFrag from './shaders/cosmicNebula.frag?raw';

const PARTICLE_COUNT = 600000;

function CurlFluidVolume({controls}: {controls: any}) {

  // Generate a massive 3D volume of particles in a sphere
  const positions = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Uniform random point in a sphere using spherical coords
      const u = Math.random();
      const v = Math.random();
      const theta = 2.0 * Math.PI * u;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 8.0; // Fill an 8.0 radius sphere uniformly

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  return (
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
  );
}

function HolographicScene({debug, controls}: {debug: boolean; controls: any}) {
  return (
    <DemoScene
      debug={debug}
      engineConfig={{
        background: '#010005', // Deep space
        camera: {fov: 45, far: 50, near: 0.1, position: [0, 0, 15]}, 
        bloom: { intensity: 1.0, luminanceThreshold: 0.2, luminanceSmoothing: 0.8 } // Smooth volume glow
      }}
      orbitConfig={{
        enablePan: true,
      }}
    >
      <CurlFluidVolume controls={controls} />
    </DemoScene>
  );
}

/**
 * Cosmic Nebula Demo (Webb Telescope Edition)
 */
export default function Demo006CosmicNebula() {
  const {showStats} = useControls('Debug', {showStats: false});
  const fluidControls = useControls('Fluid Dynamics', {
    noiseScale: { value: 0.2, min: 0.01, max: 1.0, step: 0.01 },
    flowSpeed: { value: 0.15, min: 0.0, max: 1.0, step: 0.01 },
    twist: { value: 0.5, min: 0.0, max: 3.0, step: 0.1 },
    particleSize: { value: 3.0, min: 0.1, max: 10.0, step: 0.1 }, 
    color1: '#ff0055', // Deep Magenta / Crimson
    color2: '#00ffee', // Bright Cyan / Teal
  });

  return <HolographicScene debug={showStats} controls={fluidControls} />;
}
