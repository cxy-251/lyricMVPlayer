import type { LabManifest } from '../../contracts/InteractiveModule';
import { cursorSpaceDefinition } from './cursor-space';

export const gamesLab: LabManifest = {
    definition: {
        id: 'games',
        title: 'Games Laboratory',
        description: 'Minimal playable systems built from reusable Cocos runtime primitives.',
        order: 30,
        cover: 'games',
    },
    modules: [
        cursorSpaceDefinition,
    ],
};
