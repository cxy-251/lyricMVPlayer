import type {DemoMetadata} from '../../types';

export const recursiveJugglerMetadata: DemoMetadata = {
  number: '034',
  id: 'recursive-juggler',
  title: 'Recursive Juggler',
  description: 'A figure-only recursive cascade where one juggler tosses three smaller jugglers, and every airborne figure repeats the same motion at the next scale.',
  route: '/demos/recursive-juggler',
  tags: ['Canvas2D', 'Recursive', 'Motion', 'Illustration'],
  instructions: [
    'Increase recursion depth to reveal the exponential 1 + 3 + 9 + … figure count.',
    'Adjust recursive phase delay to move every nested level together or create a cascading motion wave.',
  ],
};
