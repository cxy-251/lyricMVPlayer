import type {DemoMetadata} from '../../types';

export const fluidCursorFieldMetadata: DemoMetadata = {
  id: 'fluid-cursor-field',
  title: 'Fluid Cursor Field',
  description:
    'A shader field where pointer motion stirs glowing ripples, soft trails, and liquid-like distortion.',
  tags: ['fluid', 'shader', 'cursor', 'distortion'],
  route: '/demos/fluid-cursor-field',
  instructions: [
    'Move the pointer to stir the field and bend the grid.',
    'Move quickly to inject stronger ripples and longer trails.',
    'Drag to make the liquid hold its motion longer.',
    'Use the wheel to change the field zoom.',
  ],
};
