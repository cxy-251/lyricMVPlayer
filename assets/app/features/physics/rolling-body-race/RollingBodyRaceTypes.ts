export type RollingBodyId =
    | 'solid-sphere'
    | 'solid-cylinder'
    | 'hollow-sphere'
    | 'ring';

export interface RollingBodyDefinition {
    readonly id: RollingBodyId;
    readonly label: string;
    readonly inertiaFactor: number;
}

export interface RollingRaceParameters {
    readonly gravity: number;
    readonly slopeAngleRadians: number;
    readonly rampLength: number;
    readonly radius: number;
}

export interface RollingBodyState extends RollingBodyDefinition {
    readonly distance: number;
    readonly progress: number;
    readonly velocity: number;
    readonly angularPosition: number;
    readonly finishTime: number;
    readonly finished: boolean;
    readonly translationalEnergyFraction: number;
    readonly rotationalEnergyFraction: number;
}

export interface RollingRaceSnapshot {
    readonly elapsedTime: number;
    readonly bodies: readonly RollingBodyState[];
    readonly allFinished: boolean;
}

export interface RollingRaceDiagnostics {
    readonly winner: RollingBodyId;
    readonly winnerLabel: string;
    readonly winnerTime: number;
    readonly lastFinishTime: number;
    readonly raceProgress: number;
}

export interface RollingBodyRaceViewState {
    readonly snapshot: RollingRaceSnapshot;
    readonly diagnostics: RollingRaceDiagnostics;
    readonly parameters: RollingRaceParameters;
    readonly showEnergy: boolean;
    readonly showGuides: boolean;
    readonly diagnosticsText: string;
    readonly modelSummary: string;
}
