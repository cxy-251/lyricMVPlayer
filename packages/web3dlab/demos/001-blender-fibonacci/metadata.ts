import type { DemoDefinition } from '../../types';

export const blenderFibonacciMetadata: Omit<DemoDefinition, 'Component'> = {
  id: '001-blender-fibonacci',
  title: 'Blender-Scripted Fibonacci Galaxy',
  description: 'A Blender-generated GLB particle sculpture using golden-angle phyllotaxis and visible Fibonacci batches: 1, 1, 2, 3, 5, 8... Particles fade before looping, so the vortex reads as one continuous upward spiral instead of a reversed refill.',
  route: '/blender-fibonacci',
  tags: ['Blender Pipeline', 'glTF Animation', 'Golden Angle', 'Fibonacci Batches', 'Studio Lighting'],
  instructions: [
    'Drag to orbit around the model',
    'Scroll to zoom in/out',
    'Open the Leva panel to choose a slow animation preset or pause the flow.',
  ],
};
