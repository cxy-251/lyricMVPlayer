export interface LorenzState {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

export interface LorenzParameters {
    readonly sigma: number;
    readonly rho: number;
    readonly beta: number;
}

export interface LorenzSnapshot {
    readonly elapsedTime: number;
    readonly primary: LorenzState;
    readonly shadow: LorenzState;
}

export interface LorenzDiagnostics {
    readonly separation: number;
    readonly logSeparation: number;
    readonly divergence: number;
    readonly hopfThreshold: number | null;
    readonly regime: 'stable-origin' | 'steady-convection' | 'post-hopf';
}

export interface LorenzTrailPoint extends LorenzState {
    readonly time: number;
}

export interface LorenzAttractorViewState {
    readonly snapshot: LorenzSnapshot;
    readonly primaryTrail: readonly LorenzTrailPoint[];
    readonly shadowTrail: readonly LorenzTrailPoint[];
    readonly diagnostics: string;
    readonly modelSummary: string;
    readonly showShadow: boolean;
    readonly rotateView: boolean;
    readonly viewAngle: number;
}
