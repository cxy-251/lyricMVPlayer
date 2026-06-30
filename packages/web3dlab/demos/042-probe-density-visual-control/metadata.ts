import type {DemoMetadata} from '../../types';

export const probeDensityVisualControlMetadata: DemoMetadata = {
  id: 'probe-density-visual-control',
  title: 'Probe Density Visual Control',
  description: 'A UE5 Lightmass-inspired debug view showing how manual probe density can be raised around doorways and corners.',
  route: '/demos/probe-density-visual-control',
  tags: ['Canvas2D', 'Debug Viz', 'Lighting', 'Sampling'],
  instructions: ['Adjust doorway and corner density to see how sampling budget moves to risk areas.'],
};
