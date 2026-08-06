import { FixedStepClock } from '../../../animation/FixedStepClock';
import { TrailBuffer } from '../../../graphics/TrailBuffer';
import { ParameterController } from '../../../parameters/ParameterController';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import type { StorageService } from '../../../services/StorageService';
import { DoublePendulumModel } from './DoublePendulumModel';
import type {
    DoublePendulumParameters,
    DoublePendulumState,
    DoublePendulumViewState,
} from './DoublePendulumTypes';

const PARAMETER_APPLY_DELAY_MS = 140;
const FIXED_STEP_SECONDS = 1 / 240;
const MAXIMUM_SUBSTEPS = 24;
const TRAIL_CAPACITY = 480;
const TRAIL_SAMPLE_INTERVAL = 4;

const DEFAULT_MODEL_PARAMETERS: DoublePendulumParameters = {
    gravity: 9.81,
    mass1: 1,
    mass2: 1,
    length1: 1,
    length2: 1,
};

export const DOUBLE_PENDULUM_PARAMETER_SCHEMA: ParameterSchema = [
    {
        kind: 'number',
        key: 'gravity',
        label: 'Gravity',
        defaultValue: 9.81,
        minimum: 1,
        maximum: 20,
        step: 0.1,
        decimals: 2,
        unit: ' m/s²',
    },
    {
        kind: 'number',
        key: 'mass1',
        label: 'Upper mass',
        defaultValue: 1,
        minimum: 0.2,
        maximum: 3,
        step: 0.2,
        decimals: 1,
        unit: ' kg',
    },
    {
        kind: 'number',
        key: 'mass2',
        label: 'Lower mass',
        defaultValue: 1,
        minimum: 0.2,
        maximum: 3,
        step: 0.2,
        decimals: 1,
        unit: ' kg',
    },
    {
        kind: 'number',
        key: 'length1',
        label: 'Upper length',
        defaultValue: 1,
        minimum: 0.5,
        maximum: 1.5,
        step: 0.1,
        decimals: 1,
        unit: ' m',
    },
    {
        kind: 'number',
        key: 'length2',
        label: 'Lower length',
        defaultValue: 1,
        minimum: 0.5,
        maximum: 1.5,
        step: 0.1,
        decimals: 1,
        unit: ' m',
    },
    {
        kind: 'number',
        key: 'initialAngle1',
        label: 'Upper angle',
        defaultValue: 100,
        minimum: -170,
        maximum: 170,
        step: 1,
        decimals: 0,
        unit: '°',
    },
    {
        kind: 'number',
        key: 'initialAngle2',
        label: 'Lower angle',
        defaultValue: 65,
        minimum: -170,
        maximum: 170,
        step: 1,
        decimals: 0,
        unit: '°',
    },
    {
        kind: 'number',
        key: 'initialOmega1',
        label: 'Upper angular speed',
        defaultValue: 0,
        minimum: -6,
        maximum: 6,
        step: 0.1,
        decimals: 1,
        unit: ' rad/s',
    },
    {
        kind: 'number',
        key: 'initialOmega2',
        label: 'Lower angular speed',
        defaultValue: 0,
        minimum: -6,
        maximum: 6,
        step: 0.1,
        decimals: 1,
        unit: ' rad/s',
    },
    {
        kind: 'number',
        key: 'speed',
        label: 'Time scale',
        defaultValue: 0.75,
        minimum: 0.25,
        maximum: 1.5,
        step: 0.25,
        decimals: 2,
        unit: '×',
    },
    {
        kind: 'toggle',
        key: 'showTrail',
        label: 'Trajectory',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
];

export interface DoublePendulumViewModelCallbacks {
    stateChanged(): void;
    reportError(error: unknown): void;
}

export class DoublePendulumViewModel extends ParameterController {
    private readonly clock = new FixedStepClock(FIXED_STEP_SECONDS, MAXIMUM_SUBSTEPS);
    private readonly trail = new TrailBuffer(TRAIL_CAPACITY);
    private readonly model = new DoublePendulumModel(DEFAULT_MODEL_PARAMETERS);
    private parameterApplyTimer: ReturnType<typeof setTimeout> | null = null;
    private paused = false;
    private trailSampleCounter = 0;

    constructor(
        storage: StorageService,
        private readonly callbacks: DoublePendulumViewModelCallbacks,
    ) {
        super(
            storage,
            'module:double-pendulum:parameters-v3',
            DOUBLE_PENDULUM_PARAMETER_SCHEMA,
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
                this.trailSampleCounter += 1;
                if (this.trailSampleCounter >= TRAIL_SAMPLE_INTERVAL) {
                    this.trailSampleCounter = 0;
                    this.pushTrailPoint();
                }
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
        this.trail.clear();
        this.clock.reset();
        super.dispose();
    }

    parameterChanged(key: string): boolean {
        if (key === 'speed' || key === 'showTrail') {
            return true;
        }

        this.scheduleParameterApply();
        return false;
    }

    createViewState(): DoublePendulumViewState {
        const parameters = this.model.parameters;
        const diagnostics = this.model.diagnostics();

        return {
            positions: this.model.positions(),
            trail: this.trail.values,
            mass1: parameters.mass1,
            mass2: parameters.mass2,
            length1: parameters.length1,
            length2: parameters.length2,
            showTrail: this.getBoolean('showTrail'),
            diagnostics: [
                `t ${diagnostics.elapsedTime.toFixed(2)} s`,
                `E ${diagnostics.totalEnergy.toFixed(5)} J`,
                `ΔE ${diagnostics.absoluteEnergyDrift.toExponential(2)} J`,
                `rel ${(diagnostics.normalizedEnergyDrift * 1_000_000).toFixed(1)} ppm`,
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
        this.trail.clear();
        this.trailSampleCounter = 0;
        this.pushTrailPoint();
    }

    private readModelParameters(): DoublePendulumParameters {
        return {
            gravity: this.getNumber('gravity'),
            mass1: this.getNumber('mass1'),
            mass2: this.getNumber('mass2'),
            length1: this.getNumber('length1'),
            length2: this.getNumber('length2'),
        };
    }

    private readInitialState(): DoublePendulumState {
        return {
            theta1: this.getNumber('initialAngle1') * Math.PI / 180,
            theta2: this.getNumber('initialAngle2') * Math.PI / 180,
            omega1: this.getNumber('initialOmega1'),
            omega2: this.getNumber('initialOmega2'),
        };
    }

    private pushTrailPoint(): void {
        this.trail.push(this.model.positions().second);
    }
}
