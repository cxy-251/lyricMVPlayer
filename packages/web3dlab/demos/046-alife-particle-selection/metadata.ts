import type {DemoMetadata} from '../../types';

export const alifeParticleSelectionMetadata: DemoMetadata = {
  id: 'alife-particle-selection',
  title: 'ALife Particle Selection',
  description: 'A natural-selection particle life lab where neon organisms mutate or adopt nearby species behavior under local density conditions.',
  route: '/demos/alife-particle-selection',
  tags: ['Canvas2D', 'Artificial Life', 'Particle Life', 'Mutation'],
  instructions: ['Tune population, mutation, neighbor radius, and trail to inspect local-rule organisms rather than random sparkle particles.'],
};
