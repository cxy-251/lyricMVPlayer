import {useControls} from 'leva';

import {Web3DEngine} from '../../core/Web3DEngine';
import {ParticleMorphRenderer} from './ParticleMorphRenderer';
import {
  DEFAULT_MORPH_PARTICLE_COUNT,
  MAX_MORPH_PARTICLES,
  MIN_MORPH_PARTICLES,
  MORPH_PARTICLE_STEP,
  type MorphControls,
} from './particleSimulation';

function MorphingScene({controls}: {controls: MorphControls}) {
  return (
    <Web3DEngine
      config={{
        background: '#02030b',
        bloom: {
          intensity: controls.bloomStrength,
          luminanceSmoothing: 0.72,
          luminanceThreshold: 0.16,
        },
        camera: {fov: 45, far: 60, near: 0.1, position: [0, 0.24, 8.2]},
        vignette: {darkness: 0.44, offset: 0.28},
      }}
    >
      <ParticleMorphRenderer
        controls={controls}
      />
    </Web3DEngine>
  );
}

export default function Demo011ParticleMorphingField() {
  const morphControls = useControls('Particle Morphing Field', {
    particleCount: {
      value: DEFAULT_MORPH_PARTICLE_COUNT,
      min: MIN_MORPH_PARTICLES,
      max: MAX_MORPH_PARTICLES,
      step: MORPH_PARTICLE_STEP,
    },
    particleSize: {value: 1.28, min: 0.6, max: 2.6, step: 0.05},
    morphSpeed: {value: 1.05, min: 0.25, max: 2.4, step: 0.05},
    turbulenceStrength: {value: 0.42, min: 0.0, max: 1.2, step: 0.05},
    bloomStrength: {value: 0.95, min: 0.0, max: 1.8, step: 0.05},
  });

  return <MorphingScene controls={morphControls} />;
}
