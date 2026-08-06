export type SliderCrankDirection = 'clockwise' | 'counterclockwise';
export type MechanicalLinkageKind = 'slider-crank' | 'four-bar' | 'geneva';
export type MechanicalLinkageConfiguration = 'compact' | 'standard' | 'wide';

export interface MechanismPoint {
    readonly x: number;
    readonly y: number;
}

export interface MechanicalLinkagesParameters {
    readonly mechanism: MechanicalLinkageKind;
    readonly configuration: MechanicalLinkageConfiguration;
    readonly scale: number;
    readonly angularVelocity: number;
}

export interface SliderCrankMechanismSample {
    readonly mechanism: 'slider-crank';
    readonly inputAngle: number;
    readonly crankCenter: MechanismPoint;
    readonly crankPin: MechanismPoint;
    readonly sliderPin: MechanismPoint;
    readonly crankRadius: number;
    readonly rodLength: number;
    readonly output: number;
    readonly outputVelocity: number;
    readonly outputAcceleration: number;
    readonly strokeFraction: number;
}

export interface FourBarMechanismSample {
    readonly mechanism: 'four-bar';
    readonly inputAngle: number;
    readonly fixedInput: MechanismPoint;
    readonly fixedOutput: MechanismPoint;
    readonly crankPin: MechanismPoint;
    readonly couplerPin: MechanismPoint;
    readonly couplerPoint: MechanismPoint;
    readonly inputLength: number;
    readonly couplerLength: number;
    readonly outputLength: number;
    readonly groundLength: number;
    readonly output: number;
    readonly outputVelocity: number;
    readonly outputAcceleration: number;
    readonly transmissionAngle: number;
}

export interface GenevaMechanismSample {
    readonly mechanism: 'geneva';
    readonly inputAngle: number;
    readonly driverCenter: MechanismPoint;
    readonly wheelCenter: MechanismPoint;
    readonly driverPin: MechanismPoint;
    readonly centerDistance: number;
    readonly driverRadius: number;
    readonly wheelRadius: number;
    readonly slotCount: number;
    readonly output: number;
    readonly outputVelocity: number;
    readonly outputAcceleration: number;
    readonly engaged: boolean;
}

export type MechanicalLinkageSample =
    | SliderCrankMechanismSample
    | FourBarMechanismSample
    | GenevaMechanismSample;

export interface MechanicalLinkageCycleSample {
    readonly angle: number;
    readonly output: number;
    readonly velocity: number;
    readonly acceleration: number;
    readonly tracePoint: MechanismPoint;
    readonly active: boolean;
}

export interface SliderCrankViewState {
    readonly mechanism: MechanicalLinkageKind;
    readonly configuration: MechanicalLinkageConfiguration;
    readonly sample: MechanicalLinkageSample;
    readonly cycleSamples: readonly MechanicalLinkageCycleSample[];
    readonly rpm: number;
    readonly direction: SliderCrankDirection;
    readonly outputMinimum: number;
    readonly outputMaximum: number;
    readonly maximumVelocity: number;
    readonly maximumAcceleration: number;
    readonly showKinematics: boolean;
    readonly showTrace: boolean;
    readonly showPlot: boolean;
    readonly diagnosticsText: string;
    readonly modelSummary: string;
}
