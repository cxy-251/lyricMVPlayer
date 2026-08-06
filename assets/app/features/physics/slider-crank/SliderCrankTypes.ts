export type SliderCrankDirection = 'clockwise' | 'counterclockwise';
export type MechanicalLinkageKind =
    | 'slider-crank'
    | 'four-bar'
    | 'geneva'
    | 'scotch-yoke'
    | 'quick-return'
    | 'ratchet'
    | 'cam-follower'
    | 'elliptic-gears';
export type MechanicalLinkageConfiguration = 'compact' | 'standard' | 'wide';
export type CamMotionPhase = 'LOW DWELL' | 'RISE' | 'HIGH DWELL' | 'RETURN';

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

export interface ScotchYokeMechanismSample {
    readonly mechanism: 'scotch-yoke';
    readonly inputAngle: number;
    readonly crankCenter: MechanismPoint;
    readonly crankPin: MechanismPoint;
    readonly sliderPin: MechanismPoint;
    readonly crankRadius: number;
    readonly slotHalfHeight: number;
    readonly output: number;
    readonly outputVelocity: number;
    readonly outputAcceleration: number;
}

export interface QuickReturnMechanismSample {
    readonly mechanism: 'quick-return';
    readonly inputAngle: number;
    readonly driverCenter: MechanismPoint;
    readonly leverPivot: MechanismPoint;
    readonly crankPin: MechanismPoint;
    readonly leverPoint: MechanismPoint;
    readonly sliderPin: MechanismPoint;
    readonly crankRadius: number;
    readonly pivotDistance: number;
    readonly leverLength: number;
    readonly connectingRodLength: number;
    readonly output: number;
    readonly outputVelocity: number;
    readonly outputAcceleration: number;
    readonly forwardStroke: boolean;
    readonly quickReturnRatio: number;
}

export interface RatchetMechanismSample {
    readonly mechanism: 'ratchet';
    readonly inputAngle: number;
    readonly driverCenter: MechanismPoint;
    readonly wheelCenter: MechanismPoint;
    readonly crankPin: MechanismPoint;
    readonly pawlTip: MechanismPoint;
    readonly wheelRadius: number;
    readonly toothCount: number;
    readonly output: number;
    readonly outputVelocity: number;
    readonly outputAcceleration: number;
    readonly engaged: boolean;
}

export interface CamFollowerMechanismSample {
    readonly mechanism: 'cam-follower';
    readonly inputAngle: number;
    readonly camCenter: MechanismPoint;
    readonly followerPoint: MechanismPoint;
    readonly profile: readonly MechanismPoint[];
    readonly baseRadius: number;
    readonly lift: number;
    readonly output: number;
    readonly outputVelocity: number;
    readonly outputAcceleration: number;
    readonly motionPhase: CamMotionPhase;
}

export interface EllipticGearsMechanismSample {
    readonly mechanism: 'elliptic-gears';
    readonly inputAngle: number;
    readonly inputCenter: MechanismPoint;
    readonly outputCenter: MechanismPoint;
    readonly semiMajor: number;
    readonly semiMinor: number;
    readonly eccentricity: number;
    readonly inputPitchRadius: number;
    readonly outputPitchRadius: number;
    readonly output: number;
    readonly outputVelocity: number;
    readonly outputAcceleration: number;
}

export type MechanicalLinkageSample =
    | SliderCrankMechanismSample
    | FourBarMechanismSample
    | GenevaMechanismSample
    | ScotchYokeMechanismSample
    | QuickReturnMechanismSample
    | RatchetMechanismSample
    | CamFollowerMechanismSample
    | EllipticGearsMechanismSample;

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
