export interface LissajousPreset {
    readonly id: string;
    readonly label: string;
    readonly frequencyX: number;
    readonly frequencyY: number;
    readonly phase: number;
}

export const CUSTOM_LISSAJOUS_PRESET_ID = 'custom';

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

export function findLissajousPreset(id: string): LissajousPreset | null {
    return LISSAJOUS_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function matchLissajousPreset(
    frequencyX: number,
    frequencyY: number,
    phase: number,
): string {
    const match = LISSAJOUS_PRESETS.find((preset) => (
        preset.frequencyX === Math.round(frequencyX)
        && preset.frequencyY === Math.round(frequencyY)
        && Math.abs(preset.phase - phase) <= 0.026
    ));

    return match?.id ?? CUSTOM_LISSAJOUS_PRESET_ID;
}
