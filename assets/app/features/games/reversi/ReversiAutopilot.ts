import type {
    ReversiCell,
    ReversiDifficulty,
    ReversiObservation,
    ReversiPlayer,
} from './ReversiTypes';

const SIZE = 8;
const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
] as const;
const WEIGHTS = [
    [120, -28, 18, 8, 8, 18, -28, 120],
    [-28, -48, -6, -5, -5, -6, -48, -28],
    [18, -6, 14, 4, 4, 14, -6, 18],
    [8, -5, 4, 2, 2, 4, -5, 8],
    [8, -5, 4, 2, 2, 4, -5, 8],
    [18, -6, 14, 4, 4, 14, -6, 18],
    [-28, -48, -6, -5, -5, -6, -48, -28],
    [120, -28, 18, 8, 8, 18, -28, 120],
] as const;

export class ReversiAutopilot {
    decide(
        observation: ReversiObservation,
        difficulty: ReversiDifficulty = 'standard',
    ): ReversiCell | null {
        if (observation.phase !== 'playing' || observation.legalMoves.length === 0) {
            return null;
        }
        const board = observation.board.map((row) => [...row]);
        const root = observation.currentPlayer;
        const empty = board.flat().filter((cell) => cell === 0).length;
        const baseDepth = empty <= 12 ? 6 : empty <= 24 ? 5 : 4;
        const depth = difficulty === 'casual'
            ? Math.min(3, baseDepth)
            : difficulty === 'expert'
                ? Math.min(7, baseDepth + 1)
                : baseDepth;
        const ordered = this.orderMoves(observation.legalMoves);
        let bestMove: ReversiCell | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const move of ordered) {
            const next = this.applyMove(board, move, root);
            const score = this.search(
                next,
                root === 1 ? 2 : 1,
                root,
                depth - 1,
                Number.NEGATIVE_INFINITY,
                Number.POSITIVE_INFINITY,
                0,
            );
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        return bestMove;
    }

    private search(
        board: ReversiPlayer[][],
        player: 1 | 2,
        root: 1 | 2,
        depth: number,
        alphaValue: number,
        betaValue: number,
        passes: number,
    ): number {
        const moves = this.legalMoves(board, player);
        if (moves.length === 0) {
            if (passes >= 1 || board.every((row) => row.every((cell) => cell !== 0))) {
                return this.evaluate(board, root, true);
            }
            return this.search(
                board,
                player === 1 ? 2 : 1,
                root,
                depth,
                alphaValue,
                betaValue,
                passes + 1,
            );
        }
        if (depth <= 0) {
            return this.evaluate(board, root, false);
        }

        const maximizing = player === root;
        let best = maximizing
            ? Number.NEGATIVE_INFINITY
            : Number.POSITIVE_INFINITY;
        let alpha = alphaValue;
        let beta = betaValue;
        for (const move of this.orderMoves(moves)) {
            const next = this.applyMove(board, move, player);
            const score = this.search(
                next,
                player === 1 ? 2 : 1,
                root,
                depth - 1,
                alpha,
                beta,
                0,
            );
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
        board: readonly (readonly ReversiPlayer[])[],
        root: 1 | 2,
        terminal: boolean,
    ): number {
        const opponent = root === 1 ? 2 : 1;
        let positional = 0;
        let rootDiscs = 0;
        let opponentDiscs = 0;
        let rootFrontier = 0;
        let opponentFrontier = 0;
        for (let row = 0; row < SIZE; row += 1) {
            for (let column = 0; column < SIZE; column += 1) {
                const cell = board[row][column];
                if (cell === 0) {
                    continue;
                }
                const sign = cell === root ? 1 : -1;
                positional += WEIGHTS[row][column] * sign;
                if (cell === root) {
                    rootDiscs += 1;
                } else {
                    opponentDiscs += 1;
                }
                let frontier = false;
                for (const [rowStep, columnStep] of DIRECTIONS) {
                    const nextRow = row + rowStep;
                    const nextColumn = column + columnStep;
                    if (
                        nextRow >= 0
                        && nextRow < SIZE
                        && nextColumn >= 0
                        && nextColumn < SIZE
                        && board[nextRow][nextColumn] === 0
                    ) {
                        frontier = true;
                        break;
                    }
                }
                if (frontier) {
                    if (cell === root) {
                        rootFrontier += 1;
                    } else {
                        opponentFrontier += 1;
                    }
                }
            }
        }
        const discDifference = rootDiscs - opponentDiscs;
        if (terminal) {
            return discDifference === 0
                ? 0
                : Math.sign(discDifference) * 100000 + discDifference * 100;
        }
        const rootMobility = this.legalMoves(board, root).length;
        const opponentMobility = this.legalMoves(board, opponent).length;
        const mobility = rootMobility - opponentMobility;
        const frontier = opponentFrontier - rootFrontier;
        const occupied = rootDiscs + opponentDiscs;
        const discWeight = occupied > 48 ? 7 : occupied > 32 ? 3 : 1;
        return positional * 4
            + mobility * 18
            + frontier * 7
            + discDifference * discWeight;
    }

    private legalMoves(
        board: readonly (readonly ReversiPlayer[])[],
        player: 1 | 2,
    ): ReversiCell[] {
        const moves: ReversiCell[] = [];
        for (let row = 0; row < SIZE; row += 1) {
            for (let column = 0; column < SIZE; column += 1) {
                if (this.collectFlips(board, row, column, player).length > 0) {
                    moves.push({ row, column });
                }
            }
        }
        return moves;
    }

    private applyMove(
        board: readonly (readonly ReversiPlayer[])[],
        move: ReversiCell,
        player: 1 | 2,
    ): ReversiPlayer[][] {
        const next = board.map((row) => [...row]);
        const flips = this.collectFlips(next, move.row, move.column, player);
        next[move.row][move.column] = player;
        for (const cell of flips) {
            next[cell.row][cell.column] = player;
        }
        return next;
    }

    private collectFlips(
        board: readonly (readonly ReversiPlayer[])[],
        row: number,
        column: number,
        player: 1 | 2,
    ): ReversiCell[] {
        if (
            row < 0
            || row >= SIZE
            || column < 0
            || column >= SIZE
            || board[row][column] !== 0
        ) {
            return [];
        }
        const opponent = player === 1 ? 2 : 1;
        const flips: ReversiCell[] = [];
        for (const [rowStep, columnStep] of DIRECTIONS) {
            const line: ReversiCell[] = [];
            let nextRow = row + rowStep;
            let nextColumn = column + columnStep;
            while (
                nextRow >= 0
                && nextRow < SIZE
                && nextColumn >= 0
                && nextColumn < SIZE
                && board[nextRow][nextColumn] === opponent
            ) {
                line.push({ row: nextRow, column: nextColumn });
                nextRow += rowStep;
                nextColumn += columnStep;
            }
            if (
                line.length > 0
                && nextRow >= 0
                && nextRow < SIZE
                && nextColumn >= 0
                && nextColumn < SIZE
                && board[nextRow][nextColumn] === player
            ) {
                flips.push(...line);
            }
        }
        return flips;
    }

    private orderMoves(moves: readonly ReversiCell[]): ReversiCell[] {
        return [...moves].sort((left, right) => (
            WEIGHTS[right.row][right.column] - WEIGHTS[left.row][left.column]
        ));
    }
}
