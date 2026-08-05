import { PREVIEW } from 'cc/env';
import type { LabManifest } from '../../contracts/InteractiveModule';
import { defineLabManifest } from '../../core/ManifestValidator';
import { blockStackerDefinition } from './block-stacker';
import { bomberMazeDefinition } from './bomber-maze';
import { brickBreakerDefinition } from './brick-breaker';
import { connectFourDefinition } from './connect-four';
import { cursorSpaceDefinition } from './cursor-space';
import { game2048Definition } from './game-2048';
import { matchThreeDefinition } from './match-three';
import { mazeChaseDefinition } from './maze-chase';
import { minesweeperDefinition } from './minesweeper';
import { reversiDefinition } from './reversi';
import { riverCrossingDefinition } from './river-crossing';
import { runGameModelContractChecks } from './shared/GameModelContractChecks';
import { snakeDefinition } from './snake';
import { sokobanDefinition } from './sokoban';
import { tetrisDefinition } from './tetris';
import { towerDefenseDefinition } from './tower-defense';

if (PREVIEW) {
    runGameModelContractChecks();
}

export const gamesLab: LabManifest = defineLabManifest({
    definition: {
        id: 'games',
        title: 'Games Laboratory',
        description: 'Replayable arcade, puzzle and strategy games with AI takeover, progression, rotating challenges and responsive runtime UI.',
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
        bomberMazeDefinition,
        towerDefenseDefinition,
    ],
});
