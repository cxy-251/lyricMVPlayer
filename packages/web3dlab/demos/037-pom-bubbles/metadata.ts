import type {DemoMetadata} from '../../types';

export const pomBubblesMetadata: DemoMetadata = {
  number: '037',
  id: 'pom-bubbles',
  title: 'POM Bubble Relief',
  description: 'A single flat material sample that appears covered in glossy bubble relief through 28-layer parallax occlusion, self-shadowing, derived normals, and iridescent Fresnel light.',
  route: '/demos/pom-bubbles',
  tags: ['Shader', 'Voronoi', 'Material', 'POM'],
  instructions: [
    'Move the pointer to tilt the sample and expose the virtual depth between its bubbles.',
    'Raise virtual depth to strengthen the ray-marched displacement while the geometry remains one flat plane.',
  ],
};
