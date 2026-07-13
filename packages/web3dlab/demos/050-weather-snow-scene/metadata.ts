import type {DemoMetadata} from '../../types';

export const weatherSnowSceneMetadata: DemoMetadata = {
  number: '050',
  id: 'weather-snow-scene',
  title: 'Gray-Scott Reaction Diffusion',
  description: 'A genuine GPU ping-pong solver that evolves two Gray-Scott chemicals across half-float render targets, producing spots, stripes, splitting fronts, and interactive reagent injection.',
  route: '/demos/weather-snow-scene',
  tags: ['WebGL', 'GPGPU', 'Reaction Diffusion', 'Render Target', 'Simulation'],
  instructions: ['Press and drag to inject chemical V, then explore feed and kill rates to move between spots, worms, and unstable fronts.'],
};
