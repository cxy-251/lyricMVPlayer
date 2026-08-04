import type { LabManifest } from '../../contracts/InteractiveModule';
import { blockStackerDefinition } from './block-stacker';
import { cursorSpaceDefinition } from './cursor-space';
import { minesweeperDefinition } from './minesweeper';

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
        minesweeperDefinition,
        blockStackerDefinition,
    ],
};
