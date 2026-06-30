import type {DemoMetadata} from '../../types';

export const codeMeltdownMetadata: DemoMetadata = {
  id: 'code-meltdown',
  title: 'Code Meltdown',
  description: 'Turns source text into a heat-reactive glyph waterfall where characters smear, drift, and glow like molten code.',
  route: '/demos/code-meltdown',
  tags: ['ASCII', 'Canvas', 'Pointer', 'Glitch'],
  instructions: [
    'Move the pointer over the code field to create localized heat and melt trails.',
    'Tune cell size and turbulence to move between clean source rain and noisy collapse.',
  ],
};
