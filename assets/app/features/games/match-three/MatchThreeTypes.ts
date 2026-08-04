export type MatchThreeColor = 0 | 1 | 2 | 3 | 4 | 5;
export type MatchThreeTileColor = MatchThreeColor | -1;
export type MatchThreeSpecial = 'none' | 'row' | 'column' | 'prism';
export type MatchThreePhase = 'playing' | 'paused' | 'won' | 'lost';
export type MatchThreeControllerMode = 'human' | 'autopilot';
export type MatchThreeDirection = 'up' | 'down' | 'left' | 'right';
export type MatchThreeObjective = 'score' | 'cascade' | 'special';

export interface MatchThreeCell {
    readonly row: number;
    readonly column: number;
}

export interface MatchThreeTileState {
    readonly color: MatchThreeTileColor;
    readonly special: MatchThreeSpecial;
}

export interface MatchThreeSwap {
    readonly first: MatchThreeCell;
    readonly second: MatchThreeCell;
}

export interface MatchThreeObservation {
    readonly size: number;
    readonly board: readonly (readonly MatchThreeTileState[])[];
    readonly score: number;
    readonly movesRemaining: number;
    readonly targetScore: number;
    readonly phase: 'playing' | 'won' | 'lost';
}

export interface MatchThreeViewState
    extends Omit<MatchThreeObservation, 'phase'> {
    readonly phase: MatchThreePhase;
    readonly controller: MatchThreeControllerMode;
    readonly selected: MatchThreeCell | null;
    readonly focus: MatchThreeCell;
    readonly combo: number;
    readonly bestScore: number;
    readonly level: number;
    readonly runScore: number;
    readonly objective: MatchThreeObjective;
    readonly objectiveProgress: number;
    readonly objectiveTarget: number;
    readonly status: string;
    readonly stats: string;
    readonly hint: string;
}

export interface MatchThreeViewActions {
    readonly selectCell: (row: number, column: number) => void;
    readonly swapCell: (
        row: number,
        column: number,
        direction: MatchThreeDirection,
    ) => void;
    readonly moveFocus: (rowDelta: number, columnDelta: number) => void;
    readonly activateFocused: () => void;
    readonly restart: () => void;
}

export interface MatchThreeBoardLayout {
    readonly left: number;
    readonly bottom: number;
    readonly size: number;
    readonly cellSize: number;
}
