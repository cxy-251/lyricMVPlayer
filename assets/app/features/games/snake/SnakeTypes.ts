export type SnakeDirection = 'up' | 'down' | 'left' | 'right';
export type SnakePhase = 'playing' | 'paused' | 'won' | 'lost';
export type SnakeControllerMode = 'human' | 'autopilot';

export interface SnakePoint {
    readonly x: number;
    readonly y: number;
}

export interface SnakeObservation {
    readonly width: number;
    readonly height: number;
    readonly snake: readonly SnakePoint[];
    readonly food: SnakePoint;
    readonly direction: SnakeDirection;
    readonly phase: 'playing' | 'won' | 'lost';
}

export interface SnakeViewState extends Omit<SnakeObservation, 'phase'> {
    readonly phase: SnakePhase;
    readonly controller: SnakeControllerMode;
    readonly score: number;
    readonly bestScore: number;
    readonly speed: number;
    readonly status: string;
    readonly hint: string;
}

export interface SnakeViewActions {
    direction(direction: SnakeDirection): void;
    restart(): void;
}
