import type {
    ConnectFourCell,
    ConnectFourObservation,
    ConnectFourPlayer,
} from './ConnectFourTypes';

const ROWS = 6;
const COLUMNS = 7;
const DIRECTIONS = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
] as const;

export class ConnectFourModel {
    readonly rows = ROWS;
    readonly columns = COLUMNS;

    private board: ConnectFourPlayer[][] = [];
    private current: 1 | 2 = 1;
    private currentPhase: 'playing' | 'won' | 'draw' = 'playing';
    private currentWinner: ConnectFourPlayer = 0;
    private winning: ConnectFourCell[] = [];
    private moveCount = 0;

    constructor() {
        this.reset();
    }

    get phase(): 'playing' | 'won' | 'draw' {
        return this.currentPhase;
    }

    get currentPlayer(): 1 | 2 {
        return this.current;
    }

    get winner(): ConnectFourPlayer {
        return this.currentWinner;
    }

    get moves(): number {
        return this.moveCount;
    }

    get winningCells(): readonly ConnectFourCell[] {
        return this.winning;
    }

    reset(): void {
        this.board = Array.from(
            { length: ROWS },
            () => new Array<ConnectFourPlayer>(COLUMNS).fill(0),
        );
        this.current = 1;
        this.currentPhase = 'playing';
        this.currentWinner = 0;
        this.winning = [];
        this.moveCount = 0;
    }

    drop(column: number): boolean {
        if (
            this.currentPhase !== 'playing'
            || column < 0
            || column >= COLUMNS
        ) {
            return false;
        }
        let row = -1;
        for (let candidate = 0; candidate < ROWS; candidate += 1) {
            if (this.board[candidate][column] === 0) {
                row = candidate;
                break;
            }
        }
        if (row < 0) {
            return false;
        }

        const player = this.current;
        this.board[row][column] = player;
        this.moveCount += 1;
        const winning = this.findWinningLine(row, column, player);
        if (winning.length >= 4) {
            this.currentPhase = 'won';
            this.currentWinner = player;
            this.winning = winning;
        } else if (this.moveCount >= ROWS * COLUMNS) {
            this.currentPhase = 'draw';
        } else {
            this.current = player === 1 ? 2 : 1;
        }
        return true;
    }

    createObservation(): ConnectFourObservation {
        return {
            board: this.board.map((row) => [...row]),
            currentPlayer: this.current,
            phase: this.currentPhase,
        };
    }

    private findWinningLine(
        row: number,
        column: number,
        player: 1 | 2,
    ): ConnectFourCell[] {
        for (const [rowStep, columnStep] of DIRECTIONS) {
            const cells: ConnectFourCell[] = [{ row, column }];
            for (const sign of [-1, 1] as const) {
                let nextRow = row + rowStep * sign;
                let nextColumn = column + columnStep * sign;
                while (
                    nextRow >= 0
                    && nextRow < ROWS
                    && nextColumn >= 0
                    && nextColumn < COLUMNS
                    && this.board[nextRow][nextColumn] === player
                ) {
                    cells.push({ row: nextRow, column: nextColumn });
                    nextRow += rowStep * sign;
                    nextColumn += columnStep * sign;
                }
            }
            if (cells.length >= 4) {
                return cells;
            }
        }
        return [];
    }
}
