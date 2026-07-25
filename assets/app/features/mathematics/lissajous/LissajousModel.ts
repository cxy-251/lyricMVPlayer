import type {
    LissajousDiagnostics,
    LissajousParameters,
    LissajousPoint,
} from './LissajousTypes';

const FULL_TURN = Math.PI * 2;

export class LissajousModel {
    pointAt(
        parameters: Pick<LissajousParameters, 'frequencyX' | 'frequencyY' | 'phase'>,
        curveParameter: number,
    ): LissajousPoint {
        return {
            x: Math.sin(parameters.frequencyX * curveParameter + parameters.phase),
            y: Math.sin(parameters.frequencyY * curveParameter),
        };
    }

    sampleCurve(
        parameters: Pick<LissajousParameters, 'frequencyX' | 'frequencyY' | 'phase'>,
        sampleCount: number,
    ): readonly LissajousPoint[] {
        const boundedSampleCount = Math.max(8, Math.round(sampleCount));
        const points: LissajousPoint[] = [];

        for (let index = 0; index <= boundedSampleCount; index += 1) {
            points.push(this.pointAt(
                parameters,
                (FULL_TURN * index) / boundedSampleCount,
            ));
        }

        return points;
    }

    diagnostics(parameters: LissajousParameters): LissajousDiagnostics {
        const frequencyX = Math.max(1, Math.abs(Math.round(parameters.frequencyX)));
        const frequencyY = Math.max(1, Math.abs(Math.round(parameters.frequencyY)));
        const divisor = this.greatestCommonDivisor(frequencyX, frequencyY);

        return {
            ratioX: frequencyX / divisor,
            ratioY: frequencyY / divisor,
            period: FULL_TURN / divisor,
        };
    }

    currentPhase(parameters: LissajousParameters, elapsed: number): number {
        return parameters.animationMode === 'trace'
            ? parameters.phase
            : parameters.phase + elapsed;
    }

    markerParameter(parameters: LissajousParameters, elapsed: number): number | null {
        return parameters.animationMode === 'phase-morph'
            ? null
            : this.wrapAngle(elapsed);
    }

    wrapAngle(value: number): number {
        return ((value % FULL_TURN) + FULL_TURN) % FULL_TURN;
    }

    private greatestCommonDivisor(left: number, right: number): number {
        let a = left;
        let b = right;

        while (b !== 0) {
            const remainder = a % b;
            a = b;
            b = remainder;
        }

        return Math.max(1, a);
    }
}
