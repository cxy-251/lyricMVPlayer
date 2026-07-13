import type {DemoMetadata} from '../../types';

export const trajectoryDataCinemaMetadata: DemoMetadata = {
  number: '035',
  id: 'trajectory-data-cinema',
  title: 'Trajectory Data Cinema',
  description: 'An AIS-style trajectory player with a scrubbed time window, synchronized vessel heads, explicit history trails, and a dark coastline context.',
  route: '/demos/trajectory-data-cinema',
  tags: ['Canvas2D', 'Data Viz', 'Trajectory', 'Map'],
  instructions: [
    'Play, pause, restart, or scrub the visible time window from the bottom transport.',
    'Adjust trail history to control how much of each vessel route remains visible behind its head.',
  ],
};
