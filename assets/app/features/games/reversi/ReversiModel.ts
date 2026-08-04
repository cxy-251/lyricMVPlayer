import type {
    ReversiCell,
    ReversiObservation,
    ReversiPlayer,
} from './ReversiTypes';

const SIZE = 8;
const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
] as const;

export class ReversiModel {
    readonly size = SIZE;

    private board: ReversiPlayer[][] = [];
    private current: 1 | 2 = 1;
    private currentPhase: 'playing' | 'ended' = 'playing';
    private currentWinner: ReversiPlayer = 0;
    private moveCount = 0;

    constructor() {
        this.reset();
    }

    get phase(): 'playing' | 'ended' {
        return this.currentPhase;
    }

    get currentPlayer(): 1 | 2 {
        return this.current;
    }

    get winner(): ReversiPlayer {
        return this.currentWinner;
    }

    get moves(): number {
        return this.moveCount;
    }

    get blackCount(): number {
        return this.count(1);
    }

    get whiteCount(): number {
        return this.count(2);
    }

    reset(): void {
        this.board = Array.from(
            { length: SIZE },
            () => new Array<ReversiPlayer>(SIZE).fill(0),
        );
        this.board[3][3] = 2;
        this.board[3][4] = 1;
        this.board[4][3] = 1;
        this.board[4][4] = 2;
        this.current = 1;
        this.currentPhase = 'playing';
        this.currentWinner = 0;
        this.moveCount = 0;
    }

    play(row: number, column: number): boolean {
        if (this.currentPhase !== 'playing') {
            return false;
        }
        const flips = this.collectFlips(row, column, this.current);
        if (flips.length === 0) {
            return false;
        }
        this.board[row][column] = this.current;
        for (const cell of flips) {
            this.board[cell.row][cell.column] = this.current;
        }
        this.moveCount += 1;

        const opponent: 1 | 2 = this.current === 1 ? 2 : 1;
        if (this.legalMoves(opponent).length > 0) {
            this.current = opponent;
        } else if (this.legalMoves(this.current).length === 0) {
            this.finish();
        }
        return true;
    }

    legalMoves(player: 1 | 2 = this.current): ReversiCell[] {
        if (this.currentPhase !== 'playing') {
            return [];
        }
        const moves: ReversiCell[] = [];
        for (let row = 0; row < SIZE; row += 1) {
            for (let column = 0; column < SIZE; column += 1) {
                if (this.collectFlips(row, column, player).length > 0) {
                    moves.push({ row, column });
                }
            }
        }
        return moves;
    }

    createObservation(): ReversiObservation {
        return {
            board: this.board.map((row) => [...row]),
            currentPlayer: this.current,
            phase: this.currentPhase,
            legalMoves: this.legalMoves().map((cell) => ({ ...cell })),
        };
    }

    private collectFlips(
        row: number,
        column: number,
        player: 1 | 2,
    ): ReversiCell[] {
        if (
            row < 0
            || row >= SIZE
            || column < 0
            || column >= SIZE
            || this.board[row][column] !== 0
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
                && this.board[nextRow][nextColumn] === opponent
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
                && this.board[nextRow][nextColumn] === player
            ) {
                flips.push(...line);
            }
        }
        return flips;
    }

    private finish(): void {
        this.currentPhase = 'ended';
        const black = this.blackCount;
        const white = this.whiteCount;
        this.currentWinner = black === white ? 0 : black > white ? 1 : 2;
    }

    private count(player: 1 | 2): number {
        let total = 0;
        for (const row of this.board) {
            for (const cell of row) {
                if (cell === player) {
                    total += 1;
                }
            }
        }
        return total;
    }
}
