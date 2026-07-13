# 063 Double Pendulum Wave

A real-time generative artwork built from a numerical double-pendulum simulation.

## Modules

- `doublePendulumPhysics.ts`: fixed-step RK4 solver and fixed-capacity typed-array ring buffer.
- `pendulumWaveGeometry.ts`: reusable ribbon and path-runner `BufferGeometry` updates.
- `pendulumWaveShaders.ts`: rainbow ribbon edge falloff and additive white runner shaders.
- `063-DoublePendulumWave.tsx`: scene composition, Leva controls, actions, and responsive density limits.

The physical solver records only the two pendulum points. The visual layer derives parallel ribbons from each historical sample's local tangent and normal, so the woven wave remains tied to the simulated motion.

Run the project with `npm run dev:web`, then open `/studio/effects/web3d/demos/double-pendulum-wave`.
