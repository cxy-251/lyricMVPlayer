export type SliderCrankDirection = 'clockwise' | 'counterclockwise';

export interface SliderCrankParameters {
    readonly crankRadius: number;
    readonly rodLength: number;
    readonly angularVelocity: number;
}

export interface MechanismPoint {
    readonly x: number;
    readonly y: number;
}

export interface SliderCrankSample {
    readonly angle: number;
    readonly crankPin: MechanismPoint;
    readonly pistonPin: MechanismPoint;
    readonly pistonPosition: number;
    readonly pistonVelocity: number;
    readonly pistonAcceleration: number;
    readonly rodAngle: number;
    readonly strokeFraction: number;
}

export interface SliderCrankCycleSample {
    readonly angle: number;
    readonly position: number;
    readonly velocity: number;
    readonly acceleration: number;
}

export interface SliderCrankViewState {
    readonly sample: SliderCrankSample;
    readonly cycle: readonly SliderCrankCycleSample[];
    readonly crankRadius: number;
    readonly rodLength: number;
    readonly rpm: number;
    readonly direction: SliderCrankDirection;
    readonly maximumVelocity: number;
    readonly maximumAcceleration: number;
    readonly showVelocity: boolean;
    readonly showAcceleration: boolean;
    readonly showPlot: boolean;
    readonly diagnosticsText: string;
    readonly modelSummary: string;
}
