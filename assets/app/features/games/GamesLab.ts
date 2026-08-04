import type { LabManifest } from '../../contracts/InteractiveModule';
import { blockStackerDefinition } from './block-stacker';
import { brickBreakerDefinition } from './brick-breaker';
import { cursorSpaceDefinition } from './cursor-space';
import { minesweeperDefinition } from './minesweeper';
import { tetrisDefinition } from './tetris';

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
        brickBreakerDefinition,
        tetrisDefinition,
    ],
};
