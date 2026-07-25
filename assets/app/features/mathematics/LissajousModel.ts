export type LissajousAnimationMode = 'trace' | 'phase-morph' | 'combined';

export interface LissajousPoint {
    readonly x: number;
    readonly y: number;
}

export interface LissajousDiagnostics {
    readonly divisor: number;
    readonly ratioX: number;
    readonly ratioY: number;
    readonly period: number;
    readonly closed: boolean;
}

const FULL_TURN = Math.PI * 2;

export function lissajousPoint(
    frequencyX: number,
    frequencyY: number,
    phase: number,
    parameter: number,
    scaleX = 1,
    scaleY = 1,
): LissajousPoint {
    return {
        x: Math.sin(frequencyX * parameter + phase) * scaleX,
        y: Math.sin(frequencyY * parameter) * scaleY,
    };
}

export function lissajousCurrentPhase(
    basePhase: number,
    elapsed: number,
    mode: LissajousAnimationMode,
): number {
    return mode === 'trace'
        ? basePhase
        : basePhase + elapsed;
}

export function lissajousMarkerParameter(
    elapsed: number,
    mode: LissajousAnimationMode,
): number | null {
    return mode === 'phase-morph'
        ? null
        : wrapPositiveAngle(elapsed);
}

export function lissajousDiagnostics(
    frequencyX: number,
    frequencyY: number,
): LissajousDiagnostics {
    const normalizedX = Math.max(1, Math.abs(Math.round(frequencyX)));
    const normalizedY = Math.max(1, Math.abs(Math.round(frequencyY)));
    const divisor = greatestCommonDivisor(normalizedX, normalizedY);

    return {
        divisor,
        ratioX: normalizedX / divisor,
        ratioY: normalizedY / divisor,
        period: FULL_TURN / divisor,
        closed: Number.isInteger(frequencyX) && Number.isInteger(frequencyY),
    };
}

export function wrapPositiveAngle(value: number): number {
    return ((value % FULL_TURN) + FULL_TURN) % FULL_TURN;
}

function greatestCommonDivisor(left: number, right: number): number {
    let a = left;
    let b = right;

    while (b !== 0) {
        const remainder = a % b;
        a = b;
        b = remainder;
    }

    return Math.max(1, a);
}
