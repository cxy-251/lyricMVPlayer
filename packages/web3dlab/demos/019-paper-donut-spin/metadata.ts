import type {DemoMetadata} from '../../types';

export const paperDonutSpinMetadata: DemoMetadata = {
  id: 'toroidal-flow-atlas',
  number: '019',
  title: 'Toroidal Flow Atlas',
  description:
    'An interpretable reconstruction of toroidal motion using parameterized vector fields, RK4 streamline integration, and GPU-animated flow trails.',
  tags: ['Dynamical System', 'RK4', 'Streamlines', 'Shader', 'Web Worker'],
  route: 'toroidal-flow-atlas',
  instructions: [
    'Drag to orbit and use the wheel to inspect the toroidal volume at different scales.',
    'Presets select distinct velocity-field topologies; the Dynamics controls reshape them without exposing implementation details.',
    'Quality changes the numerical budget, while Flow Speed and Trail Length update the GPU animation immediately.',
  ],
};
