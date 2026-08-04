export type MinesweeperPhase = 'ready' | 'playing' | 'paused' | 'won' | 'lost';
export type MinesweeperControllerMode = 'human' | 'autopilot';
export type MinesweeperCellState = 'hidden' | 'flagged' | 'revealed';

export interface MinesweeperAction {
    readonly kind: 'reveal' | 'flag' | 'chord' | 'restart';
    readonly row?: number;
    readonly column?: number;
}

export interface MinesweeperObservationCell {
    readonly row: number;
    readonly column: number;
    readonly state: MinesweeperCellState;
    readonly adjacentMines: number;
}

export interface MinesweeperObservation {
    readonly rows: number;
    readonly columns: number;
    readonly remainingMines: number;
    readonly phase: MinesweeperPhase;
    readonly cells: readonly MinesweeperObservationCell[];
}

export interface MinesweeperCellViewState extends MinesweeperObservationCell {
    readonly exploded: boolean;
    readonly mineVisible: boolean;
    readonly wrongFlag: boolean;
}

export interface MinesweeperViewState {
    readonly rows: number;
    readonly columns: number;
    readonly cells: readonly MinesweeperCellViewState[];
    readonly phase: MinesweeperPhase;
    readonly controller: MinesweeperControllerMode;
    readonly flagMode: boolean;
    readonly remainingMines: number;
    readonly elapsedSeconds: number;
    readonly focusRow: number;
    readonly focusColumn: number;
    readonly status: string;
}

export interface MinesweeperBoardLayout {
    readonly left: number;
    readonly bottom: number;
    readonly width: number;
    readonly height: number;
    readonly cellSize: number;
}
