import type {DemoMetadata} from '../../types';

export const gpgpuBlackHoleMetadata: DemoMetadata = {
  id: 'gpgpu-black-hole',
  title: 'GPGPU Black Hole Accretion Disk',
  description:
    'A particle-only black-hole study: 1,048,576 particles are simulated in GPU ping-pong framebuffers to form a persistent accretion disk, photon-ring glow, and dark event-horizon silhouette.',
  tags: ['GPGPU', 'FBO Ping-Pong', 'Black Hole', 'Accretion Disk', 'Photon Ring', '1M Particles'],
  route: '/demos/gpgpu-black-hole',
  instructions: [
    'Open Leva to tune gravity, friction, turbulence, feed rate, particle size, and horizon glow.',
    'Lower gravity gives a calmer disk; higher gravity tightens the accretion flow around the photon ring.',
    'Feed rate keeps the black hole consuming matter without fading into an empty screen.',
  ],
};
