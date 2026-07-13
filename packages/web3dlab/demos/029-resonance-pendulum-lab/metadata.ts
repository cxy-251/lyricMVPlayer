import type {DemoMetadata} from '../../types';

export const resonancePendulumLabMetadata: DemoMetadata = {
  number: '029',
  id: 'resonance-pendulum-lab',
  title: 'Resonance Pendulum Lab',
  description: 'A numerically integrated driven-pendulum array where length sets natural frequency and resonance emerges through amplitude, glow, and live response bars.',
  route: '/demos/resonance-pendulum-lab',
  tags: ['Physics', 'Numerical Integration', 'Resonance', 'Interactive Controls'],
  instructions: [
    'Move drive frequency to find the pendulum whose natural frequency matches it.',
    'Enable frequency sweep to scan the full range and compare the live response bars.',
  ],
};
