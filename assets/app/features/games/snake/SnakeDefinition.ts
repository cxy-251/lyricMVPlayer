import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { SnakeModule } from './SnakeModule';

export const snakeDefinition: VisibleModuleDefinition = {
    id: 'snake',
    title: 'Snake',
    description: 'A code-drawn grid snake with accelerating movement, safe-space planning and seamless AI takeover.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'real-time pathfinding with safe-space AI',
        cover: 'snake',
    },
    tags: ['classic', 'pathfinding', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 70,
    create: () => new SnakeModule(),
};
