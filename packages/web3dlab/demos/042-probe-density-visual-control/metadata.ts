import type {DemoMetadata} from '../../types';

export const probeDensityVisualControlMetadata: DemoMetadata = {
  number: '042',
  id: 'probe-density-visual-control',
  title: 'SDF Morphology Sculpture',
  description: 'A ray-marched signed-distance sculpture that continuously transforms from sphere to torus to rounded box, then joins orbiting bodies through smooth Boolean union.',
  route: '/demos/probe-density-visual-control',
  tags: ['WebGL', 'Ray Marching', 'SDF', 'Smooth Boolean', 'Procedural Geometry'],
  instructions: ['Press and drag to rotate the field, then adjust shape morph, spatial twist, and smooth union to inspect the distance-field construction.'],
};
