export interface PlanarVector {
    readonly x: number;
    readonly y: number;
}

export interface PlanarBodyState extends PlanarVector {
    readonly mass: number;
    readonly vx: number;
    readonly vy: number;
}

export interface PlanarThreeBodyParameters {
    readonly gravity: number;
    readonly softening: number;
}

export type PlanarThreeBodyPreset =
    | 'figure-eight'
    | 'rotating-triangle'
    | 'binary-visitor';

export interface PlanarThreeBodySnapshot {
    readonly elapsedTime: number;
    readonly bodies: readonly PlanarBodyState[];
}

export interface PlanarThreeBodyDiagnostics {
    readonly totalEnergy: number;
    readonly normalizedEnergyDrift: number;
    readonly momentum: PlanarVector;
    readonly momentumMagnitude: number;
    readonly barycenter: PlanarVector;
    readonly minimumDistance: number;
}

export interface PlanarTrailPoint extends PlanarVector {
    readonly time: number;
}

export interface PlanarThreeBodyViewState {
    readonly snapshot: PlanarThreeBodySnapshot;
    readonly diagnostics: PlanarThreeBodyDiagnostics;
    readonly accelerations: readonly PlanarVector[];
    readonly trails: readonly (readonly PlanarTrailPoint[])[];
    readonly preset: PlanarThreeBodyPreset;
    readonly showVelocityVectors: boolean;
    readonly showBarycenter: boolean;
    readonly diagnosticsText: string;
    readonly modelSummary: string;
}
