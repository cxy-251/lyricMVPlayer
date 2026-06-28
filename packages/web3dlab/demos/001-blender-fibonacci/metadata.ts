import type { DemoDefinition } from '../../types';

export const blenderFibonacciMetadata: Omit<DemoDefinition, 'Component'> = {
  id: '001-blender-fibonacci',
  title: 'AI Blender: Fibonacci Orb (Dynamic Growth)',
  description: 'A pure golden-ratio particle structure without any extra scene elements. Features a dynamic POP growth animation baked into keyframes generated entirely by a Blender Python script.',
  route: '/blender-fibonacci',
  tags: ['Blender', 'glTF', 'AI-Pipeline', 'Math', 'Animation'],
  instructions: [
    'Drag to orbit around the model',
    'Scroll to zoom in/out',
    'Space — pause / resume growth animation',
    'R — reset camera',
    '1 / 2 / 3 — slow / normal / fast animation speed',
  ],
};
