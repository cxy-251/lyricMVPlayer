import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { MazeChaseModule } from './MazeChaseModule';

export const mazeChaseDefinition: VisibleModuleDefinition = {
    id: 'maze-chase',
    title: 'Maze Chase',
    description: 'An original code-drawn maze run with energy collection, strategic pursuers and safe-path AI takeover.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'real-time pathfinding against three pursuer strategies',
        cover: 'maze-chase',
    },
    tags: ['classic', 'pathfinding', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 110,
    create: () => new MazeChaseModule(),
};
