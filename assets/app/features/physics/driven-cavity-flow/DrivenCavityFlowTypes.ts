export type CavityResolution = 'low' | 'medium' | 'high';
export type CavityDisplayMode = 'speed' | 'pressure' | 'vorticity' | 'tracers';

export interface DrivenCavityFlowParameters {
    readonly width: number;
    readonly height: number;
    readonly lidSpeed: number;
    readonly kinematicViscosity: number;
}

export interface CavityVelocity {
    readonly x: number;
    readonly y: number;
}

export interface CavityTracer {
    x: number;
    y: number;
}

export interface DrivenCavityFlowDiagnostics {
    readonly reynoldsNumber: number;
    readonly relaxationTime: number;
    readonly totalMass: number;
    readonly normalizedMassDrift: number;
    readonly maximumSpeed: number;
    readonly meanSpeed: number;
    readonly topMeanVelocityX: number;
}

export interface DrivenCavityFlowSnapshot {
    readonly width: number;
    readonly height: number;
    readonly elapsedSteps: number;
    readonly density: Float32Array;
    readonly velocityX: Float32Array;
    readonly velocityY: Float32Array;
    readonly vorticity: Float32Array;
}

export interface DrivenCavityFlowViewState {
    readonly snapshot: DrivenCavityFlowSnapshot;
    readonly diagnostics: DrivenCavityFlowDiagnostics;
    readonly tracers: readonly CavityTracer[];
    readonly displayMode: CavityDisplayMode;
    readonly showVectors: boolean;
    readonly showGrid: boolean;
    readonly diagnosticsText: string;
    readonly modelSummary: string;
}
