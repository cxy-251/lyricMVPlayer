import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { ReversiModule } from './ReversiModule';

export const reversiDefinition: VisibleModuleDefinition = {
    id: 'reversi',
    title: 'Reversi',
    description: 'A code-drawn disc-flipping strategy game with mobility search and seamless AI takeover.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'disc-flipping strategy with alpha-beta AI',
        cover: 'reversi',
    },
    tags: ['classic', 'strategy', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 100,
    create: () => new ReversiModule(),
};
