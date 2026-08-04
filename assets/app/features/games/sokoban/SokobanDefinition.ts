import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { SokobanModule } from './SokobanModule';

export const sokobanDefinition: VisibleModuleDefinition = {
    id: 'sokoban',
    title: 'Sokoban',
    description: 'A code-drawn warehouse puzzle with undo, deadlock detection, push-state search and seamless AI takeover.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'warehouse pushing puzzles with planning AI',
        cover: 'sokoban',
    },
    tags: ['classic', 'puzzle', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 60,
    create: () => new SokobanModule(),
};
