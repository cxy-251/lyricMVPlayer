import type {DemoMetadata} from '../../types';

export const liquidMetalMetadata: DemoMetadata = {
  id: 'liquid-metal',
  title: 'Liquid Metal Surface',
  description:
    'A high-subdivision sphere uses boiling procedural displacement, true-normal chrome reflections, and cool silver highlights to read as a powerful reflective liquid metal surface.',
  route: '/demos/liquid-metal',
  tags: ['Shader Material', 'Liquid Metal', 'Chrome Reflections', 'Procedural Surface'],
  instructions: [
    'Tune flow speed, distortion, and frequency to control the boiling surface without losing the sphere silhouette.',
    'Use roughness, reflection strength, and scatter to balance polished chrome shine against subtle liquid breakup.',
  ],
};
