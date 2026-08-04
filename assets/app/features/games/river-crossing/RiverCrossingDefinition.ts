import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { RiverCrossingModule } from './RiverCrossingModule';

export const riverCrossingDefinition: VisibleModuleDefinition = {
    id: 'river-crossing',
    title: 'River Crossing',
    description: 'An original code-drawn crossing game with moving traffic, drifting platforms and predictive AI takeover.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'moving hazards, drifting platforms and timing prediction',
        cover: 'river-crossing',
    },
    tags: ['classic', 'prediction', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 120,
    create: () => new RiverCrossingModule(),
};
