export interface DoublePendulumState {
    readonly theta1: number;
    readonly theta2: number;
    readonly omega1: number;
    readonly omega2: number;
}

export interface DoublePendulumParameters {
    readonly gravity: number;
    readonly mass1: number;
    readonly mass2: number;
    readonly length1: number;
    readonly length2: number;
}

export interface DoublePendulumPoint {
    readonly x: number;
    readonly y: number;
}

export interface DoublePendulumPositions {
    readonly first: DoublePendulumPoint;
    readonly second: DoublePendulumPoint;
}

export interface DoublePendulumDiagnostics {
    readonly elapsedTime: number;
    readonly totalEnergy: number;
    readonly absoluteEnergyDrift: number;
    readonly normalizedEnergyDrift: number;
}

export interface DoublePendulumViewState {
    readonly positions: DoublePendulumPositions;
    readonly trail: readonly DoublePendulumPoint[];
    readonly companionPositions: DoublePendulumPositions;
    readonly companionTrail: readonly DoublePendulumPoint[];
    readonly mass1: number;
    readonly mass2: number;
    readonly length1: number;
    readonly length2: number;
    readonly showTrail: boolean;
    readonly presetIndex: number;
    readonly elapsedTime: number;
    readonly divergence: number;
    readonly diagnostics: string;
}
