import type {DemoMetadata} from '../../types';

export const neonEnergyTunnelMetadata: DemoMetadata = {
  id: 'neon-energy-tunnel',
  number: '008',
  title: 'Rails in Space',
  description:
    'Fly through a closed procedural ribbon tunnel built from Frenet frames, flowing GLSL energy pulses, layered space particles, and restrained bloom.',
  tags: ['Shader', 'Ribbon Geometry', 'Camera Path', 'Generative Art', 'Bloom'],
  route: '/demos/neon-energy-tunnel',
  instructions: [
    'Drag in the viewport to look around inside the rail tunnel; double-click to recenter the view.',
    'Use the wheel for a temporary speed change.',
    'Flight controls change navigation; Rails controls rebuild the static tunnel; Rendering presets trade density for performance.',
  ],
};
