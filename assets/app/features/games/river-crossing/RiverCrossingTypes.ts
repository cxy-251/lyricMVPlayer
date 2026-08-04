export type RiverCrossingDirection = 'up' | 'down' | 'left' | 'right';
export type RiverCrossingPhase = 'playing' | 'won' | 'lost';
export type RiverCrossingControllerMode = 'human' | 'autopilot';
export type RiverLaneKind = 'safe' | 'road' | 'river' | 'goal';

export interface RiverObjectState {
    readonly x: number;
    readonly width: number;
}

export interface RiverLaneState {
    readonly row: number;
    readonly kind: RiverLaneKind;
    readonly speed: number;
    readonly objects: readonly RiverObjectState[];
}

export interface RiverPlayerState {
    readonly x: number;
    readonly y: number;
}

export interface RiverCrossingObservation {
    readonly width: number;
    readonly height: number;
    readonly player: RiverPlayerState;
    readonly lanes: readonly RiverLaneState[];
    readonly phase: RiverCrossingPhase;
}

export interface RiverCrossingViewState extends RiverCrossingObservation {
    readonly score: number;
    readonly lives: number;
    readonly crossings: number;
    readonly targetCrossings: number;
    readonly controller: RiverCrossingControllerMode;
    readonly status: string;
    readonly hint: string;
}

export interface RiverCrossingViewActions {
    readonly move: (direction: RiverCrossingDirection) => void;
    readonly restart: () => void;
}
