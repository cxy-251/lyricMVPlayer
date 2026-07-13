import type {DemoMetadata} from '../../types';

export const plasmaFieldReconnectionMetadata: DemoMetadata = {
  number: '053',
  id: 'plasma-field-reconnection',
  title: 'Strange Attractor Flow',
  description: 'A fourth-order Runge-Kutta integrator traces nearby initial conditions through Lorenz, Rössler, and Thomas systems, exposing sensitive divergence inside bounded chaotic attractors.',
  route: '/demos/plasma-field-reconnection',
  tags: ['R3F', 'Chaos', 'Differential Equations', 'RK4', 'Attractor'],
  instructions: ['Switch systems and adjust the governing parameter to compare attractor topology and divergence between nearby trajectories.'],
};
