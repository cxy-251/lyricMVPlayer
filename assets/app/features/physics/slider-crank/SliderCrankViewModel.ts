import { ParameterController } from '../../../parameters/ParameterController';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import type { StorageService } from '../../../services/StorageService';
import { MechanicalLinkagesModel } from './MechanicalLinkagesModel';
import type {
    MechanicalLinkageConfiguration,
    MechanicalLinkageCycleSample,
    MechanicalLinkageKind,
    SliderCrankDirection,
    SliderCrankViewState,
} from './SliderCrankTypes';

const RPM_TO_RADIANS_PER_SECOND = Math.PI * 2 / 60;

export const SLIDER_CRANK_PARAMETER_SCHEMA: ParameterSchema = [
    {
        kind: 'select',
        key: 'mechanism',
        label: 'Mechanism',
        defaultValue: 'slider-crank',
        options: [
            { value: 'slider-crank', label: 'SLIDER–CRANK' },
            { value: 'four-bar', label: 'FOUR-BAR LINKAGE' },
            { value: 'geneva', label: 'GENEVA DRIVE' },
        ],
    },
    {
        kind: 'select',
        key: 'configuration',
        label: 'Geometry configuration',
        defaultValue: 'standard',
        options: [
            { value: 'compact', label: 'COMPACT' },
            { value: 'standard', label: 'STANDARD' },
            { value: 'wide', label: 'WIDE' },
        ],
    },
    {
        kind: 'number',
        key: 'rpm',
        label: 'Input shaft speed',
        defaultValue: 90,
        minimum: 10,
        maximum: 240,
        step: 10,
        decimals: 0,
        unit: ' rpm',
    },
    {
        kind: 'number',
        key: 'scale',
        label: 'Mechanism size',
        defaultValue: 1,
        minimum: 0.7,
        maximum: 1.4,
        step: 0.1,
        decimals: 1,
        unit: '×',
    },
    {
        kind: 'select',
        key: 'direction',
        label: 'Input rotation',
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
        key: 'showKinematics',
        label: 'Output velocity / acceleration',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
    {
        kind: 'toggle',
        key: 'showTrace',
        label: 'Point trajectory',
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
    private readonly model = new MechanicalLinkagesModel({
        mechanism: 'slider-crank',
        configuration: 'standard',
        scale: 1,
        angularVelocity: 90 * RPM_TO_RADIANS_PER_SECOND,
    });
    private cycleSamples: MechanicalLinkageCycleSample[] = [];
    private paused = false;

    constructor(
        storage: StorageService,
        private readonly callbacks: SliderCrankViewModelCallbacks,
    ) {
        super(
            storage,
            'module:mechanical-linkages:parameters-v1',
            SLIDER_CRANK_PARAMETER_SCHEMA,
        );
        this.applyParameters(true);
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
            key === 'mechanism'
            || key === 'configuration'
            || key === 'rpm'
            || key === 'scale'
            || key === 'direction'
        ) {
            try {
                this.applyParameters(
                    key === 'mechanism' || key === 'configuration',
                );
            } catch (error) {
                this.callbacks.reportError(error);
            }
        }
        return true;
    }

    createViewState(): SliderCrankViewState {
        const sample = this.model.snapshot();
        const mechanism = this.getString('mechanism') as MechanicalLinkageKind;
        const configuration = this.getString(
            'configuration',
        ) as MechanicalLinkageConfiguration;
        const direction = this.getString('direction') as SliderCrankDirection;
        let outputMinimum = Number.POSITIVE_INFINITY;
        let outputMaximum = Number.NEGATIVE_INFINITY;
        let maximumVelocity = 1e-9;
        let maximumAcceleration = 1e-9;
        for (const point of this.cycleSamples) {
            outputMinimum = Math.min(outputMinimum, point.output);
            outputMaximum = Math.max(outputMaximum, point.output);
            maximumVelocity = Math.max(maximumVelocity, Math.abs(point.velocity));
            maximumAcceleration = Math.max(
                maximumAcceleration,
                Math.abs(point.acceleration),
            );
        }
        if (!Number.isFinite(outputMinimum) || !Number.isFinite(outputMaximum)) {
            outputMinimum = -1;
            outputMaximum = 1;
        }
        return {
            mechanism,
            configuration,
            sample,
            cycleSamples: this.cycleSamples,
            rpm: this.getNumber('rpm'),
            direction,
            outputMinimum,
            outputMaximum,
            maximumVelocity,
            maximumAcceleration,
            showKinematics: this.getBoolean('showKinematics'),
            showTrace: this.getBoolean('showTrace'),
            showPlot: this.getBoolean('showPlot'),
            diagnosticsText: this.diagnosticsText(sample),
            modelSummary: this.modelSummary(sample),
        };
    }

    dispose(): void {
        this.cycleSamples.length = 0;
        super.dispose();
    }

    private applyParameters(resetPhase: boolean): void {
        const direction = this.getString('direction') as SliderCrankDirection;
        const sign = direction === 'clockwise' ? -1 : 1;
        this.model.setParameters({
            mechanism: this.getString('mechanism') as MechanicalLinkageKind,
            configuration: this.getString(
                'configuration',
            ) as MechanicalLinkageConfiguration,
            scale: this.getNumber('scale'),
            angularVelocity: sign
                * this.getNumber('rpm')
                * RPM_TO_RADIANS_PER_SECOND,
        });
        if (resetPhase) this.model.reset(0);
        this.cycleSamples = this.model.sampleCycle(181);
    }

    private diagnosticsText(
        sample: SliderCrankViewState['sample'],
    ): string {
        const angle = sample.inputAngle * 180 / Math.PI;
        if (sample.mechanism === 'four-bar') {
            return [
                `θin ${angle.toFixed(1)}°`,
                `θout ${(sample.output * 180 / Math.PI).toFixed(1)}°`,
                `ωout ${sample.outputVelocity.toFixed(2)} rad/s`,
                `μ ${(sample.transmissionAngle * 180 / Math.PI).toFixed(1)}°`,
            ].join(' · ');
        }
        if (sample.mechanism === 'geneva') {
            return [
                `θin ${angle.toFixed(1)}°`,
                `index ${(sample.output * 180 / Math.PI).toFixed(1)}°`,
                `ωout ${sample.outputVelocity.toFixed(2)} rad/s`,
                sample.engaged ? 'PIN ENGAGED' : 'DWELL',
            ].join(' · ');
        }
        return [
            `θ ${angle.toFixed(1)}°`,
            `x ${sample.output.toFixed(3)} m`,
            `v ${sample.outputVelocity.toFixed(3)} m/s`,
            `a ${sample.outputAcceleration.toFixed(2)} m/s²`,
        ].join(' · ');
    }

    private modelSummary(sample: SliderCrankViewState['sample']): string {
        const rpm = this.getNumber('rpm');
        if (sample.mechanism === 'four-bar') {
            return [
                'FOUR-BAR CRANK–ROCKER',
                `a ${sample.inputLength.toFixed(2)}`,
                `b ${sample.couplerLength.toFixed(2)}`,
                `c ${sample.outputLength.toFixed(2)}`,
                `${rpm.toFixed(0)} rpm`,
            ].join(' · ');
        }
        if (sample.mechanism === 'geneva') {
            return [
                'EXTERNAL GENEVA DRIVE',
                `${sample.slotCount} SLOTS`,
                sample.engaged ? 'INDEXING' : 'LOCKED DWELL',
                `${rpm.toFixed(0)} rpm`,
            ].join(' · ');
        }
        return [
            'SLIDER–CRANK',
            `stroke ${(2 * sample.crankRadius).toFixed(2)} m`,
            `l/r ${(sample.rodLength / sample.crankRadius).toFixed(2)}`,
            `${rpm.toFixed(0)} rpm`,
        ].join(' · ');
    }
}
