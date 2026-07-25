export type LissajousAnimationMode = 'trace' | 'phase-morph' | 'combined';

export interface LissajousParameters {
    readonly frequencyX: number;
    readonly frequencyY: number;
    readonly phase: number;
    readonly speed: number;
    readonly animationMode: LissajousAnimationMode;
    readonly showEchoes: boolean;
}

export interface LissajousPoint {
    readonly x: number;
    readonly y: number;
}

export interface LissajousCurve {
    readonly echo: number;
    readonly points: readonly LissajousPoint[];
}

export interface LissajousDiagnostics {
    readonly ratioX: number;
    readonly ratioY: number;
    readonly period: number;
}

export interface LissajousRenderRequest {
    readonly sampleCount: number;
    readonly maximumEchoLayers: number;
}

export interface LissajousViewState {
    readonly presetLabel: string;
    readonly formula: string;
    readonly diagnostics: string;
    readonly curves: readonly LissajousCurve[];
    readonly marker: LissajousPoint | null;
}
