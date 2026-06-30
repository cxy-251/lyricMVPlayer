import type {DemoMetadata} from '../../types';

export const asciiShapeRendererMetadata: DemoMetadata = {
  id: 'ascii-shape-renderer',
  title: '3D ASCII Shape Renderer',
  description: 'Projects sampled 3D geometry into a depth-sorted glyph field with wireframe-like motion and pointer steering.',
  route: '/demos/ascii-shape-renderer',
  tags: ['ASCII', 'Projection', 'Canvas', 'Generative'],
  instructions: [
    'Move the pointer to steer the projection angle.',
    'Switch shape modes to compare sphere, torus, and helix sampling.',
  ],
};
