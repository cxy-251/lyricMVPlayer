import type {DemoMetadata} from '../../types';

export const webglFluidSimulationMetadata: DemoMetadata = {
  id: '060-webgl-fluid-simulation',
  title: 'WebGL Fluid Simulation',
  description: 'A GPU framebuffer-based 2D fluid simulation with interactive dye injection, vorticity confinement, pressure projection, bloom, and sunrays.',
  route: '/demos/webgl-fluid-simulation',
  tags: ['WebGL', 'Shader', 'Fluid', 'GPU', 'Simulation', 'Framebuffer'],
  instructions: [
    'Drag one or more pointers across the canvas to inject colored dye and velocity.',
    'Use Random splat for a burst, Reset to clear all fields, and Pause to inspect the current flow.',
    'Open Leva to switch presets, quality, simulation resolution, pressure, curl, dissipation, bloom, and sunrays.',
  ],
};
