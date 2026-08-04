import type { LabManifest } from '../../contracts/InteractiveModule';
import { blockStackerDefinition } from './block-stacker';
import { brickBreakerDefinition } from './brick-breaker';
import { connectFourDefinition } from './connect-four';
import { cursorSpaceDefinition } from './cursor-space';
import { game2048Definition } from './game-2048';
import { matchThreeDefinition } from './match-three';
import { mazeChaseDefinition } from './maze-chase';
import { minesweeperDefinition } from './minesweeper';
import { reversiDefinition } from './reversi';
import { riverCrossingDefinition } from './river-crossing';
import { snakeDefinition } from './snake';
import { sokobanDefinition } from './sokoban';
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
        sokobanDefinition,
        snakeDefinition,
        game2048Definition,
        connectFourDefinition,
        reversiDefinition,
        mazeChaseDefinition,
        riverCrossingDefinition,
        matchThreeDefinition,
    ],
};
