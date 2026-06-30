import type {DemoMetadata} from '../../types';

export const fluidNeonShaderMetadata: DemoMetadata = {
  id: 'fluid-neon-shader',
  title: 'Fluid Neon Shader',
  description: 'A full-screen domain-warped fragment shader that fakes fluid ribbons, iso-lines, pointer ripples, and bloom-ready neon color.',
  route: '/demos/fluid-neon-shader',
  tags: ['Shader', 'Fluid', 'Neon', 'Pointer'],
  instructions: [
    'Move the pointer to bend the fluid field.',
    'Adjust warp and line density to move from soft oil film to high-contrast neon bands.',
  ],
};
