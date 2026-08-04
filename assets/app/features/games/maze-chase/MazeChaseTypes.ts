export type MazeChaseDirection = 'up' | 'down' | 'left' | 'right';
export type MazeChasePhase = 'playing' | 'won' | 'lost';
export type MazeChaseControllerMode = 'human' | 'autopilot';
export type MazeChaseEnemyKind = 'chaser' | 'ambusher' | 'patroller';

export interface MazeChasePoint {
    readonly x: number;
    readonly y: number;
}

export interface MazeChaseEnemyState extends MazeChasePoint {
    readonly kind: MazeChaseEnemyKind;
    readonly direction: MazeChaseDirection;
}

export interface MazeChaseObservation {
    readonly width: number;
    readonly height: number;
    readonly walls: readonly boolean[];
    readonly pellets: readonly boolean[];
    readonly powerPellets: readonly boolean[];
    readonly player: MazeChasePoint;
    readonly direction: MazeChaseDirection;
    readonly enemies: readonly MazeChaseEnemyState[];
    readonly level: number;
    readonly frightenedRemaining: number;
    readonly enemyCombo: number;
    readonly phase: MazeChasePhase;
}

export interface MazeChaseViewState extends MazeChaseObservation {
    readonly score: number;
    readonly lives: number;
    readonly remainingPellets: number;
    readonly controller: MazeChaseControllerMode;
    readonly status: string;
    readonly hint: string;
}

export interface MazeChaseViewActions {
    readonly setDirection: (direction: MazeChaseDirection) => void;
    readonly restart: () => void;
}
