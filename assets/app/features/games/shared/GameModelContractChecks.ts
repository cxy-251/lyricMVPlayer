import { Game2048Model } from '../game-2048/Game2048Model';
import { MinesweeperModel } from '../minesweeper/MinesweeperModel';
import { SnakeModel } from '../snake/SnakeModel';
import {
    LinearCongruentialRandom,
    XorShift32Random,
} from './RandomSource';

export function runGameModelContractChecks(): void {
    checkRandomDeterminism();
    checkSnakeDeterminism();
    check2048MergeContract();
    checkMinesweeperContracts();
}

function checkRandomDeterminism(): void {
    const first = new XorShift32Random(0x12345678);
    const second = new XorShift32Random(0x12345678);
    for (let index = 0; index < 16; index += 1) {
        assert(first.next() === second.next(), 'XorShift32 sequence is not deterministic');
    }
}

function checkSnakeDeterminism(): void {
    const first = new SnakeModel(new XorShift32Random(0x13572468));
    const second = new SnakeModel(new XorShift32Random(0x13572468));
    assertEqual(
        first.createObservation(),
        second.createObservation(),
        'Snake reset is not reproducible',
    );
}

function check2048MergeContract(): void {
    const result = Game2048Model.simulateMove([
        [2, 2, 2, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ], 'left');
    assertEqual(result.board[0], [4, 4, 0, 0], '2048 merged a tile more than once');
    assert(result.score === 8, '2048 merge score is incorrect');

    const first = new Game2048Model(new XorShift32Random(0x24681357));
    const second = new Game2048Model(new XorShift32Random(0x24681357));
    assertEqual(
        first.createObservation(),
        second.createObservation(),
        '2048 reset is not reproducible',
    );
}

function checkMinesweeperContracts(): void {
    const first = new MinesweeperModel(
        9,
        9,
        10,
        new LinearCongruentialRandom(0x10203040),
    );
    const second = new MinesweeperModel(
        9,
        9,
        10,
        new LinearCongruentialRandom(0x10203040),
    );
    first.reveal(4, 4);
    second.reveal(4, 4);
    assertEqual(
        first.createCellViewStates(),
        second.createCellViewStates(),
        'Minesweeper generation is not reproducible',
    );

    const flagLimited = new MinesweeperModel(
        4,
        4,
        1,
        new LinearCongruentialRandom(1),
    );
    assert(flagLimited.toggleFlag(0, 0), 'Minesweeper rejected the first flag');
    assert(!flagLimited.toggleFlag(0, 1), 'Minesweeper accepted more flags than mines');
    assert(flagLimited.toggleFlag(0, 0), 'Minesweeper could not remove a flag');
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
    assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

function assert(condition: boolean, message: string): asserts condition {
    if (!condition) {
        throw new Error(`Game model contract failed: ${message}`);
    }
}
