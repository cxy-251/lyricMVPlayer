import type {DemoMetadata} from '../../types';

export const paperThreeParticleMetadata: DemoMetadata = {
  id: 'paper-three-particle',
  title: 'Elastic Collision Chamber',
  description: 'Equal-mass spheres collide inside a closed 3D chamber with zero gravity, zero damping, zero friction, and restitution fixed at 1.0.',
  tags: ['Rapier Physics', 'Elastic Collision', 'Rigid Bodies', 'Energy Conservation', 'Interactive Physics', 'Three.js'],
  instructions: [
    'Every sphere has equal mass. Ball and wall restitution is 1.0, while friction and damping are zero.',
    'Initial positions use rejection sampling so no two spheres begin overlapped.',
    'Click a sphere to reflect its direction without changing its speed.',
    'Click empty chamber space or use the pulse button to redirect bodies radially without changing kinetic energy.',
    'Drag to orbit the camera and use the mouse wheel to zoom. Pause or reset from the HUD.',
  ],
  route: 'paper-three-particle',
};
