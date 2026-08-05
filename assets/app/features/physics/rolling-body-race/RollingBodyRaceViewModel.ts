import { FixedStepClock } from '../../../animation/FixedStepClock';
import { ParameterController } from '../../../parameters/ParameterController';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import type { StorageService } from '../../../services/StorageService';
import { RollingBodyRaceModel } from './RollingBodyRaceModel';
import type {
    RollingBodyRaceViewState,
    RollingRaceParameters,
} from './RollingBodyRaceTypes';

const FIXED_STEP_SECONDS = 1 / 120;
const MAXIMUM_SUBSTEPS = 24;
const PARAMETER_APPLY_DELAY_MS = 140;
const AUTO_RESTART_DELAY = 1.15;

const DEFAULT_PARAMETERS: RollingRaceParameters = {
    gravity: 9.81,
    slopeAngleRadians: 20 * Math.PI / 180,
    rampLength: 7,
    radius: 0.23,
};

export const ROLLING_BODY_RACE_PARAMETER_SCHEMA: ParameterSchema = [
    {
        kind: 'number',
        key: 'slopeAngle',
        label: 'Ramp angle θ',
        description: 'Incline angle measured from the horizontal.',
        defaultValue: 20,
        minimum: 6,
        maximum: 38,
        step: 1,
        decimals: 0,
        unit: '°',
    },
    {
        kind: 'number',
        key: 'gravity',
        label: 'Gravity g',
        defaultValue: 9.81,
        minimum: 2,
        maximum: 18,
        step: 0.25,
        decimals: 2,
        unit: 'm/s²',
    },
    {
        kind: 'number',
        key: 'rampLength',
        label: 'Ramp length L',
        defaultValue: 7,
        minimum: 3,
        maximum: 12,
        step: 0.5,
        decimals: 1,
        unit: 'm',
    },
    {
        kind: 'number',
        key: 'radius',
        label: 'Common radius r',
        description: 'All bodies share this radius. It changes visible spin rate, not ideal translational acceleration.',
        defaultValue: 0.23,
        minimum: 0.12,
        maximum: 0.38,
        step: 0.01,
        decimals: 2,
        unit: 'm',
    },
    {
        kind: 'number',
        key: 'speed',
        label: 'Simulation time scale',
        defaultValue: 1,
        minimum: 0.25,
        maximum: 3,
        step: 0.25,
        decimals: 2,
        unit: '×',
    },
    {
        kind: 'toggle',
        key: 'autoRestart',
        label: 'Repeat race',
        defaultValue: true,
        onLabel: 'ON',
        offLabel: 'OFF',
    },
    {
        kind: 'toggle',
        key: 'showEnergy',
        label: 'Energy split bars',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
    {
        kind: 'toggle',
        key: 'showGuides',
        label: 'Timing and rank guides',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
];

export interface RollingBodyRaceViewModelCallbacks {
    stateChanged(): void;
    reportError(error: unknown): void;
}

export class RollingBodyRaceViewModel extends ParameterController {
    private readonly clock = new FixedStepClock(
        FIXED_STEP_SECONDS,
        MAXIMUM_SUBSTEPS,
    );
    private readonly model = new RollingBodyRaceModel(DEFAULT_PARAMETERS);
    private parameterApplyTimer: ReturnType<typeof setTimeout> | null = null;
    private paused = false;

    constructor(
        storage: StorageService,
        private readonly callbacks: RollingBodyRaceViewModelCallbacks,
    ) {
        super(
            storage,
            'module:rolling-body-race:parameters-v1',
            ROLLING_BODY_RACE_PARAMETER_SCHEMA,
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
            (step) => this.model.step(step),
        );
        if (steps <= 0) {
            return false;
        }

        const snapshot = this.model.snapshot();
        const diagnostics = this.model.diagnostics();
        if (
            snapshot.allFinished
            && this.getBoolean('autoRestart')
            && snapshot.elapsedTime >= diagnostics.lastFinishTime + AUTO_RESTART_DELAY
        ) {
            this.model.reset();
            this.clock.reset();
        }
        return true;
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
        this.paused = false;
        this.resetModelFromParameters();
    }

    dispose(): void {
        this.cancelPendingParameterApply();
        this.clock.reset();
        super.dispose();
    }

    parameterChanged(key: string): boolean {
        if (
            key === 'speed'
            || key === 'autoRestart'
            || key === 'showEnergy'
            || key === 'showGuides'
        ) {
            return true;
        }
        this.scheduleParameterApply();
        return false;
    }

    createViewState(): RollingBodyRaceViewState {
        const snapshot = this.model.snapshot();
        const diagnostics = this.model.diagnostics();
        const parameters = this.model.parameters;
        return {
            snapshot,
            diagnostics,
            parameters,
            showEnergy: this.getBoolean('showEnergy'),
            showGuides: this.getBoolean('showGuides'),
            diagnosticsText: [
                `t ${snapshot.elapsedTime.toFixed(2)} s`,
                `leader ${this.currentLeader(snapshot.bodies)}`,
                `winner ${diagnostics.winnerLabel} · ${diagnostics.winnerTime.toFixed(2)} s`,
            ].join(' · '),
            modelSummary: [
                'IDEAL NO-SLIP',
                `θ ${(parameters.slopeAngleRadians * 180 / Math.PI).toFixed(0)}°`,
                `L ${parameters.rampLength.toFixed(1)} m`,
                `g ${parameters.gravity.toFixed(2)} m/s²`,
            ].join(' · '),
        };
    }

    private currentLeader(
        bodies: RollingBodyRaceViewState['snapshot']['bodies'],
    ): string {
        return [...bodies]
            .sort((left, right) => right.progress - left.progress)[0]
            .label;
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
        this.model.setParameters({
            gravity: this.getNumber('gravity'),
            slopeAngleRadians: this.getNumber('slopeAngle') * Math.PI / 180,
            rampLength: this.getNumber('rampLength'),
            radius: this.getNumber('radius'),
        });
        this.model.reset();
        this.clock.reset();
        this.paused = false;
    }
}
