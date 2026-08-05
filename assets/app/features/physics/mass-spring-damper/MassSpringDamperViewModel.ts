import { FixedStepClock } from '../../../animation/FixedStepClock';
import { TrailBuffer } from '../../../graphics/TrailBuffer';
import { ParameterController } from '../../../parameters/ParameterController';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import type { StorageService } from '../../../services/StorageService';
import { MassSpringDamperModel } from './MassSpringDamperModel';
import type {
    MassSpringDamperInitialState,
    MassSpringDamperParameters,
    MassSpringDamperViewState,
} from './MassSpringDamperTypes';

const PARAMETER_APPLY_DELAY_MS = 140;
const FIXED_STEP_SECONDS = 1 / 240;
const MAXIMUM_SUBSTEPS = 32;
const TRACE_CAPACITY = 480;

const DEFAULT_MODEL_PARAMETERS: MassSpringDamperParameters = {
    mass: 1,
    stiffness: 18,
    damping: 1.2,
    forcingAmplitude: 0,
    forcingFrequency: 4.2,
};

export const MASS_SPRING_DAMPER_PARAMETER_SCHEMA: ParameterSchema = [
    {
        kind: 'number',
        key: 'mass',
        label: 'Mass',
        defaultValue: 1,
        minimum: 0.2,
        maximum: 5,
        step: 0.2,
        decimals: 1,
        unit: ' kg',
    },
    {
        kind: 'number',
        key: 'stiffness',
        label: 'Spring stiffness',
        defaultValue: 18,
        minimum: 2,
        maximum: 60,
        step: 1,
        decimals: 0,
        unit: ' N/m',
    },
    {
        kind: 'number',
        key: 'damping',
        label: 'Viscous damping',
        defaultValue: 1.2,
        minimum: 0,
        maximum: 20,
        step: 0.2,
        decimals: 1,
        unit: ' N·s/m',
    },
    {
        kind: 'number',
        key: 'initialDisplacement',
        label: 'Initial displacement',
        defaultValue: 0.35,
        minimum: -1,
        maximum: 1,
        step: 0.05,
        decimals: 2,
        unit: ' m',
    },
    {
        kind: 'number',
        key: 'initialVelocity',
        label: 'Initial velocity',
        defaultValue: 0,
        minimum: -4,
        maximum: 4,
        step: 0.1,
        decimals: 1,
        unit: ' m/s',
    },
    {
        kind: 'number',
        key: 'forcingAmplitude',
        label: 'Driving amplitude',
        defaultValue: 0,
        minimum: 0,
        maximum: 20,
        step: 0.5,
        decimals: 1,
        unit: ' N',
    },
    {
        kind: 'number',
        key: 'forcingFrequency',
        label: 'Driving frequency',
        defaultValue: 4.2,
        minimum: 0,
        maximum: 12,
        step: 0.2,
        decimals: 1,
        unit: ' rad/s',
    },
    {
        kind: 'number',
        key: 'speed',
        label: 'Time scale',
        defaultValue: 1,
        minimum: 0.25,
        maximum: 2,
        step: 0.25,
        decimals: 2,
        unit: '×',
    },
    {
        kind: 'toggle',
        key: 'showTrace',
        label: 'Displacement trace',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
];

export interface MassSpringDamperViewModelCallbacks {
    stateChanged(): void;
    reportError(error: unknown): void;
}

export class MassSpringDamperViewModel extends ParameterController {
    private readonly clock = new FixedStepClock(FIXED_STEP_SECONDS, MAXIMUM_SUBSTEPS);
    private readonly trace = new TrailBuffer(TRACE_CAPACITY);
    private readonly model = new MassSpringDamperModel(DEFAULT_MODEL_PARAMETERS);
    private parameterApplyTimer: ReturnType<typeof setTimeout> | null = null;
    private paused = false;

    constructor(
        storage: StorageService,
        private readonly callbacks: MassSpringDamperViewModelCallbacks,
    ) {
        super(
            storage,
            'module:mass-spring-damper:parameters-v1',
            MASS_SPRING_DAMPER_PARAMETER_SCHEMA,
        );
        this.resetModelFromParameters();
    }

    update(dt: number): boolean {
        if (this.paused) {
            return false;
        }

        const steps = this.clock.advance(
            dt,
            this.getNumber('speed'),
            (step) => {
                this.model.step(step);
                this.pushTracePoint();
            },
        );
        return steps > 0;
    }

    pause(): void {
        this.paused = true;
    }

    resume(): void {
        this.paused = false;
    }

    reset(): void {
        this.cancelPendingParameterApply();
        super.reset();
        this.resetModelFromParameters();
    }

    dispose(): void {
        this.cancelPendingParameterApply();
        this.trace.clear();
        this.clock.reset();
        super.dispose();
    }

    parameterChanged(key: string): boolean {
        if (key === 'speed' || key === 'showTrace') {
            return true;
        }

        this.scheduleParameterApply();
        return false;
    }

    createViewState(): MassSpringDamperViewState {
        const snapshot = this.model.snapshot();
        const diagnostics = this.model.diagnostics();
        const displayRange = Math.max(
            0.25,
            Math.abs(this.getNumber('initialDisplacement')) * 1.4,
            this.getNumber('forcingAmplitude')
                / Math.max(1e-6, this.getNumber('stiffness'))
                * 2.5,
        );

        return {
            snapshot,
            trail: this.trace.values,
            displayRange,
            showTrace: this.getBoolean('showTrace'),
            diagnostics: [
                `t ${snapshot.elapsedTime.toFixed(2)} s`,
                `x ${snapshot.displacement.toFixed(3)} m`,
                `v ${snapshot.velocity.toFixed(3)} m/s`,
                `a ${snapshot.acceleration.toFixed(3)} m/s²`,
                `E ${diagnostics.mechanicalEnergy.toFixed(4)} J`,
                `balance ${diagnostics.energyBalanceError.toExponential(2)} J`,
            ].join(' · '),
            modelSummary: [
                diagnostics.regime.toUpperCase(),
                `ζ ${diagnostics.dampingRatio.toFixed(3)}`,
                `ωn ${diagnostics.naturalFrequency.toFixed(3)} rad/s`,
                diagnostics.dampedFrequency > 0
                    ? `ωd ${diagnostics.dampedFrequency.toFixed(3)} rad/s`
                    : 'ωd —',
            ].join(' · '),
        };
    }

    private scheduleParameterApply(): void {
        this.cancelPendingParameterApply();
        this.parameterApplyTimer = setTimeout(() => {
            this.parameterApplyTimer = null;
            try {
                this.resetModelFromParameters();
                this.callbacks.stateChanged();
            } catch (error) {
                this.callbacks.reportError(error);
            }
        }, PARAMETER_APPLY_DELAY_MS);
    }

    private cancelPendingParameterApply(): void {
        if (this.parameterApplyTimer === null) {
            return;
        }
        clearTimeout(this.parameterApplyTimer);
        this.parameterApplyTimer = null;
    }

    private resetModelFromParameters(): void {
        this.model.setParameters(this.readModelParameters());
        this.model.reset(this.readInitialState());
        this.clock.reset();
        this.trace.clear();
        this.pushTracePoint();
    }

    private readModelParameters(): MassSpringDamperParameters {
        return {
            mass: this.getNumber('mass'),
            stiffness: this.getNumber('stiffness'),
            damping: this.getNumber('damping'),
            forcingAmplitude: this.getNumber('forcingAmplitude'),
            forcingFrequency: this.getNumber('forcingFrequency'),
        };
    }

    private readInitialState(): MassSpringDamperInitialState {
        return {
            displacement: this.getNumber('initialDisplacement'),
            velocity: this.getNumber('initialVelocity'),
        };
    }

    private pushTracePoint(): void {
        const snapshot = this.model.snapshot();
        this.trace.push({
            x: snapshot.elapsedTime,
            y: snapshot.displacement,
        });
    }
}
