import type {DemoMetadata} from '../../types';

export const referenceCameraConsoleMetadata: DemoMetadata = {
  number: '051',
  id: 'reference-camera-console',
  title: 'Gravitational Lensing Observatory',
  description: 'A shader-based lens equation maps procedural background stars and galaxies through an elliptical foreground mass, producing Einstein rings, duplicated arcs, and alignment-dependent magnification.',
  route: '/demos/reference-camera-console',
  tags: ['WebGL', 'Gravitational Lensing', 'Einstein Ring', 'Astronomy', 'Shader'],
  instructions: ['Adjust source alignment and Einstein radius to move between isolated arcs, duplicated images, and a near-complete ring.'],
};
