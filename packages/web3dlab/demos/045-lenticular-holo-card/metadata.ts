import type {DemoMetadata} from '../../types';

export const lenticularHoloCardMetadata: DemoMetadata = {
  number: '045',
  id: 'lenticular-holo-card',
  title: 'Chladni Standing-Wave Plate',
  description: 'A GPU particle experiment where sand grains iteratively project onto the nodal lines of selectable Chladni eigenmodes while the underlying plate continues to oscillate.',
  route: '/demos/lenticular-holo-card',
  tags: ['WebGL', 'GPU Particles', 'Chladni', 'Standing Wave', 'Mathematics'],
  instructions: ['Change mode n and mode m to reorganize the sand into new nodal patterns; lower settling to reveal the particles before projection.'],
};
