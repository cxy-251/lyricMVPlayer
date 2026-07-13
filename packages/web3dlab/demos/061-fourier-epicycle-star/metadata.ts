import type {DemoMetadata} from '../../types';

export const fourierEpicycleStarMetadata: DemoMetadata = {
  number: '061',
  id: 'fourier-epicycle-star',
  title: 'Fourier Epicycle Curves',
  description: 'A true complex DFT reconstruction of ten equal-arc sampled stars, polygons, and parametric curves, exposing how signed rotating frequency vectors converge into closed geometry.',
  route: '/demos/fourier-epicycle-star',
  tags: ['Canvas 2D', 'Discrete Fourier Transform', 'Epicycles', 'Complex Numbers', 'Math'],
  instructions: [
    'Use the bottom chapter rail to switch among ten target curves, or leave Auto enabled to watch the complete sequence.',
    'Pause, restart, or drag the timeline while the cached Fourier trail rebuilds to the selected chapter progress.',
    'Switch Sort Mode to compare dominant-amplitude components with paired positive and negative frequencies.',
    'Toggle circles, vectors, and the target path, or inspect an individual coefficient and its frequency, amplitude, phase, real, and imaginary values.',
  ],
};
