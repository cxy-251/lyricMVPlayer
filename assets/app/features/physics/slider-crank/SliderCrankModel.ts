import type {
    SliderCrankCycleSample,
    SliderCrankParameters,
    SliderCrankSample,
} from './SliderCrankTypes';

const TAU = Math.PI * 2;

export class SliderCrankModel {
    private params: SliderCrankParameters;
    private angle = 0;

    constructor(parameters: SliderCrankParameters) {
        this.params = this.validate(parameters);
    }

    get parameters(): SliderCrankParameters {
        return this.params;
    }

    setParameters(parameters: SliderCrankParameters): void {
        this.params = this.validate(parameters);
    }

    reset(angle = 0): void {
        if (!Number.isFinite(angle)) {
            throw new Error('Slider-crank angle must be finite');
        }
        this.angle = this.wrap(angle);
    }

    advance(seconds: number): void {
        if (!Number.isFinite(seconds)) {
            throw new Error('Slider-crank time step must be finite');
        }
        this.angle = this.wrap(
            this.angle + Math.max(0, seconds) * this.params.angularVelocity,
        );
    }

    snapshot(): SliderCrankSample {
        return this.sampleAt(this.angle);
    }

    sampleAt(angle: number): SliderCrankSample {
        const theta = this.wrap(angle);
        const { crankRadius: r, rodLength: l, angularVelocity: omega } = this.params;
        const sine = Math.sin(theta);
        const cosine = Math.cos(theta);
        const rootSquared = Math.max(1e-12, l * l - r * r * sine * sine);
        const root = Math.sqrt(rootSquared);
        const pistonPosition = r * cosine + root;
        const derivative = -r * sine - r * r * sine * cosine / root;
        const secondDerivative = -r * cosine - r * r * (
            (cosine * cosine - sine * sine) / root
            + r * r * sine * sine * cosine * cosine / (rootSquared * root)
        );
        const minimumPosition = l - r;
        const strokeFraction = (pistonPosition - minimumPosition) / (2 * r);
        const crankPin = {
            x: r * cosine,
            y: r * sine,
        };
        const pistonPin = {
            x: pistonPosition,
            y: 0,
        };
        return {
            angle: theta,
            crankPin,
            pistonPin,
            pistonPosition,
            pistonVelocity: derivative * omega,
            pistonAcceleration: secondDerivative * omega * omega,
            rodAngle: Math.atan2(
                pistonPin.y - crankPin.y,
                pistonPin.x - crankPin.x,
            ),
            strokeFraction: Math.max(0, Math.min(1, strokeFraction)),
        };
    }

    sampleCycle(sampleCount = 181): SliderCrankCycleSample[] {
        const count = Math.max(16, Math.round(sampleCount));
        const result: SliderCrankCycleSample[] = [];
        for (let index = 0; index < count; index += 1) {
            const angle = TAU * index / (count - 1);
            const sample = this.sampleAt(angle);
            result.push({
                angle,
                position: sample.strokeFraction,
                velocity: sample.pistonVelocity,
                acceleration: sample.pistonAcceleration,
            });
        }
        return result;
    }

    private validate(parameters: SliderCrankParameters): SliderCrankParameters {
        const { crankRadius, rodLength, angularVelocity } = parameters;
        if (
            !Number.isFinite(crankRadius)
            || !Number.isFinite(rodLength)
            || !Number.isFinite(angularVelocity)
        ) {
            throw new Error('Slider-crank parameters must be finite');
        }
        if (crankRadius <= 0) {
            throw new Error('Slider-crank radius must be positive');
        }
        if (rodLength <= crankRadius * 1.05) {
            throw new Error('Connecting rod must be longer than the crank radius');
        }
        return {
            crankRadius,
            rodLength,
            angularVelocity,
        };
    }

    private wrap(value: number): number {
        const wrapped = value % TAU;
        return wrapped < 0 ? wrapped + TAU : wrapped;
    }
}
