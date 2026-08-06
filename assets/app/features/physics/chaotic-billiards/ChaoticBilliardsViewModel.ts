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

const FIXED_STEP_SECONDS = 1 / 240;
const MAXIMUM_SUBSTEPS = 48;
const SAMPLE_INTERVAL = 2;
const PARAMETER_APPLY_DELAY_MS = 140;

export const CHAOTIC_BILLIARDS_PARAMETER_SCHEMA: ParameterSchema = [
    {
        kind: 'select',
        key: 'boundary',
        label: 'Boundary geometry',
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
        defaultValue: 0.18,
        minimum: -0.8,
        maximum: 0.8,
        step: 0.02,
        decimals: 2,
    },
    {
        kind: 'number',
        key: 'launchAngle',
        label: 'Launch angle θ₀',
        defaultValue: 27,
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
        label: 'Stadium straight half-length',
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
        defaultValue: 1,
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
        defaultValue: 2600,
        minimum: 400,
        maximum: 5000,
        step: 200,
        decimals: 0,
    },
    {
        kind: 'toggle',
        key: 'showNearby',
        label: 'Nearby trajectory',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
    {
        kind: 'toggle',
        key: 'showNormals',
        label: 'Last collision normals',
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
            'module:chaotic-billiards:parameters-v1',
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
        if (
            key === 'speed'
            || key === 'trailLength'
            || key === 'showNearby'
            || key === 'showNormals'
        ) {
            this.trimTrails();
            return true;
        }
        this.scheduleParameterApply();
        return false;
    }

    createViewState(): ChaoticBilliardsViewState {
        const snapshot = this.model.snapshot();
        const diagnostics = this.model.diagnostics();
        const parameters = this.model.parameters;
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
                'SPECULAR REFLECTION',
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
        this.trimTrails();
    }

    private trimTrails(): void {
        const capacity = Math.max(1, Math.round(this.getNumber('trailLength')));
        if (this.primaryTrail.length > capacity) {
            this.primaryTrail.splice(0, this.primaryTrail.length - capacity);
        }
        if (this.nearbyTrail.length > capacity) {
            this.nearbyTrail.splice(0, this.nearbyTrail.length - capacity);
        }
    }
}
