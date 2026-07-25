import type { StorageService } from '../../../services/StorageService';
import { ParameterController } from '../../../parameters/ParameterController';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import { LissajousModel } from './LissajousModel';
import {
    cycleLissajousPreset,
    matchLissajousPreset,
} from './LissajousPresets';
import type {
    LissajousAnimationMode,
    LissajousCurve,
    LissajousParameters,
    LissajousRenderRequest,
    LissajousViewState,
} from './LissajousTypes';

const CURVE_FRAME_INTERVAL = 1 / 30;
const ECHO_PHASE_STEP = 0.08;

export const LISSAJOUS_PARAMETER_SCHEMA: ParameterSchema = [
    {
        kind: 'select',
        key: 'animationMode',
        label: 'Animation mode',
        defaultValue: 'trace',
        options: [
            { value: 'trace', label: 'Trace' },
            { value: 'phase-morph', label: 'Phase Morph' },
            { value: 'combined', label: 'Combined' },
        ],
    },
    {
        kind: 'number',
        key: 'frequencyX',
        label: 'X frequency',
        defaultValue: 3,
        minimum: 1,
        maximum: 12,
        step: 1,
        decimals: 0,
    },
    {
        kind: 'number',
        key: 'frequencyY',
        label: 'Y frequency',
        defaultValue: 2,
        minimum: 1,
        maximum: 12,
        step: 1,
        decimals: 0,
    },
    {
        kind: 'number',
        key: 'phase',
        label: 'Phase offset',
        defaultValue: 0.65,
        minimum: 0,
        maximum: Math.PI * 2,
        step: 0.05,
        decimals: 2,
        unit: ' rad',
    },
    {
        kind: 'number',
        key: 'speed',
        label: 'Animation speed',
        defaultValue: 0.55,
        minimum: 0.1,
        maximum: 2,
        step: 0.1,
        decimals: 1,
        unit: '×',
    },
    {
        kind: 'toggle',
        key: 'showEchoes',
        label: 'Phase echoes',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
];

export class LissajousViewModel extends ParameterController {
    private readonly model = new LissajousModel();
    private elapsed = 0;
    private redrawAccumulator = 0;
    private paused = false;

    constructor(storage: StorageService) {
        super(
            storage,
            'module:lissajous:parameters-v1',
            LISSAJOUS_PARAMETER_SCHEMA,
        );
    }

    update(dt: number): boolean {
        if (this.paused) {
            return false;
        }

        const frameTime = Math.max(0, dt);
        this.elapsed += frameTime * this.getNumber('speed');
        this.redrawAccumulator += frameTime;

        if (this.redrawAccumulator < CURVE_FRAME_INTERVAL) {
            return false;
        }

        this.redrawAccumulator %= CURVE_FRAME_INTERVAL;
        return true;
    }

    pause(): void {
        this.paused = true;
    }

    resume(): void {
        this.paused = false;
    }

    reset(): void {
        super.reset();
        this.elapsed = 0;
        this.redrawAccumulator = 0;
    }

    cyclePreset(direction: -1 | 1): void {
        const currentParameters = this.readParameters();
        const currentPreset = matchLissajousPreset(
            currentParameters.frequencyX,
            currentParameters.frequencyY,
            currentParameters.phase,
        );
        const nextPreset = cycleLissajousPreset(currentPreset?.id ?? null, direction);

        this.set('frequencyX', nextPreset.frequencyX);
        this.set('frequencyY', nextPreset.frequencyY);
        this.set('phase', nextPreset.phase);
        this.elapsed = 0;
        this.redrawAccumulator = 0;
    }

    createViewState(request: LissajousRenderRequest): LissajousViewState {
        const parameters = this.readParameters();
        const currentPhase = this.model.currentPhase(parameters, this.elapsed);
        const echoLayerCount = parameters.showEchoes
            ? Math.max(1, request.maximumEchoLayers)
            : 1;
        const curves: LissajousCurve[] = [];

        for (let echo = echoLayerCount - 1; echo >= 0; echo -= 1) {
            curves.push({
                echo,
                points: this.model.sampleCurve(
                    {
                        ...parameters,
                        phase: currentPhase - echo * ECHO_PHASE_STEP,
                    },
                    request.sampleCount,
                ),
            });
        }

        const markerParameter = this.model.markerParameter(parameters, this.elapsed);
        const marker = markerParameter === null
            ? null
            : this.model.pointAt(
                { ...parameters, phase: currentPhase },
                markerParameter,
            );
        const preset = matchLissajousPreset(
            parameters.frequencyX,
            parameters.frequencyY,
            parameters.phase,
        );
        const diagnostics = this.model.diagnostics(parameters);

        return {
            presetLabel: preset?.label ?? 'Custom',
            formula: `x=sin(${parameters.frequencyX}t+${this.model.wrapAngle(currentPhase).toFixed(2)})`
                + ` · y=sin(${parameters.frequencyY}t)`,
            diagnostics: `ratio ${diagnostics.ratioX}:${diagnostics.ratioY}`
                + ` · T=${diagnostics.period.toFixed(3)} rad`
                + ` · ${this.formatMode(parameters.animationMode)}`,
            curves,
            marker,
        };
    }

    private readParameters(): LissajousParameters {
        return {
            frequencyX: Math.round(this.getNumber('frequencyX')),
            frequencyY: Math.round(this.getNumber('frequencyY')),
            phase: this.getNumber('phase'),
            speed: this.getNumber('speed'),
            animationMode: this.readAnimationMode(),
            showEchoes: this.getBoolean('showEchoes'),
        };
    }

    private readAnimationMode(): LissajousAnimationMode {
        const mode = this.getString('animationMode');
        return mode === 'phase-morph' || mode === 'combined'
            ? mode
            : 'trace';
    }

    private formatMode(mode: LissajousAnimationMode): string {
        if (mode === 'phase-morph') {
            return 'phase morph';
        }

        if (mode === 'combined') {
            return 'combined';
        }

        return 'trace';
    }
}
