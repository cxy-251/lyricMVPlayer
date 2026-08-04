import { Game2048Model } from './Game2048Model';
import type {
    Game2048Direction,
    Game2048Observation,
} from './Game2048Types';

const DIRECTIONS: readonly Game2048Direction[] = ['up', 'left', 'right', 'down'];
const SEARCH_DEPTH = 2;

export class Game2048Autopilot {
    decide(observation: Game2048Observation): Game2048Direction | null {
        if (observation.phase !== 'playing') {
            return null;
        }
        let bestDirection: Game2048Direction | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const direction of DIRECTIONS) {
            const result = Game2048Model.simulateMove(observation.board, direction);
            if (!result.changed) {
                continue;
            }
            const score = result.score * 2.2
                + this.chanceValue(result.board, SEARCH_DEPTH);
            if (score > bestScore) {
                bestScore = score;
                bestDirection = direction;
            }
        }
        return bestDirection;
    }

    private chanceValue(board: readonly (readonly number[])[], depth: number): number {
        if (depth <= 0) {
            return this.evaluate(board);
        }
        const empty = this.emptyCells(board);
        if (empty.length === 0) {
            return this.maxValue(board, depth - 1);
        }
        let total = 0;
        for (const cell of empty) {
            const withTwo = board.map((row) => [...row]);
            withTwo[cell.row][cell.column] = 2;
            const withFour = board.map((row) => [...row]);
            withFour[cell.row][cell.column] = 4;
            total += 0.9 * this.maxValue(withTwo, depth - 1)
                + 0.1 * this.maxValue(withFour, depth - 1);
        }
        return total / empty.length;
    }

    private maxValue(board: readonly (readonly number[])[], depth: number): number {
        let best = Number.NEGATIVE_INFINITY;
        for (const direction of DIRECTIONS) {
            const result = Game2048Model.simulateMove(board, direction);
            if (!result.changed) {
                continue;
            }
            const score = result.score * 1.7
                + (depth <= 0
                    ? this.evaluate(result.board)
                    : this.chanceValue(result.board, depth));
            best = Math.max(best, score);
        }
        return Number.isFinite(best) ? best : this.evaluate(board) - 5000;
    }

    private evaluate(board: readonly (readonly number[])[]): number {
        const values = board.map((row) => row.map((value) => value > 0 ? Math.log2(value) : 0));
        const empty = this.emptyCells(board).length;
        const maximum = Math.max(...board.flat(), 0);
        let smoothness = 0;
        let mergePotential = 0;
        let monotonicity = 0;

        for (let row = 0; row < 4; row += 1) {
            let increasing = 0;
            let decreasing = 0;
            for (let column = 0; column < 3; column += 1) {
                const current = values[row][column];
                const next = values[row][column + 1];
                smoothness -= Math.abs(current - next);
                if (current === next && current > 0) {
                    mergePotential += current;
                }
                if (current > next) {
                    decreasing += next - current;
                } else {
                    increasing += current - next;
                }
            }
            monotonicity += Math.max(increasing, decreasing);
        }
        for (let column = 0; column < 4; column += 1) {
            let increasing = 0;
            let decreasing = 0;
            for (let row = 0; row < 3; row += 1) {
                const current = values[row][column];
                const next = values[row + 1][column];
                smoothness -= Math.abs(current - next);
                if (current === next && current > 0) {
                    mergePotential += current;
                }
                if (current > next) {
                    decreasing += next - current;
                } else {
                    increasing += current - next;
                }
            }
            monotonicity += Math.max(increasing, decreasing);
        }

        const cornerMaximum = board[0][0] === maximum
            || board[0][3] === maximum
            || board[3][0] === maximum
            || board[3][3] === maximum;
        const snakeWeights = [
            [16, 15, 14, 13],
            [9, 10, 11, 12],
            [8, 7, 6, 5],
            [1, 2, 3, 4],
        ];
        let weightedPosition = 0;
        for (let row = 0; row < 4; row += 1) {
            for (let column = 0; column < 4; column += 1) {
                weightedPosition += values[row][column] * snakeWeights[row][column];
            }
        }

        return empty * 330
            + smoothness * 26
            + monotonicity * 34
            + mergePotential * 42
            + weightedPosition * 2.3
            + (cornerMaximum ? Math.log2(Math.max(2, maximum)) * 180 : -220);
    }

    private emptyCells(board: readonly (readonly number[])[]): Array<{
        row: number;
        column: number;
    }> {
        const empty: Array<{ row: number; column: number }> = [];
        for (let row = 0; row < 4; row += 1) {
            for (let column = 0; column < 4; column += 1) {
                if (board[row][column] === 0) {
                    empty.push({ row, column });
                }
            }
        }
        return empty;
    }
}
