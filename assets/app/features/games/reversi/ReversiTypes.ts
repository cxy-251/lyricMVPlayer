export type ReversiPlayer = 0 | 1 | 2;
export type ReversiPhase = 'playing' | 'ended' | 'paused';
export type ReversiControllerMode = 'human' | 'autopilot';

export interface ReversiCell {
    readonly row: number;
    readonly column: number;
}

export interface ReversiObservation {
    readonly board: readonly (readonly ReversiPlayer[])[];
    readonly currentPlayer: 1 | 2;
    readonly phase: ReversiPhase;
    readonly legalMoves: readonly ReversiCell[];
}

export interface ReversiViewState extends ReversiObservation {
    readonly controller: ReversiControllerMode;
    readonly winner: ReversiPlayer;
    readonly focusRow: number;
    readonly focusColumn: number;
    readonly blackCount: number;
    readonly whiteCount: number;
    readonly status: string;
    readonly stats: string;
    readonly hint: string;
}

export interface ReversiBoardLayout {
    readonly left: number;
    readonly bottom: number;
    readonly width: number;
    readonly height: number;
    readonly cellSize: number;
}

export interface ReversiViewActions {
    place(row: number, column: number): void;
    moveFocus(rowOffset: number, columnOffset: number): void;
    placeFocused(): void;
    restart(): void;
}
