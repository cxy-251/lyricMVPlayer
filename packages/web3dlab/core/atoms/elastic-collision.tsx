import {resolveParticleEffectConfig} from '@paper-to-video/content-pipeline';
import React from 'react';

import {ThreeParticleEffect} from '../../demos/024-paper-three-particle/024-PaperThreeParticle';
import {Web3DEngine} from '../Web3DEngine';
import type {EffectAtomRuntimeProps, EffectControlDefinition} from '../simulations/types';

const PARTICLE_EFFECT_CONTROLS: EffectControlDefinition[] = [
  {id: 'collision-count', kind: 'range', label: 'Ball Count', description: 'Controls the number of elastic bodies.', section: 'particleEffect', field: 'particleCount', min: 6, max: 48, step: 1},
  {id: 'collision-radius', kind: 'range', label: 'Ball Radius', description: 'Controls the physical and visible sphere radius.', section: 'particleEffect', field: 'pointSize', min: 1.6, max: 4.8, step: 0.1},
  {id: 'collision-speed', kind: 'range', label: 'Speed', description: 'Changes the total kinetic energy of the chamber.', section: 'particleEffect', field: 'driftSpeed', min: 0.025, max: 0.15, step: 0.005},
  {id: 'collision-palette', kind: 'select', label: 'Palette', description: 'Changes the sphere material colors.', section: 'particleEffect', field: 'variant', options: [{label: 'Spectrum', value: 'nebula'}, {label: 'Thermal', value: 'vortex'}, {label: 'Mineral', value: 'comet'}]},
];

const renderParticleLayer = ({
  absoluteFrame,
  height,
  mode,
  modules,
  resetToken,
  seed,
  simulationFrame,
  width,
}: EffectAtomRuntimeProps) => {
  const config = resolveParticleEffectConfig(modules);
  const palette = config.variant === 'vortex' ? 'thermal' : config.variant === 'comet' ? 'mineral' : 'spectrum';

  return (
    <Web3DEngine
      style={{
        position: 'absolute',
        inset: 0,
        width: mode === 'render' ? width : '100%',
        height: mode === 'render' ? height : '100%',
        pointerEvents: 'none',
      }}
      config={{background: 'transparent'}}
    >
      <ThreeParticleEffect
        absoluteFrame={absoluteFrame}
        ballCount={Math.max(6, Math.min(48, Math.round(config.particleCount)))}
        ballRadius={Math.max(0.22, Math.min(0.68, config.pointSize * 0.14))}
        interactive={false}
        palette={palette}
        resetToken={resetToken}
        seed={seed}
        simulationFrame={simulationFrame}
        speed={Math.max(1.5, Math.min(9, config.driftSpeed * 60))}
      />
    </Web3DEngine>
  );
};

const ParticleOrbitAtom: React.FC<EffectAtomRuntimeProps> = (props) => renderParticleLayer(props);

export {PARTICLE_EFFECT_CONTROLS, ParticleOrbitAtom, renderParticleLayer};
