import type {DemoMetadata} from '../../types';

export const colorSortingParticlesMetadata: DemoMetadata = {
  number: '030',
  id: 'color-sorting-particles',
  title: 'Color Sorting Particles',
  description: 'The same color sample set is sorted four ways at once—by hue attractors, saturation stack, hue poles, and chroma rings—with visible convergence progress.',
  route: '/demos/color-sorting-particles',
  tags: ['Canvas2D', 'Particles', 'Data Viz', 'Color'],
  instructions: [
    'Use Shuffle input to scatter a new shared color sample across all four methods.',
    'Pause at any point to compare how quickly each sorting rule converges.',
  ],
};
