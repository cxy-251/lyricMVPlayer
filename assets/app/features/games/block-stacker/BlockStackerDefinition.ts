import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { BlockStackerModule } from './BlockStackerModule';

export const blockStackerDefinition: VisibleModuleDefinition = {
    id: 'block-stacker',
    title: 'Block Stacker',
    description: 'A code-drawn one-button tower game with overlap cutting, rising speed and seamless AI takeover.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'one-button precision tower with AI takeover',
        cover: 'block-stacker',
    },
    tags: ['classic', 'timing', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 30,
    create: () => new BlockStackerModule(),
};
