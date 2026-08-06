export type BilliardBoundary = 'stadium' | 'circle';

export interface BilliardVector {
    readonly x: number;
    readonly y: number;
}

export interface BilliardParticleState extends BilliardVector {
    readonly vx: number;
    readonly vy: number;
}

export interface BilliardCollisionMarker {
    readonly point: BilliardVector;
    readonly normal: BilliardVector;
}

export interface ChaoticBilliardsParameters {
    readonly boundary: BilliardBoundary;
    readonly radius: number;
    readonly straightHalfLength: number;
    readonly particleSpeed: number;
}

export interface ChaoticBilliardsSnapshot {
    readonly elapsedTime: number;
    readonly primary: BilliardParticleState;
    readonly nearby: BilliardParticleState;
    readonly primaryCollisionCount: number;
    readonly nearbyCollisionCount: number;
    readonly primaryCollision: BilliardCollisionMarker | null;
    readonly nearbyCollision: BilliardCollisionMarker | null;
}

export interface ChaoticBilliardsDiagnostics {
    readonly separation: number;
    readonly logarithmicSeparation: number;
    readonly primarySpeed: number;
    readonly nearbySpeed: number;
}

export interface BilliardTrailPoint extends BilliardVector {
    readonly time: number;
}

export interface ChaoticBilliardsViewState {
    readonly snapshot: ChaoticBilliardsSnapshot;
    readonly diagnostics: ChaoticBilliardsDiagnostics;
    readonly parameters: ChaoticBilliardsParameters;
    readonly primaryTrail: readonly BilliardTrailPoint[];
    readonly nearbyTrail: readonly BilliardTrailPoint[];
    readonly showNearby: boolean;
    readonly diagnosticsText: string;
    readonly modelSummary: string;
}
