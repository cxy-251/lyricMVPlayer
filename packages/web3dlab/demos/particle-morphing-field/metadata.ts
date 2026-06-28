import type {DemoMetadata} from '../../types';

export const particleMorphingFieldMetadata: DemoMetadata = {
  id: 'particle-morphing-field',
  title: 'Particle Morphing Field',
  description:
    'A GPU-animated particle sculpture that morphs between a sphere, torus, spiral galaxy, and wave grid.',
  tags: ['particles', 'morphing', 'shader', 'generative'],
  route: '/demos/particle-morphing-field',
  instructions: [
    'Click to morph into the next procedural shape.',
    'Move the pointer to disturb nearby particles with a force field.',
    'Drag to increase turbulence while the shape is moving.',
    'Use the wheel to adjust camera distance and nudge morph speed.',
  ],
};
