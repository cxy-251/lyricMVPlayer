import type {DemoMetadata} from '../../types';

export const codeMeltdownMetadata: DemoMetadata = {
  number: '026',
  id: 'code-meltdown',
  title: 'Code Meltdown',
  description: 'A WebGL source-code field where GPU-driven heat flow bends glyphs into glowing drips and layered molten trails.',
  route: '/demos/code-meltdown',
  tags: ['WebGL', 'Fragment Shader', 'Typography', 'Interactive'],
  instructions: [
    'Move or drag the pointer across the source field to apply concentrated heat.',
    'Increase ambient heat to keep an autonomous melt zone moving through the code.',
  ],
};
