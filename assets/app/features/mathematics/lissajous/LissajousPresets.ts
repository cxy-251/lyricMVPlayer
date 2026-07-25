export interface LissajousPreset {
    readonly id: string;
    readonly label: string;
    readonly frequencyX: number;
    readonly frequencyY: number;
    readonly phase: number;
}

export const LISSAJOUS_PRESETS: readonly LissajousPreset[] = [
    {
        id: 'classic-3-2',
        label: 'Classic 3:2',
        frequencyX: 3,
        frequencyY: 2,
        phase: 0.65,
    },
    {
        id: 'circle-1-1',
        label: 'Circle 1:1',
        frequencyX: 1,
        frequencyY: 1,
        phase: Math.PI / 2,
    },
    {
        id: 'figure-eight-1-2',
        label: 'Figure Eight 1:2',
        frequencyX: 1,
        frequencyY: 2,
        phase: Math.PI / 2,
    },
    {
        id: 'dense-3-4',
        label: 'Dense 3:4',
        frequencyX: 3,
        frequencyY: 4,
        phase: Math.PI / 2,
    },
    {
        id: 'star-3-5',
        label: 'Star 3:5',
        frequencyX: 3,
        frequencyY: 5,
        phase: Math.PI / 2,
    },
    {
        id: 'complex-5-6',
        label: 'Complex 5:6',
        frequencyX: 5,
        frequencyY: 6,
        phase: 0.35,
    },
];

export function matchLissajousPreset(
    frequencyX: number,
    frequencyY: number,
    phase: number,
): LissajousPreset | null {
    return LISSAJOUS_PRESETS.find((preset) => (
        preset.frequencyX === Math.round(frequencyX)
        && preset.frequencyY === Math.round(frequencyY)
        && Math.abs(preset.phase - phase) <= 0.026
    )) ?? null;
}

export function cycleLissajousPreset(
    currentId: string | null,
    direction: -1 | 1,
): LissajousPreset {
    const currentIndex = LISSAJOUS_PRESETS.findIndex((preset) => preset.id === currentId);
    const startIndex = currentIndex >= 0
        ? currentIndex
        : direction > 0 ? -1 : 0;
    const nextIndex = (
        startIndex + direction + LISSAJOUS_PRESETS.length
    ) % LISSAJOUS_PRESETS.length;
    return LISSAJOUS_PRESETS[nextIndex];
}
