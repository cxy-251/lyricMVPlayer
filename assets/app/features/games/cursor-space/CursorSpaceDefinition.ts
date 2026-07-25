import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { CursorSpaceModule } from './CursorSpaceModule';

export const cursorSpaceDefinition: VisibleModuleDefinition = {
    id: 'cursor-space',
    title: 'Cursor Space',
    description: 'Sustained hull combat with visible hit explosions and survival-first AI takeover.',
    category: 'game',
    labId: 'games',
    tags: ['hybrid-control', 'fleet', 'simulation', 'combat'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 10,
    create: () => new CursorSpaceModule(),
};
