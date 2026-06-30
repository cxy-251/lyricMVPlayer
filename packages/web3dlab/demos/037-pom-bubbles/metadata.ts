import type {DemoMetadata} from '../../types';

export const pomBubblesMetadata: DemoMetadata = {
  id: 'pom-bubbles',
  title: 'POM Bubbles Material',
  description: 'A fullscreen Voronoi shader fakes parallax-occlusion bubble depth on a flat plane, matching the Blender node idea in WebGL form.',
  route: '/demos/pom-bubbles',
  tags: ['Shader', 'Voronoi', 'Material', 'POM'],
  instructions: ['Raise depth to exaggerate the fake volume; change cell scale to move from micro-bubbles to large cells.'],
};
