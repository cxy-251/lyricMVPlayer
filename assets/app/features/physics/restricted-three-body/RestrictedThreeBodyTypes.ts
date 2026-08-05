export interface CR3BPVector {
    readonly x: number;
    readonly y: number;
}

export interface CR3BPParameters {
    readonly mu: number;
}

export interface CR3BPState extends CR3BPVector {
    readonly vx: number;
    readonly vy: number;
}

export type CR3BPStatus =
    | 'active'
    | 'collision-primary'
    | 'collision-secondary'
    | 'escaped';

export interface CR3BPSnapshot {
    readonly elapsedTime: number;
    readonly state: CR3BPState;
    readonly status: CR3BPStatus;
}

export interface CR3BPDiagnostics {
    readonly jacobiConstant: number;
    readonly normalizedJacobiDrift: number;
    readonly speed: number;
    readonly primaryDistance: number;
    readonly secondaryDistance: number;
}

export interface CR3BPTrailPoint extends CR3BPVector {
    readonly time: number;
}

export interface CR3BPLagrangePoint extends CR3BPVector {
    readonly name: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
}

export interface CR3BPGravityVectors {
    readonly primary: CR3BPVector;
    readonly secondary: CR3BPVector;
}

export interface RestrictedThreeBodyViewState {
    readonly snapshot: CR3BPSnapshot;
    readonly diagnostics: CR3BPDiagnostics;
    readonly primary: CR3BPVector;
    readonly secondary: CR3BPVector;
    readonly lagrangePoints: readonly CR3BPLagrangePoint[];
    readonly gravityVectors: CR3BPGravityVectors;
    readonly trail: readonly CR3BPTrailPoint[];
    readonly showLagrangePoints: boolean;
    readonly showGravityVectors: boolean;
    readonly diagnosticsText: string;
    readonly modelSummary: string;
}
