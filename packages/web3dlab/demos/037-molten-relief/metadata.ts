import type {DemoMetadata} from '../../types';

export const moltenReliefMetadata: DemoMetadata = {
  number: '037',
  id: 'molten-relief',
  title: 'Molten Relief',
  description: 'A continuously evolving mineral height field where molten cells, eroded strata, crystal blooms, and narrow cold rims share one procedural surface.',
  route: '/demos/molten-relief',
  tags: ['WebGL', 'GLSL Height Field', 'Procedural Mineral', 'Derived Normals', 'Bloom'],
  instructions: [
    'Hold and drag horizontally to move the carving light across the relief; hovering alone does not disturb the surface.',
    'Use the three presets to compare cellular growth, radial crystallization, and strongly eroded strata.',
    'Relief and Normal Depth control perceived height, while the structure controls reshape the same unified material field.',
  ],
};
