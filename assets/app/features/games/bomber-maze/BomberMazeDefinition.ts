import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { BomberMazeModule } from './BomberMazeModule';

export const bomberMazeDefinition: VisibleModuleDefinition = {
    id: 'bomber-maze',
    title: 'Bomber Maze',
    description: 'A code-drawn blast maze with destructible walls, chain reactions, upgrades and survival-planning AI.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'chain explosions and escape-planning AI',
        cover: 'bomber-maze',
    },
    tags: ['arcade', 'strategy', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 140,
    create: () => new BomberMazeModule(),
};
