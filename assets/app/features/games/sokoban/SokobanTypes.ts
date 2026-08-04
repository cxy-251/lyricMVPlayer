export type SokobanDirection = 'up' | 'down' | 'left' | 'right';
export type SokobanPhase = 'playing' | 'won' | 'paused';
export type SokobanControllerMode = 'human' | 'autopilot';

export interface SokobanAction {
    readonly kind: 'move' | 'undo' | 'restart' | 'next-level';
    readonly direction?: SokobanDirection;
}

export interface SokobanLevelDefinition {
    readonly name: string;
    readonly map: readonly string[];
}

export interface SokobanCellViewState {
    readonly row: number;
    readonly column: number;
    readonly wall: boolean;
    readonly goal: boolean;
    readonly box: boolean;
    readonly player: boolean;
}

export interface SokobanObservation {
    readonly width: number;
    readonly height: number;
    readonly walls: readonly boolean[];
    readonly goals: readonly boolean[];
    readonly boxes: readonly number[];
    readonly player: number;
    readonly phase: 'playing' | 'won';
    readonly levelIndex: number;
    readonly stateVersion: number;
}

export interface SokobanViewState {
    readonly width: number;
    readonly height: number;
    readonly cells: readonly SokobanCellViewState[];
    readonly phase: SokobanPhase;
    readonly controller: SokobanControllerMode;
    readonly levelIndex: number;
    readonly levelCount: number;
    readonly levelName: string;
    readonly steps: number;
    readonly pushes: number;
    readonly canUndo: boolean;
    readonly deadlocked: boolean;
    readonly planning: boolean;
    readonly status: string;
    readonly stats: string;
    readonly hint: string;
}

export interface SokobanBoardLayout {
    readonly left: number;
    readonly bottom: number;
    readonly width: number;
    readonly height: number;
    readonly cellSize: number;
}

export interface SokobanViewActions {
    move(direction: SokobanDirection): void;
    undo(): void;
    restart(): void;
    previousLevel(): void;
    nextLevel(): void;
}
