import type { Point2 } from '../../../graphics/TrailBuffer';

export interface MassSpringDamperParameters {
    readonly mass: number;
    readonly stiffness: number;
    readonly damping: number;
    readonly forcingAmplitude: number;
    readonly forcingFrequency: number;
}

export interface MassSpringDamperInitialState {
    readonly displacement: number;
    readonly velocity: number;
}

export interface MassSpringDamperSnapshot {
    readonly elapsedTime: number;
    readonly displacement: number;
    readonly velocity: number;
    readonly acceleration: number;
    readonly appliedForce: number;
}

export interface MassSpringDamperDiagnostics {
    readonly naturalFrequency: number;
    readonly dampingRatio: number;
    readonly dampedFrequency: number;
    readonly mechanicalEnergy: number;
    readonly dissipatedEnergy: number;
    readonly inputWork: number;
    readonly energyBalanceError: number;
    readonly regime: 'underdamped' | 'critical' | 'overdamped';
}

export interface MassSpringDamperViewState {
    readonly snapshot: MassSpringDamperSnapshot;
    readonly trail: readonly Point2[];
    readonly displayRange: number;
    readonly showTrace: boolean;
    readonly diagnostics: string;
    readonly modelSummary: string;
}
