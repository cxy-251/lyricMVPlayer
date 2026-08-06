import type {
    CamFollowerMechanismSample,
    CamMotionPhase,
    EllipticGearsMechanismSample,
    FourBarMechanismSample,
    GenevaMechanismSample,
    MechanicalLinkageCycleSample,
    MechanicalLinkageSample,
    MechanicalLinkagesParameters,
    MechanismPoint,
    QuickReturnMechanismSample,
    RatchetMechanismSample,
    ScotchYokeMechanismSample,
    SliderCrankMechanismSample,
} from './SliderCrankTypes';

const TAU = Math.PI * 2;
const DERIVATIVE_STEP = 1e-4;

interface FourBarGeometry {
    readonly input: number;
    readonly coupler: number;
    readonly output: number;
    readonly ground: number;
}

interface GenevaGeometry {
    readonly centerDistance: number;
    readonly driverRadius: number;
    readonly wheelRadius: number;
    readonly slotCount: number;
}

interface QuickReturnGeometry {
    readonly crankRadius: number;
    readonly pivotDistance: number;
    readonly leverLength: number;
    readonly connectingRodLength: number;
}

interface RatchetGeometry {
    readonly centerDistance: number;
    readonly crankRadius: number;
    readonly wheelRadius: number;
    readonly toothCount: number;
}

interface EllipticGearGeometry {
    readonly semiMajor: number;
    readonly semiMinor: number;
    readonly eccentricity: number;
    readonly centerDistance: number;
}

export class MechanicalLinkagesModel {
    private parametersValue: MechanicalLinkagesParameters;
    private phase = 0;

    constructor(parameters: MechanicalLinkagesParameters) {
        this.parametersValue = this.validate(parameters);
    }

    get parameters(): MechanicalLinkagesParameters {
        return this.parametersValue;
    }

    setParameters(parameters: MechanicalLinkagesParameters): void {
        this.parametersValue = this.validate(parameters);
    }

    reset(phase = 0): void {
        if (!Number.isFinite(phase)) {
            throw new Error('Mechanical linkage phase must be finite');
        }
        this.phase = phase;
    }

    advance(seconds: number): void {
        if (!Number.isFinite(seconds)) {
            throw new Error('Mechanical linkage time step must be finite');
        }
        this.phase += Math.max(0, seconds) * this.parametersValue.angularVelocity;
        if (Math.abs(this.phase) > TAU * 1_000_000) this.phase %= TAU;
    }

    snapshot(): MechanicalLinkageSample {
        return this.sampleAt(this.phase);
    }

    sampleAt(phase: number): MechanicalLinkageSample {
        if (!Number.isFinite(phase)) {
            throw new Error('Mechanical linkage sample phase must be finite');
        }
        switch (this.parametersValue.mechanism) {
            case 'four-bar':
                return this.sampleFourBar(phase);
            case 'geneva':
                return this.sampleGeneva(phase);
            case 'scotch-yoke':
                return this.sampleScotchYoke(phase);
            case 'quick-return':
                return this.sampleQuickReturn(phase);
            case 'ratchet':
                return this.sampleRatchet(phase);
            case 'cam-follower':
                return this.sampleCamFollower(phase);
            case 'elliptic-gears':
                return this.sampleEllipticGears(phase);
            default:
                return this.sampleSliderCrank(phase);
        }
    }

    sampleCycle(sampleCount = 181): MechanicalLinkageCycleSample[] {
        const count = Math.max(32, Math.round(sampleCount));
        const result: MechanicalLinkageCycleSample[] = [];
        for (let index = 0; index < count; index += 1) {
            const angle = TAU * index / (count - 1);
            const sample = this.sampleAt(angle);
            result.push({
                angle,
                output: sample.output,
                velocity: sample.outputVelocity,
                acceleration: sample.outputAcceleration,
                tracePoint: this.tracePoint(sample),
                active: this.isActive(sample),
            });
        }
        return result;
    }

    private sampleSliderCrank(phase: number): SliderCrankMechanismSample {
        const inputAngle = this.wrap(phase);
        const scale = this.parametersValue.scale;
        const crankRadius = 0.8 * scale;
        const ratio = this.parametersValue.configuration === 'compact'
            ? 2.4
            : this.parametersValue.configuration === 'wide'
                ? 4.6
                : 3.5;
        const rodLength = crankRadius * ratio;
        const sine = Math.sin(inputAngle);
        const cosine = Math.cos(inputAngle);
        const rootSquared = Math.max(
            1e-12,
            rodLength * rodLength - crankRadius * crankRadius * sine * sine,
        );
        const root = Math.sqrt(rootSquared);
        const output = crankRadius * cosine + root;
        const derivative = -crankRadius * sine
            - crankRadius * crankRadius * sine * cosine / root;
        const secondDerivative = -crankRadius * cosine
            - crankRadius * crankRadius * (
                (cosine * cosine - sine * sine) / root
                + crankRadius * crankRadius * sine * sine * cosine * cosine
                    / (rootSquared * root)
            );
        const angularVelocity = this.parametersValue.angularVelocity;
        const minimum = rodLength - crankRadius;
        return {
            mechanism: 'slider-crank',
            inputAngle,
            crankCenter: { x: 0, y: 0 },
            crankPin: {
                x: crankRadius * cosine,
                y: crankRadius * sine,
            },
            sliderPin: { x: output, y: 0 },
            crankRadius,
            rodLength,
            output,
            outputVelocity: derivative * angularVelocity,
            outputAcceleration: secondDerivative * angularVelocity * angularVelocity,
            strokeFraction: this.clamp(
                (output - minimum) / (2 * crankRadius),
                0,
                1,
            ),
        };
    }

    private sampleFourBar(phase: number): FourBarMechanismSample {
        const inputAngle = this.wrap(phase);
        const geometry = this.fourBarGeometry();
        const points = this.solveFourBar(inputAngle, geometry);
        const output = points.outputAngle;
        const plus = this.solveFourBar(
            inputAngle + DERIVATIVE_STEP,
            geometry,
        ).outputAngle;
        const minus = this.solveFourBar(
            inputAngle - DERIVATIVE_STEP,
            geometry,
        ).outputAngle;
        const forward = this.angleDifference(plus, output);
        const backward = this.angleDifference(output, minus);
        const firstDerivative = (forward + backward) / (2 * DERIVATIVE_STEP);
        const secondDerivative = (forward - backward)
            / (DERIVATIVE_STEP * DERIVATIVE_STEP);
        const angularVelocity = this.parametersValue.angularVelocity;
        const couplerPoint = {
            x: points.crankPin.x
                + (points.couplerPin.x - points.crankPin.x) * 0.55
                - (points.couplerPin.y - points.crankPin.y) * 0.18,
            y: points.crankPin.y
                + (points.couplerPin.y - points.crankPin.y) * 0.55
                + (points.couplerPin.x - points.crankPin.x) * 0.18,
        };
        return {
            mechanism: 'four-bar',
            inputAngle,
            fixedInput: { x: 0, y: 0 },
            fixedOutput: { x: geometry.ground, y: 0 },
            crankPin: points.crankPin,
            couplerPin: points.couplerPin,
            couplerPoint,
            inputLength: geometry.input,
            couplerLength: geometry.coupler,
            outputLength: geometry.output,
            groundLength: geometry.ground,
            output,
            outputVelocity: firstDerivative * angularVelocity,
            outputAcceleration: secondDerivative * angularVelocity * angularVelocity,
            transmissionAngle: points.transmissionAngle,
        };
    }

    private sampleGeneva(phase: number): GenevaMechanismSample {
        const geometry = this.genevaGeometry();
        const inputAngle = this.wrap(phase);
        const output = this.genevaOutputAt(phase, geometry);
        const derivatives = this.scalarDerivatives(
            phase,
            (value) => this.genevaOutputAt(value, geometry),
        );
        const local = this.localGenevaPhase(phase);
        const engagementHalfAngle = Math.PI / 2 - Math.PI / geometry.slotCount;
        return {
            mechanism: 'geneva',
            inputAngle,
            driverCenter: { x: 0, y: 0 },
            wheelCenter: { x: geometry.centerDistance, y: 0 },
            driverPin: {
                x: geometry.driverRadius * Math.cos(phase),
                y: geometry.driverRadius * Math.sin(phase),
            },
            centerDistance: geometry.centerDistance,
            driverRadius: geometry.driverRadius,
            wheelRadius: geometry.wheelRadius,
            slotCount: geometry.slotCount,
            output,
            outputVelocity: derivatives.velocity,
            outputAcceleration: derivatives.acceleration,
            engaged: Math.abs(local) <= engagementHalfAngle,
        };
    }

    private sampleScotchYoke(phase: number): ScotchYokeMechanismSample {
        const inputAngle = this.wrap(phase);
        const scale = this.parametersValue.scale;
        const crankRadius = (this.parametersValue.configuration === 'compact'
            ? 0.65
            : this.parametersValue.configuration === 'wide'
                ? 1.05
                : 0.82) * scale;
        const angularVelocity = this.parametersValue.angularVelocity;
        const output = crankRadius * Math.cos(inputAngle);
        return {
            mechanism: 'scotch-yoke',
            inputAngle,
            crankCenter: { x: 0, y: 0 },
            crankPin: {
                x: output,
                y: crankRadius * Math.sin(inputAngle),
            },
            sliderPin: { x: output, y: 0 },
            crankRadius,
            slotHalfHeight: crankRadius * 1.28,
            output,
            outputVelocity: -crankRadius
                * Math.sin(inputAngle)
                * angularVelocity,
            outputAcceleration: -crankRadius
                * Math.cos(inputAngle)
                * angularVelocity
                * angularVelocity,
        };
    }

    private sampleQuickReturn(phase: number): QuickReturnMechanismSample {
        const inputAngle = this.wrap(phase);
        const geometry = this.quickReturnGeometry();
        const state = this.quickReturnAt(phase, geometry);
        const derivatives = this.scalarDerivatives(
            phase,
            (value) => this.quickReturnAt(value, geometry).sliderPin.x,
        );
        const alpha = Math.asin(this.clamp(
            geometry.crankRadius / geometry.pivotDistance,
            -0.999,
            0.999,
        ));
        return {
            mechanism: 'quick-return',
            inputAngle,
            driverCenter: { x: 0, y: 0 },
            leverPivot: { x: geometry.pivotDistance, y: 0 },
            crankPin: state.crankPin,
            leverPoint: state.leverPoint,
            sliderPin: state.sliderPin,
            crankRadius: geometry.crankRadius,
            pivotDistance: geometry.pivotDistance,
            leverLength: geometry.leverLength,
            connectingRodLength: geometry.connectingRodLength,
            output: state.sliderPin.x,
            outputVelocity: derivatives.velocity,
            outputAcceleration: derivatives.acceleration,
            forwardStroke: derivatives.velocity >= 0,
            quickReturnRatio: (Math.PI + 2 * alpha) / (Math.PI - 2 * alpha),
        };
    }

    private sampleRatchet(phase: number): RatchetMechanismSample {
        const geometry = this.ratchetGeometry();
        const inputAngle = this.wrap(phase);
        const output = this.ratchetOutputAt(phase, geometry);
        const derivatives = this.scalarDerivatives(
            phase,
            (value) => this.ratchetOutputAt(value, geometry),
        );
        const local = this.positiveLocalPhase(phase);
        const wheelCenter = { x: geometry.centerDistance, y: 0 };
        const pawlAngle = Math.PI + 0.24;
        return {
            mechanism: 'ratchet',
            inputAngle,
            driverCenter: { x: 0, y: 0 },
            wheelCenter,
            crankPin: {
                x: geometry.crankRadius * Math.cos(phase),
                y: geometry.crankRadius * Math.sin(phase),
            },
            pawlTip: {
                x: wheelCenter.x + geometry.wheelRadius * Math.cos(pawlAngle),
                y: wheelCenter.y + geometry.wheelRadius * Math.sin(pawlAngle),
            },
            wheelRadius: geometry.wheelRadius,
            toothCount: geometry.toothCount,
            output,
            outputVelocity: derivatives.velocity,
            outputAcceleration: derivatives.acceleration,
            engaged: local <= Math.PI,
        };
    }

    private sampleCamFollower(phase: number): CamFollowerMechanismSample {
        const inputAngle = this.wrap(phase);
        const scale = this.parametersValue.scale;
        const baseRadius = (this.parametersValue.configuration === 'compact'
            ? 0.78
            : this.parametersValue.configuration === 'wide'
                ? 1.1
                : 0.92) * scale;
        const lift = (this.parametersValue.configuration === 'compact'
            ? 0.42
            : this.parametersValue.configuration === 'wide'
                ? 0.82
                : 0.62) * scale;
        const output = this.camDisplacementAt(phase, lift);
        const derivatives = this.scalarDerivatives(
            phase,
            (value) => this.camDisplacementAt(value, lift),
        );
        const profile: MechanismPoint[] = [];
        const samples = 72;
        for (let index = 0; index < samples; index += 1) {
            const bodyAngle = TAU * index / samples;
            const radius = baseRadius + this.camDisplacementAt(
                Math.PI / 2 - bodyAngle,
                lift,
            );
            const worldAngle = bodyAngle + inputAngle;
            profile.push({
                x: Math.cos(worldAngle) * radius,
                y: Math.sin(worldAngle) * radius,
            });
        }
        return {
            mechanism: 'cam-follower',
            inputAngle,
            camCenter: { x: 0, y: 0 },
            followerPoint: { x: 0, y: baseRadius + output },
            profile,
            baseRadius,
            lift,
            output,
            outputVelocity: derivatives.velocity,
            outputAcceleration: derivatives.acceleration,
            motionPhase: this.camMotionPhase(phase),
        };
    }

    private sampleEllipticGears(phase: number): EllipticGearsMechanismSample {
        const geometry = this.ellipticGearGeometry();
        const inputAngle = this.wrap(phase);
        const output = this.ellipticOutputAt(phase, geometry.eccentricity);
        const derivatives = this.scalarDerivatives(
            phase,
            (value) => this.ellipticOutputAt(value, geometry.eccentricity),
        );
        const inputPitchRadius = geometry.semiMajor
            * (1 - geometry.eccentricity * geometry.eccentricity)
            / (1 + geometry.eccentricity * Math.cos(phase));
        return {
            mechanism: 'elliptic-gears',
            inputAngle,
            inputCenter: { x: 0, y: 0 },
            outputCenter: { x: geometry.centerDistance, y: 0 },
            semiMajor: geometry.semiMajor,
            semiMinor: geometry.semiMinor,
            eccentricity: geometry.eccentricity,
            inputPitchRadius,
            outputPitchRadius: geometry.centerDistance - inputPitchRadius,
            output,
            outputVelocity: derivatives.velocity,
            outputAcceleration: derivatives.acceleration,
        };
    }

    private quickReturnAt(
        phase: number,
        geometry: QuickReturnGeometry,
    ): {
        readonly crankPin: MechanismPoint;
        readonly leverPoint: MechanismPoint;
        readonly sliderPin: MechanismPoint;
    } {
        const crankPin = {
            x: geometry.crankRadius * Math.cos(phase),
            y: geometry.crankRadius * Math.sin(phase),
        };
        const leverPivot = { x: geometry.pivotDistance, y: 0 };
        const leverAngle = Math.atan2(
            crankPin.y - leverPivot.y,
            crankPin.x - leverPivot.x,
        );
        const leverPoint = {
            x: leverPivot.x + geometry.leverLength * Math.cos(leverAngle),
            y: leverPivot.y + geometry.leverLength * Math.sin(leverAngle),
        };
        const horizontal = Math.sqrt(Math.max(
            1e-12,
            geometry.connectingRodLength * geometry.connectingRodLength
                - leverPoint.y * leverPoint.y,
        ));
        return {
            crankPin,
            leverPoint,
            sliderPin: { x: leverPoint.x + horizontal, y: 0 },
        };
    }

    private ratchetOutputAt(phase: number, geometry: RatchetGeometry): number {
        const toothStep = TAU / geometry.toothCount;
        const revolution = Math.floor(phase / TAU);
        const local = phase - revolution * TAU;
        const progress = local <= Math.PI
            ? this.smootherStep(local / Math.PI)
            : 1;
        return (revolution + progress) * toothStep;
    }

    private camDisplacementAt(phase: number, lift: number): number {
        const angle = this.wrap(phase);
        const degrees = angle * 180 / Math.PI;
        if (degrees < 45) return 0;
        if (degrees < 150) {
            return lift * this.smootherStep((degrees - 45) / 105);
        }
        if (degrees < 210) return lift;
        if (degrees < 330) {
            return lift * (1 - this.smootherStep((degrees - 210) / 120));
        }
        return 0;
    }

    private camMotionPhase(phase: number): CamMotionPhase {
        const degrees = this.wrap(phase) * 180 / Math.PI;
        if (degrees < 45 || degrees >= 330) return 'LOW DWELL';
        if (degrees < 150) return 'RISE';
        if (degrees < 210) return 'HIGH DWELL';
        return 'RETURN';
    }

    private ellipticOutputAt(phase: number, eccentricity: number): number {
        const revolution = Math.floor(phase / TAU);
        const local = phase - revolution * TAU;
        const mapped = 2 * Math.atan2(
            (1 - eccentricity) * Math.sin(local / 2),
            (1 + eccentricity) * Math.cos(local / 2),
        );
        return -(revolution * TAU + mapped);
    }

    private solveFourBar(
        angle: number,
        geometry: FourBarGeometry,
    ): {
        readonly crankPin: MechanismPoint;
        readonly couplerPin: MechanismPoint;
        readonly outputAngle: number;
        readonly transmissionAngle: number;
    } {
        const crankPin = {
            x: geometry.input * Math.cos(angle),
            y: geometry.input * Math.sin(angle),
        };
        const fixedOutput = { x: geometry.ground, y: 0 };
        const dx = fixedOutput.x - crankPin.x;
        const dy = fixedOutput.y - crankPin.y;
        const distance = Math.hypot(dx, dy);
        if (
            distance <= 1e-9
            || distance > geometry.coupler + geometry.output
            || distance < Math.abs(geometry.coupler - geometry.output)
        ) {
            throw new Error('Four-bar configuration cannot close at this input angle');
        }
        const along = (
            geometry.coupler * geometry.coupler
            - geometry.output * geometry.output
            + distance * distance
        ) / (2 * distance);
        const height = Math.sqrt(Math.max(
            0,
            geometry.coupler * geometry.coupler - along * along,
        ));
        const baseX = crankPin.x + dx * along / distance;
        const baseY = crankPin.y + dy * along / distance;
        const perpendicularX = -dy / distance;
        const perpendicularY = dx / distance;
        const first = {
            x: baseX + perpendicularX * height,
            y: baseY + perpendicularY * height,
        };
        const second = {
            x: baseX - perpendicularX * height,
            y: baseY - perpendicularY * height,
        };
        const couplerPin = first.y >= second.y ? first : second;
        const outputAngle = Math.atan2(
            couplerPin.y - fixedOutput.y,
            couplerPin.x - fixedOutput.x,
        );
        const couplerVector = {
            x: crankPin.x - couplerPin.x,
            y: crankPin.y - couplerPin.y,
        };
        const outputVector = {
            x: fixedOutput.x - couplerPin.x,
            y: fixedOutput.y - couplerPin.y,
        };
        const cosine = this.clamp(
            (
                couplerVector.x * outputVector.x
                + couplerVector.y * outputVector.y
            ) / (geometry.coupler * geometry.output),
            -1,
            1,
        );
        return {
            crankPin,
            couplerPin,
            outputAngle,
            transmissionAngle: Math.acos(cosine),
        };
    }

    private genevaOutputAt(phase: number, geometry: GenevaGeometry): number {
        const step = TAU / geometry.slotCount;
        const engagementHalfAngle = Math.PI / 2 - Math.PI / geometry.slotCount;
        const revolution = Math.round(phase / TAU);
        const local = phase - revolution * TAU;
        if (local < -engagementHalfAngle) {
            return revolution * step - step / 2;
        }
        if (local > engagementHalfAngle) {
            return revolution * step + step / 2;
        }
        return revolution * step + Math.atan2(
            geometry.driverRadius * Math.sin(local),
            geometry.centerDistance - geometry.driverRadius * Math.cos(local),
        );
    }

    private localGenevaPhase(phase: number): number {
        const revolution = Math.round(phase / TAU);
        return phase - revolution * TAU;
    }

    private fourBarGeometry(): FourBarGeometry {
        const scale = this.parametersValue.scale;
        switch (this.parametersValue.configuration) {
            case 'compact':
                return {
                    input: 0.65 * scale,
                    coupler: 1.7 * scale,
                    output: 1.3 * scale,
                    ground: 1.9 * scale,
                };
            case 'wide':
                return {
                    input: 1.0 * scale,
                    coupler: 2.6 * scale,
                    output: 1.85 * scale,
                    ground: 2.8 * scale,
                };
            default:
                return {
                    input: 0.8 * scale,
                    coupler: 2.1 * scale,
                    output: 1.55 * scale,
                    ground: 2.3 * scale,
                };
        }
    }

    private genevaGeometry(): GenevaGeometry {
        const scale = this.parametersValue.scale;
        const slotCount = this.parametersValue.configuration === 'compact'
            ? 4
            : this.parametersValue.configuration === 'wide'
                ? 8
                : 6;
        const centerDistance = 2.2 * scale;
        return {
            centerDistance,
            driverRadius: centerDistance * Math.sin(Math.PI / slotCount),
            wheelRadius: centerDistance * 0.66,
            slotCount,
        };
    }

    private quickReturnGeometry(): QuickReturnGeometry {
        const scale = this.parametersValue.scale;
        const factor = this.parametersValue.configuration === 'compact'
            ? 0.82
            : this.parametersValue.configuration === 'wide'
                ? 1.18
                : 1;
        return {
            crankRadius: 0.55 * scale * factor,
            pivotDistance: 1.28 * scale * factor,
            leverLength: 1.85 * scale * factor,
            connectingRodLength: 2.35 * scale * factor,
        };
    }

    private ratchetGeometry(): RatchetGeometry {
        const scale = this.parametersValue.scale;
        const toothCount = this.parametersValue.configuration === 'compact'
            ? 8
            : this.parametersValue.configuration === 'wide'
                ? 16
                : 12;
        return {
            centerDistance: 2.05 * scale,
            crankRadius: 0.72 * scale,
            wheelRadius: 0.95 * scale,
            toothCount,
        };
    }

    private ellipticGearGeometry(): EllipticGearGeometry {
        const scale = this.parametersValue.scale;
        const eccentricity = this.parametersValue.configuration === 'compact'
            ? 0.22
            : this.parametersValue.configuration === 'wide'
                ? 0.48
                : 0.35;
        const semiMajor = 1.18 * scale;
        const semiMinor = semiMajor * Math.sqrt(1 - eccentricity * eccentricity);
        return {
            semiMajor,
            semiMinor,
            eccentricity,
            centerDistance: 2 * semiMajor,
        };
    }

    private scalarDerivatives(
        phase: number,
        evaluate: (value: number) => number,
    ): { readonly velocity: number; readonly acceleration: number } {
        const center = evaluate(phase);
        const plus = evaluate(phase + DERIVATIVE_STEP);
        const minus = evaluate(phase - DERIVATIVE_STEP);
        const first = (plus - minus) / (2 * DERIVATIVE_STEP);
        const second = (plus - 2 * center + minus)
            / (DERIVATIVE_STEP * DERIVATIVE_STEP);
        const angularVelocity = this.parametersValue.angularVelocity;
        return {
            velocity: first * angularVelocity,
            acceleration: second * angularVelocity * angularVelocity,
        };
    }

    private tracePoint(sample: MechanicalLinkageSample): MechanismPoint {
        switch (sample.mechanism) {
            case 'four-bar':
                return sample.couplerPoint;
            case 'geneva':
                return sample.driverPin;
            case 'scotch-yoke':
                return sample.sliderPin;
            case 'quick-return':
                return sample.sliderPin;
            case 'ratchet':
                return sample.pawlTip;
            case 'cam-follower':
                return sample.followerPoint;
            case 'elliptic-gears':
                return {
                    x: sample.outputCenter.x
                        + Math.cos(sample.output) * sample.semiMajor,
                    y: sample.outputCenter.y
                        + Math.sin(sample.output) * sample.semiMinor,
                };
            default:
                return sample.sliderPin;
        }
    }

    private isActive(sample: MechanicalLinkageSample): boolean {
        if (sample.mechanism === 'geneva' || sample.mechanism === 'ratchet') {
            return sample.engaged;
        }
        if (sample.mechanism === 'cam-follower') {
            return sample.motionPhase === 'RISE' || sample.motionPhase === 'RETURN';
        }
        return true;
    }

    private validate(
        parameters: MechanicalLinkagesParameters,
    ): MechanicalLinkagesParameters {
        if (
            !Number.isFinite(parameters.scale)
            || !Number.isFinite(parameters.angularVelocity)
        ) {
            throw new Error('Mechanical linkage parameters must be finite');
        }
        if (parameters.scale <= 0) {
            throw new Error('Mechanical linkage scale must be positive');
        }
        return { ...parameters };
    }

    private smootherStep(value: number): number {
        const x = this.clamp(value, 0, 1);
        return x * x * x * (x * (x * 6 - 15) + 10);
    }

    private positiveLocalPhase(phase: number): number {
        const revolution = Math.floor(phase / TAU);
        return phase - revolution * TAU;
    }

    private angleDifference(a: number, b: number): number {
        let difference = (a - b) % TAU;
        if (difference > Math.PI) difference -= TAU;
        if (difference < -Math.PI) difference += TAU;
        return difference;
    }

    private wrap(value: number): number {
        const wrapped = value % TAU;
        return wrapped < 0 ? wrapped + TAU : wrapped;
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
