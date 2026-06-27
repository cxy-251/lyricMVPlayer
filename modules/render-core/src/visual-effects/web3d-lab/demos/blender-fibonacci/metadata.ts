import type { DemoDefinition } from '../../types';

export const blenderFibonacciMetadata: Omit<DemoDefinition, 'Component'> = {
  id: 'blender-fibonacci',
  title: 'AI Blender: Fibonacci Orb',
  description: 'A golden-ratio particle structure generated entirely by a Blender Python script, exported as GLB, and loaded via GLTFLoader.',
  route: '/blender-fibonacci',
  tags: ['Blender', 'glTF', 'AI-Pipeline', 'Math'],
  instructions: [
    'Drag to orbit around the model',
    'Scroll to zoom in/out',
    'Space — pause / resume rotation',
    'R — reset camera',
    '1 / 2 / 3 — slow / normal / fast',
  ],
};
