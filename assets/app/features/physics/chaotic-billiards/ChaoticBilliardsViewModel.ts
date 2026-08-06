import { FixedStepClock } from '../../../animation/FixedStepClock';
import { ParameterController } from '../../../parameters/ParameterController';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import type { StorageService } from '../../../services/StorageService';
import { ChaoticBilliardsModel } from './ChaoticBilliardsModel';
import type {
    BilliardBoundary,
    BilliardTrailPoint,
    ChaoticBilliardsViewState,
} from './ChaoticBilliardsTypes';

const FIXED_STEP_SECONDS = 1 / 120;
const MAXIMUM_SUBSTEPS = 16;
const SAMPLE_INTERVAL = 4;
const TRAIL_TRIM_BATCH = 128;
const PARAMETER_APPLY_DELAY_MS = 140;

export const CHAOTIC_BILLIARDS_PARAMETER_SCHEMA: ParameterSchema = [
    {
        kind: 'select',
        key: 'boundary',
        label: 'Boundary geometry',
        description: 'Circle is integrable; the stadium combines straight walls and curved caps to produce defocusing chaos.',
        defaultValue: 'stadium',
        options: [
            { value: 'stadium', label: 'STADIUM · CHAOTIC' },
            { value: 'circle', label: 'CIRCLE · REGULAR' },
        ],
    },
    {
        kind: 'number',
        key: 'particleSpeed',
        label: 'Particle speed',
        description: 'Constant speed between collisions. Ideal mirror reflections preserve its magnitude exactly.',
        defaultValue: 1,
        minimum: 0.5,
        maximum: 2,
        step: 0.05,
        decimals: 2,
        unit: 'u/s',
    },
    {
        kind: 'number',
        key: 'initialY',
        label: 'Initial vertical position y₀',
        description: 'Both particles start at x = 0 and share this vertical position inside the table.',
        defaultValue: 0.8,
        minimum: -0.8,
        maximum: 0.8,
        step: 0.02,
        decimals: 2,
    },
    {
        kind: 'number',
        key: 'launchAngle',
        label: 'Launch angle θ₀',
        description: 'Direction of the primary particle measured from the positive x axis.',
        defaultValue: 10,
        minimum: 5,
        maximum: 85,
        step: 1,
        decimals: 0,
        unit: '°',
    },
    {
        kind: 'number',
        key: 'perturbation',
        label: 'Nearby angle offset Δθ₀',
        description: 'Tiny launch-angle difference used to expose sensitive dependence on initial conditions.',
        defaultValue: 0.001,
        minimum: 0.0001,
        maximum: 0.1,
        step: 0.0001,
        decimals: 4,
        unit: '°',
    },
    {
        kind: 'number',
        key: 'straightHalfLength',
        label: 'Stadium half-length a',
        description: 'Half of each straight wall. The circle view ignores this value and sets a = 0.',
        defaultValue: 1.1,
        minimum: 0.35,
        maximum: 1.8,
        step: 0.05,
        decimals: 2,
    },
    {
        kind: 'number',
        key: 'speed',
        label: 'Simulation time scale',
        description: 'Playback multiplier only; it does not alter the geometric path or collision law.',
        defaultValue: 2,
        minimum: 0.25,
        maximum: 4,
        step: 0.25,
        decimals: 2,
        unit: '×',
    },
    {
        kind: 'number',
        key: 'trailLength',
        label: 'Trajectory samples',
        description: 'Maximum retained points for each trajectory before older path segments are removed.',
        defaultValue: 900,
        minimum: 300,
        maximum: 2400,
        step: 100,
        decimals: 0,
    },
    {
        kind: 'toggle',
        key: 'showNearby',
        label: 'Nearby trajectory',
        description: 'Show the second particle launched from the same point with angle θ₀ + Δθ₀.',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
    {
        kind: 'toggle',
        key: 'showNormals',
        label: 'Last collision normals',
        description: 'Display the inward normal at each particle’s most recent reflection point.',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
];

export interface ChaoticBilliardsViewModelCallbacks {
    stateChanged(): void;
    reportError(error: unknown): void;
}

export class ChaoticBilliardsViewModel extends ParameterController {
    private readonly clock = new FixedStepClock(
        FIXED_STEP_SECONDS,
        MAXIMUM_SUBSTEPS,
    );
    private readonly model = new ChaoticBilliardsModel({
        boundary: 'stadium',
        radius: 1,
        straightHalfLength: 1.1,
        particleSpeed: 1,
    });
    private readonly primaryTrail: BilliardTrailPoint[] = [];
    private readonly nearbyTrail: BilliardTrailPoint[] = [];
    private parameterApplyTimer: ReturnType<typeof setTimeout> | null = null;
    private paused = false;
    private sampleCounter = 0;

    constructor(
        storage: StorageService,
        private readonly callbacks: ChaoticBilliardsViewModelCallbacks,
    ) {
        super(
            storage,
            'module:chaotic-billiards:parameters-v3',
            CHAOTIC_BILLIARDS_PARAMETER_SCHEMA,
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
                this.sampleCounter += 1;
                if (this.sampleCounter >= SAMPLE_INTERVAL) {
                    this.sampleCounter = 0;
                    this.pushTrailPoints();
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
        this.paused = false;
        this.resetModelFromParameters();
    }

    dispose(): void {
        this.cancelPendingParameterApply();
        this.primaryTrail.length = 0;
        this.nearbyTrail.length = 0;
        this.clock.reset();
        super.dispose();
    }

    parameterChanged(key: string): boolean {
        if (key === 'trailLength') {
            this.trimTrails(true);
            return true;
        }
        if (
            key === 'speed'
            || key === 'showNearby'
            || key === 'showNormals'
        ) {
            return true;
        }
        this.scheduleParameterApply();
        return false;
    }

    createViewState(): ChaoticBilliardsViewState {
        const snapshot = this.model.snapshot();
        const diagnostics = this.model.diagnostics();
        const parameters = this.model.parameters;
        const separationState = parameters.boundary === 'circle'
            ? 'REGULAR REFERENCE'
            : diagnostics.separation >= 0.05
                ? 'NEARBY PATHS DIVERGED'
                : 'NEARBY PATHS SEPARATING';
        return {
            snapshot,
            diagnostics,
            parameters,
            primaryTrail: this.primaryTrail,
            nearbyTrail: this.nearbyTrail,
            showNearby: this.getBoolean('showNearby'),
            showNormals: this.getBoolean('showNormals'),
            diagnosticsText: [
                `t ${snapshot.elapsedTime.toFixed(2)}`,
                `Δr ${diagnostics.separation.toExponential(2)}`,
                `log₁₀Δr ${diagnostics.logarithmicSeparation.toFixed(2)}`,
                `hits ${snapshot.primaryCollisionCount}/${snapshot.nearbyCollisionCount}`,
            ].join(' · '),
            modelSummary: [
                parameters.boundary.toUpperCase(),
                separationState,
                `|v| ${diagnostics.primarySpeed.toFixed(3)}`,
                parameters.boundary === 'stadium'
                    ? `a ${parameters.straightHalfLength.toFixed(2)}`
                    : 'a 0',
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
        const boundary = this.getString('boundary') as BilliardBoundary;
        this.model.setParameters({
            boundary,
            radius: 1,
            straightHalfLength: this.getNumber('straightHalfLength'),
            particleSpeed: this.getNumber('particleSpeed'),
        });
        this.model.reset(
            this.getNumber('initialY'),
            this.getNumber('launchAngle') * Math.PI / 180,
            this.getNumber('perturbation') * Math.PI / 180,
        );
        this.clock.reset();
        this.paused = false;
        this.sampleCounter = 0;
        this.primaryTrail.length = 0;
        this.nearbyTrail.length = 0;
        this.pushTrailPoints();
    }

    private pushTrailPoints(): void {
        const snapshot = this.model.snapshot();
        this.primaryTrail.push({
            x: snapshot.primary.x,
            y: snapshot.primary.y,
            time: snapshot.elapsedTime,
        });
        this.nearbyTrail.push({
            x: snapshot.nearby.x,
            y: snapshot.nearby.y,
            time: snapshot.elapsedTime,
        });
        this.trimTrails(false);
    }

    private trimTrails(force: boolean): void {
        const capacity = Math.max(1, Math.round(this.getNumber('trailLength')));
        const threshold = force ? capacity : capacity + TRAIL_TRIM_BATCH;
        this.trimTrail(this.primaryTrail, capacity, threshold);
        this.trimTrail(this.nearbyTrail, capacity, threshold);
    }

    private trimTrail(
        trail: BilliardTrailPoint[],
        capacity: number,
        threshold: number,
    ): void {
        if (trail.length > threshold) {
            trail.splice(0, trail.length - capacity);
        }
    }
}
