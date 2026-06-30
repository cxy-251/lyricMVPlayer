import type {DemoMetadata} from '../../types';

export const recursiveJugglerMetadata: DemoMetadata = {
  id: 'recursive-juggler',
  title: 'Recursive Juggler',
  description: 'A self-referential loop where each tossed ball contains a smaller juggler that repeats the same motion.',
  route: '/demos/recursive-juggler',
  tags: ['Canvas2D', 'Recursive', 'Motion', 'Illustration'],
  instructions: ['Increase recursion depth to stress the visual benchmark idea from the source animation.'],
};
