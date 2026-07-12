import React from 'react';

import {WaterWaveEffect} from '../../demos/020-paper-lights-beams/020-PaperLightsBeams';
import {Web3DEngine} from '../Web3DEngine';
import {LIGHTS_EFFECT_CONTROLS} from '../simulations/controls';
import type {EffectAtomRuntimeProps} from '../simulations/types';

const renderLightsLayer = ({
  absoluteFrame,
  height,
  mode,
  seed,
  simulationFrame,
  width,
}: EffectAtomRuntimeProps) => {
  return (
    <Web3DEngine
      style={{
        position: 'absolute',
        inset: 0,
        width: mode === 'render' ? width : '100%',
        height: mode === 'render' ? height : '100%',
        pointerEvents: 'none',
      }}
      config={{
        background: 'transparent',
        bloom: {intensity: 0.12, luminanceThreshold: 0.46, luminanceSmoothing: 0.44},
        camera: {fov: 42, far: 80, near: 0.1, position: [0, 3.1, 8.4]},
        vignette: {darkness: 0.32, offset: 0.36},
      }}
    >
      <WaterWaveEffect seed={seed} absoluteFrame={absoluteFrame} autoCamera simulationFrame={simulationFrame} />
    </Web3DEngine>
  );
};

const LightsLaunchAtom: React.FC<EffectAtomRuntimeProps> = (props) => {
  return renderLightsLayer(props);
};

const LightsBeamsAtom: React.FC<EffectAtomRuntimeProps> = (props) => {
  return renderLightsLayer(props);
};

export {LIGHTS_EFFECT_CONTROLS, renderLightsLayer, LightsLaunchAtom, LightsBeamsAtom};
