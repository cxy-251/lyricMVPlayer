import React from 'react';

import {DonutSpinEffect} from '../../demos/019-paper-donut-spin/019-PaperDonutSpin';
import {Web3DEngine} from '../Web3DEngine';
import {DONUT_EFFECT_CONTROLS} from '../simulations/controls';
import type {EffectAtomRuntimeProps} from '../simulations/types';

const renderDonutLayer = ({
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
        camera: {fov: 38, far: 80, near: 0.1, position: [0, 0.08, 7.0]},
        bloom: {intensity: 0.12, luminanceThreshold: 0.48, luminanceSmoothing: 0.32},
      }}
    >
      <DonutSpinEffect seed={seed} absoluteFrame={absoluteFrame} simulationFrame={simulationFrame} />
    </Web3DEngine>
  );
};

const DonutSpinAtom: React.FC<EffectAtomRuntimeProps> = (props) => {
  return renderDonutLayer(props);
};

export {DONUT_EFFECT_CONTROLS, renderDonutLayer, DonutSpinAtom};
