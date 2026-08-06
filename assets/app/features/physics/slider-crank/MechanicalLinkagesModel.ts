import type {
    FourBarMechanismSample,
    GenevaMechanismSample,
    MechanicalLinkageCycleSample,
    MechanicalLinkageSample,
    MechanicalLinkagesParameters,
    MechanismPoint,
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
        if (Math.abs(this.phase) > TAU * 1_000_000) {
            this.phase %= TAU;
        }
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
                active: sample.mechanism !== 'geneva' || sample.engaged,
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
            outputAcceleration: secondDerivative
                * angularVelocity
                * angularVelocity,
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
        const firstDerivative = (forward + backward)
            / (2 * DERIVATIVE_STEP);
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
            outputAcceleration: secondDerivative
                * angularVelocity
                * angularVelocity,
            transmissionAngle: points.transmissionAngle,
        };
    }

    private sampleGeneva(phase: number): GenevaMechanismSample {
        const geometry = this.genevaGeometry();
        const inputAngle = this.wrap(phase);
        const output = this.genevaOutputAt(phase, geometry);
        const plus = this.genevaOutputAt(
            phase + DERIVATIVE_STEP,
            geometry,
        );
        const minus = this.genevaOutputAt(
            phase - DERIVATIVE_STEP,
            geometry,
        );
        const firstDerivative = (plus - minus) / (2 * DERIVATIVE_STEP);
        const secondDerivative = (plus - 2 * output + minus)
            / (DERIVATIVE_STEP * DERIVATIVE_STEP);
        const local = this.localGenevaPhase(phase);
        const engagementHalfAngle = Math.PI / 2
            - Math.PI / geometry.slotCount;
        const angularVelocity = this.parametersValue.angularVelocity;
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
            outputVelocity: firstDerivative * angularVelocity,
            outputAcceleration: secondDerivative
                * angularVelocity
                * angularVelocity,
            engaged: Math.abs(local) <= engagementHalfAngle,
        };
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
        const engagementHalfAngle = Math.PI / 2
            - Math.PI / geometry.slotCount;
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
            geometry.centerDistance
                - geometry.driverRadius * Math.cos(local),
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

    private tracePoint(sample: MechanicalLinkageSample): MechanismPoint {
        switch (sample.mechanism) {
            case 'four-bar':
                return sample.couplerPoint;
            case 'geneva':
                return sample.driverPin;
            default:
                return sample.sliderPin;
        }
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
