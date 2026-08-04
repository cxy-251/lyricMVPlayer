import {
    XorShift32Random,
    type RandomSource,
} from '../shared/RandomSource';
import type {
    Game2048Direction,
    Game2048Observation,
} from './Game2048Types';

const SIZE = 4;
const RESET_SALT = 0x9e3779b9;

export interface Game2048MoveResult {
    readonly board: number[][];
    readonly score: number;
    readonly changed: boolean;
}

export class Game2048Model {
    private boardState: number[][] = [];
    private currentScore = 0;
    private currentPhase: 'playing' | 'lost' = 'playing';

    constructor(
        private readonly randomSource: RandomSource = new XorShift32Random(0x4f1bbcdc),
    ) {
        this.reset();
    }

    get phase(): 'playing' | 'lost' {
        return this.currentPhase;
    }

    get score(): number {
        return this.currentScore;
    }

    get maximumTile(): number {
        return Math.max(...this.boardState.flat(), 0);
    }

    reset(): void {
        this.boardState = Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(0));
        this.currentScore = 0;
        this.currentPhase = 'playing';
        this.randomSource.reset(
            XorShift32Random.mix(this.randomSource.snapshot() ^ RESET_SALT),
        );
        this.addRandomTile();
        this.addRandomTile();
    }

    move(direction: Game2048Direction): boolean {
        if (this.currentPhase !== 'playing') {
            return false;
        }
        const result = Game2048Model.simulateMove(this.boardState, direction);
        if (!result.changed) {
            if (!this.hasAvailableMove(this.boardState)) {
                this.currentPhase = 'lost';
            }
            return false;
        }
        this.boardState = result.board;
        this.currentScore += result.score;
        this.addRandomTile();
        if (!this.hasAvailableMove(this.boardState)) {
            this.currentPhase = 'lost';
        }
        return true;
    }

    createObservation(): Game2048Observation {
        return {
            board: this.boardState.map((row) => [...row]),
            phase: this.currentPhase,
        };
    }

    static simulateMove(
        source: readonly (readonly number[])[],
        direction: Game2048Direction,
    ): Game2048MoveResult {
        const board = source.map((row) => [...row]);
        let score = 0;
        let changed = false;
        for (let index = 0; index < SIZE; index += 1) {
            const line = Game2048Model.readLine(board, direction, index);
            const merged = Game2048Model.slideLine(line);
            score += merged.score;
            for (let offset = 0; offset < SIZE; offset += 1) {
                if (line[offset] !== merged.values[offset]) {
                    changed = true;
                }
            }
            Game2048Model.writeLine(board, direction, index, merged.values);
        }
        return { board, score, changed };
    }

    private static readLine(
        board: readonly (readonly number[])[],
        direction: Game2048Direction,
        index: number,
    ): number[] {
        switch (direction) {
            case 'left':
                return [...board[index]];
            case 'right':
                return [...board[index]].reverse();
            case 'up':
                return board.map((row) => row[index]);
            case 'down':
                return board.map((row) => row[index]).reverse();
        }
    }

    private static writeLine(
        board: number[][],
        direction: Game2048Direction,
        index: number,
        values: readonly number[],
    ): void {
        for (let offset = 0; offset < SIZE; offset += 1) {
            switch (direction) {
                case 'left':
                    board[index][offset] = values[offset];
                    break;
                case 'right':
                    board[index][SIZE - 1 - offset] = values[offset];
                    break;
                case 'up':
                    board[offset][index] = values[offset];
                    break;
                case 'down':
                    board[SIZE - 1 - offset][index] = values[offset];
                    break;
            }
        }
    }

    private static slideLine(values: readonly number[]): {
        values: number[];
        score: number;
    } {
        const compact = values.filter((value) => value > 0);
        const result: number[] = [];
        let score = 0;
        for (let index = 0; index < compact.length; index += 1) {
            if (compact[index] === compact[index + 1]) {
                const merged = compact[index] * 2;
                result.push(merged);
                score += merged;
                index += 1;
            } else {
                result.push(compact[index]);
            }
        }
        while (result.length < SIZE) {
            result.push(0);
        }
        return { values: result, score };
    }

    private addRandomTile(): void {
        const empty: Array<{ row: number; column: number }> = [];
        for (let row = 0; row < SIZE; row += 1) {
            for (let column = 0; column < SIZE; column += 1) {
                if (this.boardState[row][column] === 0) {
                    empty.push({ row, column });
                }
            }
        }
        if (empty.length === 0) {
            return;
        }
        const location = empty[this.randomSource.nextInt(empty.length)];
        this.boardState[location.row][location.column] = this.randomSource.next() < 0.9 ? 2 : 4;
    }

    private hasAvailableMove(board: readonly (readonly number[])[]): boolean {
        if (board.some((row) => row.some((value) => value === 0))) {
            return true;
        }
        for (let row = 0; row < SIZE; row += 1) {
            for (let column = 0; column < SIZE; column += 1) {
                const value = board[row][column];
                if (
                    (column + 1 < SIZE && board[row][column + 1] === value)
                    || (row + 1 < SIZE && board[row + 1][column] === value)
                ) {
                    return true;
                }
            }
        }
        return false;
    }
}
