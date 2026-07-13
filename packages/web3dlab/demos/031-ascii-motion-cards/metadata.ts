import type {DemoMetadata} from '../../types';

export const asciiMotionCardsMetadata: DemoMetadata = {
  number: '031',
  id: 'ascii-motion-cards',
  title: 'ASCII Motion Cards',
  description: 'An interactive card carousel where three abstract studies are rendered as live character-density fields with selectable glyph language and motion.',
  route: '/demos/ascii-motion-cards',
  tags: ['ASCII', 'Canvas2D', 'Interactive UI', 'Motion Cards'],
  instructions: [
    'Use the visible Previous and Next controls to switch between the three ASCII studies.',
    'Pause the card to inspect how density and threshold define the underlying shape.',
  ],
};
