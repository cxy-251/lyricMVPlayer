import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { ConnectFourModule } from './ConnectFourModule';

export const connectFourDefinition: VisibleModuleDefinition = {
    id: 'connect-four',
    title: 'Connect Four',
    description: 'A code-drawn alignment game with alpha-beta search and seamless AI takeover.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'four-in-a-row strategy with depth-search AI',
        cover: 'connect-four',
    },
    tags: ['classic', 'strategy', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 90,
    create: () => new ConnectFourModule(),
};
