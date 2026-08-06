import { ParameterController } from '../../../parameters/ParameterController';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import type { StorageService } from '../../../services/StorageService';
import { SliderCrankModel } from './SliderCrankModel';
import type {
    SliderCrankCycleSample,
    SliderCrankDirection,
    SliderCrankViewState,
} from './SliderCrankTypes';

const RPM_TO_RADIANS_PER_SECOND = Math.PI * 2 / 60;

export const SLIDER_CRANK_PARAMETER_SCHEMA: ParameterSchema = [
    {
        kind: 'number',
        key: 'rpm',
        label: 'Input crank speed',
        defaultValue: 120,
        minimum: 20,
        maximum: 360,
        step: 10,
        decimals: 0,
        unit: ' rpm',
    },
    {
        kind: 'number',
        key: 'crankRadius',
        label: 'Crank radius r',
        defaultValue: 0.8,
        minimum: 0.4,
        maximum: 1.4,
        step: 0.1,
        decimals: 1,
        unit: ' m',
    },
    {
        kind: 'number',
        key: 'rodRatio',
        label: 'Connecting-rod ratio l/r',
        defaultValue: 3.5,
        minimum: 2.2,
        maximum: 5,
        step: 0.1,
        decimals: 1,
    },
    {
        kind: 'select',
        key: 'direction',
        label: 'Crank rotation',
        defaultValue: 'counterclockwise',
        options: [
            { value: 'counterclockwise', label: 'COUNTERCLOCKWISE' },
            { value: 'clockwise', label: 'CLOCKWISE' },
        ],
    },
    {
        kind: 'number',
        key: 'speed',
        label: 'Animation time scale',
        defaultValue: 1,
        minimum: 0.25,
        maximum: 2,
        step: 0.25,
        decimals: 2,
        unit: '×',
    },
    {
        kind: 'toggle',
        key: 'showVelocity',
        label: 'Piston velocity vector',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
    {
        kind: 'toggle',
        key: 'showAcceleration',
        label: 'Piston acceleration vector',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
    {
        kind: 'toggle',
        key: 'showPlot',
        label: 'Kinematic curves',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
];

export interface SliderCrankViewModelCallbacks {
    reportError(error: unknown): void;
}

export class SliderCrankViewModel extends ParameterController {
    private readonly model = new SliderCrankModel({
        crankRadius: 0.8,
        rodLength: 2.8,
        angularVelocity: 120 * RPM_TO_RADIANS_PER_SECOND,
    });
    private cycleSamples: SliderCrankCycleSample[] = [];
    private paused = false;

    constructor(
        storage: StorageService,
        private readonly callbacks: SliderCrankViewModelCallbacks,
    ) {
        super(
            storage,
            'module:slider-crank:parameters-v1',
            SLIDER_CRANK_PARAMETER_SCHEMA,
        );
        this.applyParameters(false);
    }

    update(dt: number): boolean {
        if (this.paused) return false;
        this.model.advance(
            Math.max(0, Math.min(0.05, dt)) * this.getNumber('speed'),
        );
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
        this.paused = false;
        this.applyParameters(true);
    }

    parameterChanged(key: string): boolean {
        if (
            key === 'rpm'
            || key === 'crankRadius'
            || key === 'rodRatio'
            || key === 'direction'
        ) {
            try {
                this.applyParameters(false);
            } catch (error) {
                this.callbacks.reportError(error);
            }
        }
        return true;
    }

    createViewState(): SliderCrankViewState {
        const sample = this.model.snapshot();
        const rpm = this.getNumber('rpm');
        const direction = this.getString('direction') as SliderCrankDirection;
        let maximumVelocity = 1e-9;
        let maximumAcceleration = 1e-9;
        for (const point of this.cycleSamples) {
            maximumVelocity = Math.max(maximumVelocity, Math.abs(point.velocity));
            maximumAcceleration = Math.max(
                maximumAcceleration,
                Math.abs(point.acceleration),
            );
        }
        return {
            sample,
            cycle: this.cycleSamples,
            crankRadius: this.model.parameters.crankRadius,
            rodLength: this.model.parameters.rodLength,
            rpm,
            direction,
            maximumVelocity,
            maximumAcceleration,
            showVelocity: this.getBoolean('showVelocity'),
            showAcceleration: this.getBoolean('showAcceleration'),
            showPlot: this.getBoolean('showPlot'),
            diagnosticsText: [
                `θ ${(sample.angle * 180 / Math.PI).toFixed(1)}°`,
                `x ${sample.pistonPosition.toFixed(3)} m`,
                `v ${sample.pistonVelocity.toFixed(3)} m/s`,
                `a ${sample.pistonAcceleration.toFixed(2)} m/s²`,
            ].join(' · '),
            modelSummary: [
                'SLIDER–CRANK',
                `stroke ${(2 * this.model.parameters.crankRadius).toFixed(2)} m`,
                `l/r ${(this.model.parameters.rodLength / this.model.parameters.crankRadius).toFixed(2)}`,
                `${rpm.toFixed(0)} rpm`,
            ].join(' · '),
        };
    }

    dispose(): void {
        this.cycleSamples.length = 0;
        super.dispose();
    }

    private applyParameters(resetPhase: boolean): void {
        const crankRadius = this.getNumber('crankRadius');
        const rodLength = crankRadius * this.getNumber('rodRatio');
        const direction = this.getString('direction') as SliderCrankDirection;
        const sign = direction === 'clockwise' ? -1 : 1;
        this.model.setParameters({
            crankRadius,
            rodLength,
            angularVelocity: sign
                * this.getNumber('rpm')
                * RPM_TO_RADIANS_PER_SECOND,
        });
        if (resetPhase) this.model.reset(0);
        this.cycleSamples = this.model.sampleCycle(181);
    }
}
