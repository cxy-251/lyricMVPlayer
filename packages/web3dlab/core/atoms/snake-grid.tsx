import {resolveCellularEffectConfig} from '@paper-to-video/content-pipeline';
import React from 'react';

import {SnakeGridEffect} from '../../demos/022-paper-snake-grid/022-PaperSnakeGrid';
import {Web3DEngine} from '../Web3DEngine';
import type {EffectAtomRuntimeProps, EffectControlDefinition} from '../simulations/types';

const SNAKE_EFFECT_CONTROLS: EffectControlDefinition[] = [
  {id: 'snake-map-size', kind: 'range', label: 'Map Size', description: 'Changes the number of cells on each side of the board.', section: 'cellularEffect', field: 'cellColumns', min: 10, max: 24, step: 2},
  {id: 'snake-speed', kind: 'range', label: 'Move Interval', description: 'Lower values make the autonomous snake move faster.', section: 'cellularEffect', field: 'stepEveryFrames', min: 4, max: 20, step: 1},
];

const renderSnakeLayer = ({
  absoluteFrame,
  height,
  mode,
  modules,
  seed,
  simulationFrame,
  width,
}: EffectAtomRuntimeProps) => {
  const config = resolveCellularEffectConfig(modules);
  const boardSize = Math.max(10, Math.min(24, Math.round(config.cellColumns / 2) * 2));
  const movesPerSecond = 60 / Math.max(4, Math.min(20, config.stepEveryFrames));

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
      <SnakeGridEffect
        absoluteFrame={absoluteFrame}
        boardSize={boardSize}
        movesPerSecond={movesPerSecond}
        seed={seed}
        simulationFrame={simulationFrame}
      />
    </Web3DEngine>
  );
};

const SnakeGridAtom: React.FC<EffectAtomRuntimeProps> = (props) => renderSnakeLayer(props);

export {SNAKE_EFFECT_CONTROLS, renderSnakeLayer, SnakeGridAtom};
