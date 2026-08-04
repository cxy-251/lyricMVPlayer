import type {
    ConnectFourDifficulty,
    ConnectFourObservation,
    ConnectFourPlayer,
} from './ConnectFourTypes';

const ROWS = 6;
const COLUMNS = 7;
const ORDER = [3, 2, 4, 1, 5, 0, 6] as const;

export class ConnectFourAutopilot {
    decide(
        observation: ConnectFourObservation,
        difficulty: ConnectFourDifficulty = 'standard',
    ): number | null {
        if (observation.phase !== 'playing') {
            return null;
        }
        const board = observation.board.map((row) => [...row]);
        const player = observation.currentPlayer;
        const opponent = player === 1 ? 2 : 1;

        for (const column of ORDER) {
            const row = this.drop(board, column, player);
            if (row >= 0) {
                const winning = this.isWinner(board, row, column, player);
                board[row][column] = 0;
                if (winning) {
                    return column;
                }
            }
        }
        for (const column of ORDER) {
            const row = this.drop(board, column, opponent);
            if (row >= 0) {
                const winning = this.isWinner(board, row, column, opponent);
                board[row][column] = 0;
                if (winning) {
                    return column;
                }
            }
        }

        const searchDepth = difficulty === 'casual'
            ? 3
            : difficulty === 'expert'
                ? 7
                : 5;
        let bestColumn: number | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const column of ORDER) {
            const row = this.drop(board, column, player);
            if (row < 0) {
                continue;
            }
            const score = this.search(
                board,
                opponent,
                player,
                searchDepth - 1,
                Number.NEGATIVE_INFINITY,
                Number.POSITIVE_INFINITY,
                row,
                column,
                player,
            );
            board[row][column] = 0;
            if (score > bestScore) {
                bestScore = score;
                bestColumn = column;
            }
        }
        return bestColumn;
    }

    private search(
        board: ConnectFourPlayer[][],
        player: 1 | 2,
        rootPlayer: 1 | 2,
        depth: number,
        alphaValue: number,
        betaValue: number,
        lastRow: number,
        lastColumn: number,
        lastPlayer: 1 | 2,
    ): number {
        if (this.isWinner(board, lastRow, lastColumn, lastPlayer)) {
            return lastPlayer === rootPlayer
                ? 100000 + depth * 1000
                : -100000 - depth * 1000;
        }
        const valid = ORDER.filter((column) => board[ROWS - 1][column] === 0);
        if (valid.length === 0) {
            return 0;
        }
        if (depth <= 0) {
            return this.evaluate(board, rootPlayer);
        }

        let alpha = alphaValue;
        let beta = betaValue;
        const maximizing = player === rootPlayer;
        let best = maximizing
            ? Number.NEGATIVE_INFINITY
            : Number.POSITIVE_INFINITY;
        const nextPlayer: 1 | 2 = player === 1 ? 2 : 1;

        for (const column of valid) {
            const row = this.drop(board, column, player);
            const score = this.search(
                board,
                nextPlayer,
                rootPlayer,
                depth - 1,
                alpha,
                beta,
                row,
                column,
                player,
            );
            board[row][column] = 0;
            if (maximizing) {
                best = Math.max(best, score);
                alpha = Math.max(alpha, best);
            } else {
                best = Math.min(best, score);
                beta = Math.min(beta, best);
            }
            if (alpha >= beta) {
                break;
            }
        }
        return best;
    }

    private evaluate(
        board: readonly (readonly ConnectFourPlayer[])[],
        rootPlayer: 1 | 2,
    ): number {
        const opponent = rootPlayer === 1 ? 2 : 1;
        let score = 0;
        for (let row = 0; row < ROWS; row += 1) {
            if (board[row][3] === rootPlayer) {
                score += 9;
            } else if (board[row][3] === opponent) {
                score -= 9;
            }
        }
        const scoreWindow = (cells: readonly ConnectFourPlayer[]): number => {
            const own = cells.filter((cell) => cell === rootPlayer).length;
            const other = cells.filter((cell) => cell === opponent).length;
            const empty = cells.length - own - other;
            if (own > 0 && other > 0) {
                return 0;
            }
            if (own === 4) {
                return 10000;
            }
            if (other === 4) {
                return -10000;
            }
            if (own === 3 && empty === 1) {
                return 120;
            }
            if (own === 2 && empty === 2) {
                return 18;
            }
            if (other === 3 && empty === 1) {
                return -145;
            }
            if (other === 2 && empty === 2) {
                return -20;
            }
            return own - other;
        };

        for (let row = 0; row < ROWS; row += 1) {
            for (let column = 0; column <= COLUMNS - 4; column += 1) {
                score += scoreWindow([
                    board[row][column],
                    board[row][column + 1],
                    board[row][column + 2],
                    board[row][column + 3],
                ]);
            }
        }
        for (let column = 0; column < COLUMNS; column += 1) {
            for (let row = 0; row <= ROWS - 4; row += 1) {
                score += scoreWindow([
                    board[row][column],
                    board[row + 1][column],
                    board[row + 2][column],
                    board[row + 3][column],
                ]);
            }
        }
        for (let row = 0; row <= ROWS - 4; row += 1) {
            for (let column = 0; column <= COLUMNS - 4; column += 1) {
                score += scoreWindow([
                    board[row][column],
                    board[row + 1][column + 1],
                    board[row + 2][column + 2],
                    board[row + 3][column + 3],
                ]);
                score += scoreWindow([
                    board[row + 3][column],
                    board[row + 2][column + 1],
                    board[row + 1][column + 2],
                    board[row][column + 3],
                ]);
            }
        }
        return score;
    }

    private drop(
        board: ConnectFourPlayer[][],
        column: number,
        player: 1 | 2,
    ): number {
        for (let row = 0; row < ROWS; row += 1) {
            if (board[row][column] === 0) {
                board[row][column] = player;
                return row;
            }
        }
        return -1;
    }

    private isWinner(
        board: readonly (readonly ConnectFourPlayer[])[],
        row: number,
        column: number,
        player: 1 | 2,
    ): boolean {
        const directions = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
        for (const [rowStep, columnStep] of directions) {
            let count = 1;
            for (const sign of [-1, 1] as const) {
                let nextRow = row + rowStep * sign;
                let nextColumn = column + columnStep * sign;
                while (
                    nextRow >= 0
                    && nextRow < ROWS
                    && nextColumn >= 0
                    && nextColumn < COLUMNS
                    && board[nextRow][nextColumn] === player
                ) {
                    count += 1;
                    nextRow += rowStep * sign;
                    nextColumn += columnStep * sign;
                }
            }
            if (count >= 4) {
                return true;
            }
        }
        return false;
    }
}
