import {resolveCellularEffectConfig} from '@paper-to-video/content-pipeline';
import React from 'react';

import {ThreeLifeEffect} from '../../demos/023-paper-three-life/023-PaperThreeLife';
import {Web3DEngine} from '../Web3DEngine';
import type {EffectAtomRuntimeProps, EffectControlDefinition} from '../simulations/types';

const LIFE_EFFECT_CONTROLS: EffectControlDefinition[] = [
  {id: 'life-grid-size', kind: 'range', label: 'Grid Size', description: 'Controls the GPU simulation texture resolution.', section: 'cellularEffect', field: 'cellColumns', min: 64, max: 160, step: 32},
  {id: 'life-speed', kind: 'range', label: 'Step Interval', description: 'Lower values evolve the world faster.', section: 'cellularEffect', field: 'stepEveryFrames', min: 2, max: 20, step: 1},
  {id: 'life-height', kind: 'range', label: 'Cell Height', description: 'Controls the apparent height of living cells.', section: 'cellularEffect', field: 'cellScale', min: 0.55, max: 1.55, step: 0.05},
  {id: 'life-palette', kind: 'select', label: 'Species Palette', description: 'Changes the species color family.', section: 'cellularEffect', field: 'colorPreset', options: [{label: 'Ocean', value: 'mint-ice'}, {label: 'Bioelectric', value: 'sunset-pop'}, {label: 'Spectrum', value: 'violet-cyan'}]},
];

const nearestGridSize = (value: number) => {
  const allowed = [64, 96, 128, 160];
  return allowed.reduce((closest, candidate) =>
    Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest, allowed[0]!);
};

const renderLifeLayer = ({
  absoluteFrame,
  height,
  mode,
  modules,
  seed,
  simulationFrame,
  width,
}: EffectAtomRuntimeProps) => {
  const config = resolveCellularEffectConfig(modules);
  const palette = config.colorPreset === 'mint-ice' ? 1 : config.colorPreset === 'sunset-pop' ? 2 : 0;

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
      <ThreeLifeEffect
        absoluteFrame={absoluteFrame}
        cellHeight={Math.max(0.03, Math.min(0.32, config.cellScale * 0.11))}
        gridSize={nearestGridSize(config.cellColumns)}
        palette={palette}
        seed={seed}
        simulationFrame={simulationFrame}
        speed={Math.max(1, Math.min(30, 60 / Math.max(2, config.stepEveryFrames)))}
      />
    </Web3DEngine>
  );
};

const CellularLifeAtom: React.FC<EffectAtomRuntimeProps> = (props) => renderLifeLayer(props);

export {CellularLifeAtom, LIFE_EFFECT_CONTROLS, renderLifeLayer};
