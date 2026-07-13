import type {DemoMetadata} from '../../types';

export const goldParticleSphereMetadata: DemoMetadata = {
  number: '028',
  id: 'gold-particle-sphere',
  title: 'Gold Triangle Particle Sphere',
  description: 'A centered GPU-instanced sphere where graphite facets rise into flowing gold islands with independent spin, edge light, and metallic depth.',
  route: '/demos/gold-particle-sphere',
  tags: ['Shader Material', 'GPU Instancing', 'Gold', 'Procedural Surface'],
  instructions: [
    'Drag to inspect the gold facet shell from different angles.',
    'Raise gold coverage to grow the animated metallic islands across the sphere.',
  ],
};
