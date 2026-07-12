import type {DemoMetadata} from '../../types';

export const paperSnakeGridMetadata: DemoMetadata = {
  id: 'paper-snake-grid',
  title: 'Autonomous Snake Pathfinder',
  description: 'A collision-free autonomous snake that evaluates shortest food routes, protects its tail escape path, adapts to obstacles, and wins by filling every playable cell.',
  tags: ['Pathfinding', 'Breadth-First Search', 'Hamiltonian Cycle', 'Autonomous Agent', 'Interactive Obstacles', 'Snake Game', 'Instanced Rendering'],
  instructions: [
    'SAFE SHORTEST compares the shortest routes to every food and accepts the nearest route that still leaves a path from head to tail.',
    'SAFE DETOUR keeps the tail reachable while reducing the real path distance to food; TAIL GUARD is reserved for the final survival fallback.',
    'The lime circular marker is the head; the smaller ice-blue marker is the tail.',
    'Use the Leva panel to change map size and movement speed. Larger maps create smaller cells and longer runs.',
    'Click or drag across cells to cycle empty → food → obstacle → empty. Each cell changes once per drag, while snake cells ignore input.',
    'Multiple foods can coexist. A new automatic food appears only after the final food is eaten, so the board always has a target.',
    'Pause or restart from the HUD. The run is complete when the snake fills every non-obstacle cell inside the wall.',
  ],
  route: 'paper-snake-grid',
};
