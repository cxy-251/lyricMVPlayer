import type {DemoMetadata} from '../../types';

export const visualInspectorControlLayerMetadata: DemoMetadata = {
  number: '054',
  id: 'visual-inspector-control-layer',
  title: 'Volumetric Aurora Curtains',
  description: 'A 48-layer emission integrator builds curved aurora curtains from magnetic folds, altitude-dependent color, procedural turbulence, solar-wind advection, and view parallax.',
  route: '/demos/visual-inspector-control-layer',
  tags: ['WebGL', 'Volume Rendering', 'Aurora', 'Ray Marching', 'Atmosphere'],
  instructions: ['Move the pointer through the volume, then tune solar wind, field curvature, curtain thickness, and altitude color mixing.'],
};
