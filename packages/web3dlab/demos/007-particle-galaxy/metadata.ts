import type {DemoMetadata} from '../../types';

export const particleGalaxyMetadata: DemoMetadata = {
  id: 'particle-galaxy',
  title: 'Relativistic Black Hole',
  description:
    'A physical-based simulation of a supermassive black hole (like Sagittarius A*), rendering an accretion disk influenced by Einsteinian relativistic Doppler beaming and high-energy volumetric polar jets.',
  tags: ['Astrophysics', 'GPGPU Particles', 'Relativistic Beaming', 'Volumetric Jets'],
  route: '/demos/particle-galaxy',
  instructions: [
    'Move the pointer to interact with the environment.',
    'Observe the relativistic Doppler beaming (blue-shifted vs red-shifted).',
    'Use the wheel to zoom in on the event horizon.',
  ],
};
