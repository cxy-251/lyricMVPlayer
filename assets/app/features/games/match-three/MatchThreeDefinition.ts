import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { MatchThreeModule } from './MatchThreeModule';

export const matchThreeDefinition: VisibleModuleDefinition = {
    id: 'match-three',
    title: 'Match Three',
    description: 'A code-drawn swap puzzle with cascades, striped clears, prism tiles and visible-board planning AI.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'cascade scoring and swap-evaluation AI',
        cover: 'match-three',
    },
    tags: ['classic', 'puzzle', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 130,
    create: () => new MatchThreeModule(),
};
