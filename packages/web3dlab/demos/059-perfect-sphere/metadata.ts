import type { DemoDefinition } from '../../types';

export const perfectSphereMetadata: Omit<DemoDefinition, 'Component'> = {
  id: '059-perfect-sphere',
  title: 'Math Lab: The Perfect Sphere',
  description: 'A pure WebGL (InstancedMesh) 3D Fibonacci Sphere. Demonstrates mathematical perfection without baked assets. The energy core breathes and expands using a dynamic time-based golden ratio multiplier.',
  route: '/perfect-sphere',
  tags: ['WebGL', 'Math', 'InstancedMesh', 'Procedural', 'Energy'],
  instructions: [
    'Drag to orbit around the energy core',
    'Scroll to zoom in/out',
    'Use the Leva Control Panel to adjust particle count, chaos factor, and colors.',
  ],
};
