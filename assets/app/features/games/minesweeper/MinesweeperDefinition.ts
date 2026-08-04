import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { MinesweeperModule } from './MinesweeperModule';

export const minesweeperDefinition: VisibleModuleDefinition = {
    id: 'minesweeper',
    title: 'Minesweeper',
    description: 'A code-drawn minefield with deduction-first AI takeover and fair visible-information reasoning.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'deduction grid with seamless AI takeover',
        cover: 'games',
    },
    tags: ['classic', 'logic', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 20,
    create: () => new MinesweeperModule(),
};
