import type { DemoDefinition } from '../../types';

export const perfectSphereMetadata: Omit<DemoDefinition, 'Component'> = {
  id: '059-perfect-sphere',
  title: 'Fibonacci Parastichy Sphere',
  description: 'A golden-angle sphere that exposes the two adjacent Fibonacci offset families responsible for visible parastichy spirals.',
  route: '/perfect-sphere',
  tags: ['WebGL', 'Fibonacci Sphere', 'Golden Angle', 'Parastichy', 'Procedural Geometry', 'Shader Material'],
  instructions: [
    'The sample count uses Fibonacci numbers and distributes points with the 137.508 degree golden angle.',
    'Spiral Pair selects adjacent Fibonacci index offsets rather than arbitrary arm counts.',
    'Use the layer button to compare both spiral families or isolate either offset.',
    'Drag to orbit, scroll to zoom, and use Leva to control density, visibility, pulse speed, and rotation.',
  ],
};
