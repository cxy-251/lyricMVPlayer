import type {DemoMetadata} from '../../types';

export const paperThreeLifeMetadata: DemoMetadata = {
  id: 'paper-three-life',
  title: 'GPU Evolution Life Lab',
  description: 'A GPU-resident cellular ecosystem with inherited species color, mutation, volumetric cells, interactive editing, and multiple Life-like rule sets.',
  tags: ['GPGPU', 'Game of Life', 'Cellular Automata', 'Ping-Pong Textures', 'Evolution', 'Shader Material', 'Interactive Simulation'],
  instructions: [
    'The simulation state remains on the GPU and alternates between two render targets for each generation.',
    'Left-drag paints living cells. Right-drag erases cells. Brush size is controlled from Leva.',
    'Middle-drag rotates the camera and the mouse wheel zooms; left and right buttons remain dedicated to editing.',
    'Use the HUD to pause, advance one generation, randomize, or clear the world.',
    'Conway follows B3/S23, HighLife adds birth on six neighbors, and Seeds uses B2/S0.',
    'Species color is inherited from living neighbors; Mutation introduces occasional color divergence and Afterglow reveals recent deaths.',
  ],
  route: 'paper-three-life',
};
