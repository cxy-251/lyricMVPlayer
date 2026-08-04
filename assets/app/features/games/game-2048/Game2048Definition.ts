import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { Game2048Module } from './Game2048Module';

export const game2048Definition: VisibleModuleDefinition = {
    id: 'game-2048',
    title: '2048',
    description: 'A code-drawn sliding-number puzzle with deterministic rules, expectimax planning and seamless AI takeover.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'probability search and board-shape strategy',
        cover: 'game-2048',
    },
    tags: ['classic', 'expectimax', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 80,
    create: () => new Game2048Module(),
};
