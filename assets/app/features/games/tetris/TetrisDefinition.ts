import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { TetrisModule } from './TetrisModule';

export const tetrisDefinition: VisibleModuleDefinition = {
    id: 'tetris',
    title: 'Tetris',
    description: 'A code-drawn falling-block game with SRS rotation, seven-bag pieces, hold and seamless AI takeover.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'seven-bag falling blocks with planning AI',
        cover: 'tetris',
    },
    tags: ['classic', 'puzzle', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 50,
    create: () => new TetrisModule(),
};
