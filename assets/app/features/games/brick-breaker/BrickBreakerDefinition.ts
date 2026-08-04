import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { BrickBreakerModule } from './BrickBreakerModule';

export const brickBreakerDefinition: VisibleModuleDefinition = {
    id: 'brick-breaker',
    title: 'Brick Breaker',
    description: 'A code-drawn paddle game with swept collisions, layered bricks, powerups and seamless AI takeover.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'continuous-collision paddle survival with AI takeover',
        cover: 'brick-breaker',
    },
    tags: ['classic', 'physics', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 40,
    create: () => new BrickBreakerModule(),
};
