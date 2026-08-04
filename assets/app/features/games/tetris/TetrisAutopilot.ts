import { tetrisPieceCells } from './TetrisPieces';
import {
    TETRIS_BOARD_HEIGHT,
    TETRIS_BOARD_WIDTH,
    type TetrisAction,
    type TetrisObservation,
    type TetrisPieceType,
    type TetrisRotation,
} from './TetrisTypes';

interface Placement {
    readonly rotation: TetrisRotation;
    readonly x: number;
    readonly score: number;
}

export class TetrisAutopilot {
    private targetSerial = -1;
    private targetRotation: TetrisRotation = 0;
    private targetX = 3;

    reset(): void {
        this.targetSerial = -1;
        this.targetRotation = 0;
        this.targetX = 3;
    }

    decide(observation: TetrisObservation): TetrisAction | null {
        const active = observation.active;
        if (observation.phase !== 'playing' || !active) {
            return null;
        }
        if (observation.pieceSerial !== this.targetSerial) {
            const placement = this.selectPlacement(observation);
            this.targetSerial = observation.pieceSerial;
            this.targetRotation = placement?.rotation ?? active.rotation;
            this.targetX = placement?.x ?? active.x;
        }

        if (active.rotation !== this.targetRotation) {
            const clockwise = (this.targetRotation - active.rotation + 4) % 4;
            return {
                kind: clockwise === 3 ? 'rotate-ccw' : 'rotate-cw',
            };
        }
        if (active.x < this.targetX) {
            return { kind: 'right' };
        }
        if (active.x > this.targetX) {
            return { kind: 'left' };
        }
        return { kind: 'hard-drop' };
    }

    private selectPlacement(observation: TetrisObservation): Placement | null {
        const active = observation.active;
        if (!active) {
            return null;
        }
        let best: Placement | null = null;
        const rotations = active.type === 'O' ? 1 : 4;
        for (let rotationIndex = 0; rotationIndex < rotations; rotationIndex += 1) {
            const rotation = rotationIndex as TetrisRotation;
            for (let x = -2; x < TETRIS_BOARD_WIDTH + 2; x += 1) {
                const startY = active.y;
                if (!this.canPlace(
                    observation.board,
                    active.type,
                    rotation,
                    x,
                    startY,
                )) {
                    continue;
                }
                let y = startY;
                while (this.canPlace(
                    observation.board,
                    active.type,
                    rotation,
                    x,
                    y - 1,
                )) {
                    y -= 1;
                }
                const board = observation.board.map((row) => [...row]);
                for (const cell of tetrisPieceCells(active.type, rotation)) {
                    board[y + cell.y][x + cell.x] = active.type;
                }
                const completedLines = this.clearLines(board);
                const score = this.evaluateBoard(board, completedLines, y);
                if (!best || score > best.score) {
                    best = { rotation, x, score };
                }
            }
        }
        return best;
    }

    private canPlace(
        board: readonly (readonly (TetrisPieceType | null)[])[],
        type: TetrisPieceType,
        rotation: TetrisRotation,
        x: number,
        y: number,
    ): boolean {
        for (const cell of tetrisPieceCells(type, rotation)) {
            const boardX = x + cell.x;
            const boardY = y + cell.y;
            if (
                boardX < 0
                || boardX >= TETRIS_BOARD_WIDTH
                || boardY < 0
                || boardY >= TETRIS_BOARD_HEIGHT
                || board[boardY][boardX] !== null
            ) {
                return false;
            }
        }
        return true;
    }

    private clearLines(board: Array<Array<TetrisPieceType | null>>): number {
        let cleared = 0;
        for (let y = 0; y < board.length; y += 1) {
            if (board[y].every((cell) => cell !== null)) {
                board.splice(y, 1);
                board.push(
                    new Array<TetrisPieceType | null>(TETRIS_BOARD_WIDTH).fill(null),
                );
                cleared += 1;
                y -= 1;
            }
        }
        return cleared;
    }

    private evaluateBoard(
        board: readonly (readonly (TetrisPieceType | null)[])[],
        completedLines: number,
        landingY: number,
    ): number {
        const heights = new Array<number>(TETRIS_BOARD_WIDTH).fill(0);
        let holes = 0;
        let aggregateHeight = 0;
        let maximumHeight = 0;

        for (let x = 0; x < TETRIS_BOARD_WIDTH; x += 1) {
            let top = -1;
            for (let y = TETRIS_BOARD_HEIGHT - 1; y >= 0; y -= 1) {
                if (board[y][x] !== null) {
                    top = y;
                    break;
                }
            }
            const height = top + 1;
            heights[x] = height;
            aggregateHeight += height;
            maximumHeight = Math.max(maximumHeight, height);
            if (top >= 0) {
                for (let y = top - 1; y >= 0; y -= 1) {
                    if (board[y][x] === null) {
                        holes += 1;
                    }
                }
            }
        }

        let bumpiness = 0;
        let wells = 0;
        for (let x = 0; x < TETRIS_BOARD_WIDTH; x += 1) {
            if (x < TETRIS_BOARD_WIDTH - 1) {
                bumpiness += Math.abs(heights[x] - heights[x + 1]);
            }
            const left = x === 0 ? TETRIS_BOARD_HEIGHT : heights[x - 1];
            const right = x === TETRIS_BOARD_WIDTH - 1
                ? TETRIS_BOARD_HEIGHT
                : heights[x + 1];
            const depth = Math.max(0, Math.min(left, right) - heights[x]);
            wells += depth * (depth + 1) / 2;
        }

        return completedLines * 820
            - holes * 540
            - aggregateHeight * 34
            - maximumHeight * 48
            - bumpiness * 22
            - wells * 6
            - landingY * 1.5;
    }
}
