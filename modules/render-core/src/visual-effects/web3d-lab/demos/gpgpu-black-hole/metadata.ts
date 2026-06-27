import type {DemoMetadata} from '../../types';

export const gpgpuBlackHoleMetadata: DemoMetadata = {
  id: 'gpgpu-black-hole',
  title: 'GPGPU Black Hole Physics',
  description:
    'A million-particle engine fully calculated on the GPU using Frame Buffer Objects (Ping-Pong). Move your mouse to create a massive gravitational singularity.',
  tags: ['gpgpu', 'physics', 'interactive', 'compute', '1M particles'],
  route: '/demos/gpgpu-black-hole',
  instructions: [
    'Move the pointer to act as a black hole.',
    'Observe the particles accelerating and slingshotting via real Verlet integration.',
    'Use the UI to tweak gravity and friction in real-time.',
  ],
};
