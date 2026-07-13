import type {DemoMetadata} from '../../types';

export const marbleMusicMachineMetadata: DemoMetadata = {
  number: '038',
  id: 'marble-music-machine',
  title: 'Marble Music Machine',
  description: 'A three-dimensional dual-rail music machine where steel marbles descend across six tuned bell plates, then return behind the stage in a continuous mechanical loop.',
  route: '/demos/marble-music-machine',
  tags: ['R3F', 'Music Viz', 'Mechanical', 'Timing'],
  instructions: [
    'Enable sound once to hear each visible bell strike trigger its tuned Web Audio note.',
    'Change tempo or the number of marbles to alter the machine rhythm and strike spacing.',
  ],
};
