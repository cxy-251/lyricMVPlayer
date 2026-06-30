import type {DemoMetadata} from '../../types';

export const webgpuPhysicsInstanceLabMetadata: DemoMetadata = {
  id: 'webgpu-physics-instance-lab',
  title: 'WebGPU Physics Instance Lab',
  description: 'A Kevin Levron WebGPU physics demo study: thousands of colored instances gather, collide, and spread while a debug panel exposes GPU-style controls.',
  route: '/demos/webgpu-physics-instance-lab',
  tags: ['Canvas2D', 'WebGPU-Inspired', 'Physics', 'Instancing'],
  instructions: ['Move the pointer through the particle mass, then tune count, gravity, and collision radius to review the GPU-side physics idea.'],
};
