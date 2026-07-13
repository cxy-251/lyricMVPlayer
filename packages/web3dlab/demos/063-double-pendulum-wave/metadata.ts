import type {DemoMetadata} from '../../types';

export const doublePendulumWaveMetadata: DemoMetadata = {
  number: '063',
  id: 'double-pendulum-wave',
  title: 'Double Pendulum Wave',
  description: 'A real RK4 double-pendulum simulation whose fixed-capacity motion history unfolds into layered rainbow ribbons, woven bowls, and white path runners.',
  route: '/demos/double-pendulum-wave',
  tags: ['Three.js', 'Double Pendulum', 'RK4', 'Shader Ribbons', 'Ring Buffer', 'Generative Art'],
  instructions: [
    'Let the physical trail accumulate: the single endpoint history gradually opens into a layered rainbow wave instead of replaying a preset animation.',
    'Use Simulation controls for the real pendulum and Ribbons controls for the derived normal-offset construction; changing a physical parameter restarts the trajectory.',
    'Pause, reset, randomize, clear the trail, hide the labels, or enter fullscreen from the collapsed Actions section.',
  ],
};
