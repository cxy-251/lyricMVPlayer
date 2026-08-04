export type BomberMazeDirection = 'up' | 'down' | 'left' | 'right';
export type BomberMazeAction =
    | { readonly kind: 'move'; readonly direction: BomberMazeDirection }
    | { readonly kind: 'bomb' };
export type BomberMazePhase = 'playing' | 'won' | 'lost';
export type BomberMazeDisplayPhase = BomberMazePhase | 'paused' | 'respawning';
export type BomberMazeControllerMode = 'human' | 'autopilot';
export type BomberMazeCellKind = 'floor' | 'hard-wall' | 'soft-wall';
export type BomberMazePowerupKind = 'range' | 'capacity';

export interface BomberMazePoint {
    readonly x: number;
    readonly y: number;
}

export interface BomberMazeBombState extends BomberMazePoint {
    readonly fuse: number;
    readonly range: number;
}

export interface BomberMazeExplosionState extends BomberMazePoint {
    readonly remaining: number;
}

export interface BomberMazeEnemyState extends BomberMazePoint {
    readonly id: number;
}

export interface BomberMazePowerupState extends BomberMazePoint {
    readonly kind: BomberMazePowerupKind;
}

export interface BomberMazeObservation {
    readonly width: number;
    readonly height: number;
    readonly cells: readonly BomberMazeCellKind[];
    readonly player: BomberMazePoint;
    readonly enemies: readonly BomberMazeEnemyState[];
    readonly bombs: readonly BomberMazeBombState[];
    readonly explosions: readonly BomberMazeExplosionState[];
    readonly powerups: readonly BomberMazePowerupState[];
    readonly bombCapacity: number;
    readonly activeBombs: number;
    readonly blastRange: number;
    readonly phase: BomberMazePhase;
}

export interface BomberMazeViewState extends Omit<BomberMazeObservation, 'phase'> {
    readonly phase: BomberMazeDisplayPhase;
    readonly controller: BomberMazeControllerMode;
    readonly score: number;
    readonly lives: number;
    readonly status: string;
    readonly stats: string;
    readonly hint: string;
    readonly invulnerable: boolean;
}

export interface BomberMazeViewActions {
    readonly move: (direction: BomberMazeDirection) => void;
    readonly placeBomb: () => void;
    readonly restart: () => void;
}
