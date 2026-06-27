import type {DemoMetadata} from '../../types';

export const particleGalaxyMetadata: DemoMetadata = {
  id: 'particle-galaxy',
  title: 'Particle Galaxy',
  description:
    'A shader-driven field of luminous particles that swirls, bends, and blooms around pointer motion.',
  tags: ['particles', 'shader', 'interactive', 'bloom'],
  route: '/demos/particle-galaxy',
  instructions: [
    'Move the pointer to bend the spiral arms.',
    'Drag to push visible turbulence through the field.',
    'Use the wheel to breathe through camera distance.',
  ],
};
