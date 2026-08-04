export const TETRIS_BOARD_WIDTH = 10;
export const TETRIS_VISIBLE_HEIGHT = 20;
export const TETRIS_BOARD_HEIGHT = 22;

export type TetrisPieceType = 'I' | 'O' | 'T' | 'J' | 'L' | 'S' | 'Z';
export type TetrisRotation = 0 | 1 | 2 | 3;
export type TetrisPhase = 'playing' | 'paused' | 'lost';
export type TetrisControllerMode = 'human' | 'autopilot';
export type TetrisActionKind =
    | 'left'
    | 'right'
    | 'soft-drop'
    | 'rotate-cw'
    | 'rotate-ccw'
    | 'hard-drop'
    | 'hold'
    | 'restart';

export interface TetrisPoint {
    readonly x: number;
    readonly y: number;
}

export interface TetrisActivePiece {
    readonly type: TetrisPieceType;
    readonly rotation: TetrisRotation;
    readonly x: number;
    readonly y: number;
}

export interface TetrisAction {
    readonly kind: TetrisActionKind;
}

export interface TetrisObservation {
    readonly phase: TetrisPhase;
    readonly board: readonly (readonly (TetrisPieceType | null)[])[];
    readonly active: TetrisActivePiece | null;
    readonly next: readonly TetrisPieceType[];
    readonly hold: TetrisPieceType | null;
    readonly canHold: boolean;
    readonly pieceSerial: number;
}

export interface TetrisDrawCell {
    readonly x: number;
    readonly y: number;
    readonly type: TetrisPieceType;
}

export interface TetrisViewState {
    readonly phase: TetrisPhase;
    readonly controller: TetrisControllerMode;
    readonly board: readonly (readonly (TetrisPieceType | null)[])[];
    readonly activeCells: readonly TetrisDrawCell[];
    readonly ghostCells: readonly TetrisDrawCell[];
    readonly next: readonly TetrisPieceType[];
    readonly hold: TetrisPieceType | null;
    readonly score: number;
    readonly lines: number;
    readonly level: number;
    readonly status: string;
    readonly scoreText: string;
    readonly hint: string;
}

export interface TetrisViewActions {
    moveOnce(direction: -1 | 1): void;
    setHorizontal(direction: -1 | 0 | 1): void;
    setSoftDrop(active: boolean): void;
    softDropOnce(): void;
    rotateClockwise(): void;
    rotateCounterClockwise(): void;
    hardDrop(): void;
    hold(): void;
    restart(): void;
}
