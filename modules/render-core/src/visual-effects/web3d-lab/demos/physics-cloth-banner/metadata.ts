import type {DemoMetadata} from '../../types';

export const physicsClothBannerMetadata: DemoMetadata = {
  id: 'physics-cloth-banner',
  title: 'Physics Cloth Banner',
  description:
    'A pinned holographic fabric panel with Verlet cloth motion, procedural wind, sparks, and pointer ripples.',
  tags: ['cloth', 'physics', 'hologram', 'soft-body'],
  route: '/demos/physics-cloth-banner',
  instructions: [
    'Move the pointer across the fabric to push nearby vertices.',
    'Drag to pull stronger waves through the banner.',
    'Click to send a ripple across the cloth.',
    'Use the wheel to tune the wind and camera distance.',
  ],
};
