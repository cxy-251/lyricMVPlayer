import type {DemoMetadata} from '../../types';

export const airSurfaceMouseMetadata: DemoMetadata = {
  number: '039',
  id: 'air-surface-mouse',
  title: 'Air Surface Mouse',
  description: 'A velocity-driven air membrane where pointer motion injects a local impulse, refracts a reference grid, and then decays naturally when the pointer stops.',
  route: '/demos/air-surface-mouse',
  tags: ['Shader', 'Pointer', 'Refraction', 'WebGL'],
  instructions: ['Move the pointer across the surface to create a local air-membrane ripple.'],
};
