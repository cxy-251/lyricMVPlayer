import type {DemoMetadata} from '../../types';

export const geometricBreathingMetadata: DemoMetadata = {
  number: '033',
  id: 'geometric-breathing',
  title: 'Geometric Breathing',
  description: 'A radial harmonic system where N phase-shifted sine oscillators drive node radii and modular chord connections turn their shared equation into a breathing polygon.',
  route: '/demos/geometric-breathing',
  tags: ['Canvas2D', 'Harmonic Motion', 'Polar Coordinates', 'Math Visualization'],
  instructions: [
    'Set phase winding m to zero for synchronized breathing or raise it to send a wave around the ring.',
    'Change chord step k to connect each oscillator to a different modular neighbor.',
  ],
};
