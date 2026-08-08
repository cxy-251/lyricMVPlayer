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
const COMPANION_ANGLE_OFFSET_RADIANS = 0.32 * Math.PI / 180;

const DEFAULT_MODEL_PARAMETERS: DoublePendulumParameters = {
    gravity: 9.81,
    mass1: 1,
    mass2: 1,
    length1: 1,
    length2: 1,
};

export interface DoublePendulumPreset {
    readonly label: string;
    readonly detail: string;
    readonly parameters: DoublePendulumParameters;
    readonly state: DoublePendulumState;
    readonly speed: number;
    readonly companionOffsetRadians?: number;
}

const degrees = (value: number): number => value * Math.PI / 180;

export const DOUBLE_PENDULUM_PRESETS: readonly DoublePendulumPreset[] = [
    {
        label: 'Chaos pair',
        detail: 'A 0.32° difference begins almost invisible, then grows into a different orbit.',
        parameters: DEFAULT_MODEL_PARAMETERS,
        state: { theta1: degrees(100), theta2: degrees(65), omega1: 0, omega2: 0 },
        speed: 0.75,
    },
    {
        label: 'High release',
        detail: 'Released near the unstable top, both links tumble through repeated inversions.',
        parameters: DEFAULT_MODEL_PARAMETERS,
        state: { theta1: degrees(168), theta2: degrees(152), omega1: 0, omega2: 0 },
        speed: 0.68,
        companionOffsetRadians: degrees(0.18),
    },
    {
        label: 'Heavy tip',
        detail: 'A heavier lower mass pulls the upper link into broad, asymmetric energy exchanges.',
        parameters: { gravity: 9.81, mass1: 0.8, mass2: 2.2, length1: 0.9, length2: 1.15 },
        state: { theta1: degrees(122), theta2: degrees(-38), omega1: 0, omega2: 0 },
        speed: 0.72,
        companionOffsetRadians: degrees(0.24),
    },
    {
        label: 'Fast kick',
        detail: 'Initial angular speed drives continuous flips while the twin trajectory peels away.',
        parameters: { gravity: 9.81, mass1: 1, mass2: 1.25, length1: 1.1, length2: 0.85 },
        state: { theta1: degrees(72), theta2: degrees(-108), omega1: 0.35, omega2: 2.6 },
        speed: 0.82,
        companionOffsetRadians: degrees(0.20),
    },
];

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
    private readonly companionTrail = new TrailBuffer(TRAIL_CAPACITY);
    private readonly model = new DoublePendulumModel(DEFAULT_MODEL_PARAMETERS);
    private readonly companionModel = new DoublePendulumModel(DEFAULT_MODEL_PARAMETERS);
    private parameterApplyTimer: ReturnType<typeof setTimeout> | null = null;
    private paused = false;
    private trailSampleCounter = 0;
    private presetIndex = 0;

    constructor(
        storage: StorageService,
        private readonly callbacks: DoublePendulumViewModelCallbacks,
    ) {
        super(
            storage,
            'module:double-pendulum:parameters-v3',
            DOUBLE_PENDULUM_PARAMETER_SCHEMA,
        );
        this.applyPresetValues(DOUBLE_PENDULUM_PRESETS[0]);
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
                this.companionModel.step(step);
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
        this.resetModelFromParameters();
    }

    selectPreset(index: number): void {
        const normalized = Math.max(0, Math.min(DOUBLE_PENDULUM_PRESETS.length - 1, Math.round(index)));
        this.cancelPendingParameterApply();
        this.presetIndex = normalized;
        this.applyPresetValues(DOUBLE_PENDULUM_PRESETS[normalized]);
        this.resetModelFromParameters();
        this.callbacks.stateChanged();
    }

    dispose(): void {
        this.cancelPendingParameterApply();
        this.trail.clear();
        this.companionTrail.clear();
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
        const positions = this.model.positions();
        const companionPositions = this.companionModel.positions();
        const divergence = Math.hypot(
            positions.second.x - companionPositions.second.x,
            positions.second.y - companionPositions.second.y,
        );

        return {
            positions,
            trail: this.trail.values,
            companionPositions,
            companionTrail: this.companionTrail.values,
            mass1: parameters.mass1,
            mass2: parameters.mass2,
            length1: parameters.length1,
            length2: parameters.length2,
            showTrail: this.getBoolean('showTrail'),
            presetIndex: this.presetIndex,
            elapsedTime: diagnostics.elapsedTime,
            divergence,
            diagnostics: [
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
        const parameters = this.readModelParameters();
        const initialState = this.readInitialState();
        const companionOffset = DOUBLE_PENDULUM_PRESETS[this.presetIndex].companionOffsetRadians
            ?? COMPANION_ANGLE_OFFSET_RADIANS;
        this.model.setParameters(parameters);
        this.model.reset(initialState);
        this.companionModel.setParameters(parameters);
        this.companionModel.reset({
            ...initialState,
            theta1: initialState.theta1 + companionOffset,
        });
        this.clock.reset();
        this.trail.clear();
        this.companionTrail.clear();
        this.trailSampleCounter = 0;
        this.pushTrailPoint();
    }

    private applyPresetValues(preset: DoublePendulumPreset): void {
        this.set('gravity', preset.parameters.gravity);
        this.set('mass1', preset.parameters.mass1);
        this.set('mass2', preset.parameters.mass2);
        this.set('length1', preset.parameters.length1);
        this.set('length2', preset.parameters.length2);
        this.set('initialAngle1', preset.state.theta1 * 180 / Math.PI);
        this.set('initialAngle2', preset.state.theta2 * 180 / Math.PI);
        this.set('initialOmega1', preset.state.omega1);
        this.set('initialOmega2', preset.state.omega2);
        this.set('speed', preset.speed);
        this.set('showTrail', true);
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
        this.companionTrail.push(this.companionModel.positions().second);
    }
}
