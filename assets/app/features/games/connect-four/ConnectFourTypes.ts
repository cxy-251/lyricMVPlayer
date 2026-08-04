export type ConnectFourPlayer = 0 | 1 | 2;
export type ConnectFourPhase = 'playing' | 'won' | 'draw' | 'paused';
export type ConnectFourControllerMode = 'human' | 'autopilot';

export interface ConnectFourCell {
    readonly row: number;
    readonly column: number;
}

export interface ConnectFourObservation {
    readonly board: readonly (readonly ConnectFourPlayer[])[];
    readonly currentPlayer: 1 | 2;
    readonly phase: ConnectFourPhase;
}

export interface ConnectFourViewState extends ConnectFourObservation {
    readonly controller: ConnectFourControllerMode;
    readonly winner: ConnectFourPlayer;
    readonly winningCells: readonly ConnectFourCell[];
    readonly focusColumn: number;
    readonly status: string;
    readonly stats: string;
    readonly hint: string;
}

export interface ConnectFourBoardLayout {
    readonly left: number;
    readonly bottom: number;
    readonly width: number;
    readonly height: number;
    readonly cellSize: number;
}

export interface ConnectFourViewActions {
    drop(column: number): void;
    moveFocus(offset: number): void;
    dropFocused(): void;
    restart(): void;
}
