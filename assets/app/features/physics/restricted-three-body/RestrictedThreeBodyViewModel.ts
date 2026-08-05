import { FixedStepClock } from '../../../animation/FixedStepClock';
import { ParameterController } from '../../../parameters/ParameterController';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import type { StorageService } from '../../../services/StorageService';
import { RestrictedThreeBodyModel } from './RestrictedThreeBodyModel';
import type {
    CR3BPLagrangePoint,
    CR3BPParameters,
    CR3BPState,
    CR3BPTrailPoint,
    RestrictedThreeBodyViewState,
} from './RestrictedThreeBodyTypes';

const FIXED_STEP_SECONDS = 1 / 720;
const MAXIMUM_SUBSTEPS = 72;
const PARAMETER_APPLY_DELAY_MS = 140;
const SAMPLE_INTERVAL = 6;

const DEFAULT_PARAMETERS: CR3BPParameters = {
    mu: 0.01215,
};

export const RESTRICTED_THREE_BODY_PARAMETER_SCHEMA: ParameterSchema = [
    {
        kind: 'number',
        key: 'mu',
        label: 'Mass ratio μ = m₂/(m₁+m₂)',
        description: 'Normalized secondary mass. 0.01215 approximates the Earth-Moon mass ratio.',
        defaultValue: 0.01215,
        minimum: 0.001,
        maximum: 0.5,
        step: 0.001,
        decimals: 5,
    },
    {
        kind: 'number',
        key: 'initialX',
        label: 'Initial x₀',
        description: 'Initial rotating-frame x position of the massless third body.',
        defaultValue: 0.82,
        minimum: -2,
        maximum: 2,
        step: 0.01,
        decimals: 2,
    },
    {
        kind: 'number',
        key: 'initialY',
        label: 'Initial y₀',
        description: 'Initial rotating-frame y position of the massless third body.',
        defaultValue: 0,
        minimum: -1.5,
        maximum: 1.5,
        step: 0.01,
        decimals: 2,
    },
    {
        kind: 'number',
        key: 'initialVx',
        label: 'Initial ẋ₀',
        description: 'Initial x velocity in normalized rotating-frame units.',
        defaultValue: 0,
        minimum: -2,
        maximum: 2,
        step: 0.01,
        decimals: 2,
    },
    {
        kind: 'number',
        key: 'initialVy',
        label: 'Initial ẏ₀',
        description: 'Initial y velocity. The default produces repeated close flybys without an immediate collision.',
        defaultValue: 0.17,
        minimum: -2,
        maximum: 2,
        step: 0.01,
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
        key: 'showLagrangePoints',
        label: 'Lagrange points L₁–L₅',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
    {
        kind: 'toggle',
        key: 'showGravityVectors',
        label: 'Gravity vectors',
        description: 'Show the two physical gravitational acceleration contributions.',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
];

export interface RestrictedThreeBodyViewModelCallbacks {
    stateChanged(): void;
    reportError(error: unknown): void;
}

export class RestrictedThreeBodyViewModel extends ParameterController {
    private readonly clock = new FixedStepClock(
        FIXED_STEP_SECONDS,
        MAXIMUM_SUBSTEPS,
    );
    private readonly model = new RestrictedThreeBodyModel(DEFAULT_PARAMETERS);
    private readonly trail: CR3BPTrailPoint[] = [];
    private lagrangePoints: readonly CR3BPLagrangePoint[] = this.model.lagrangePoints();
    private parameterApplyTimer: ReturnType<typeof setTimeout> | null = null;
    private paused = false;
    private sampleCounter = 0;

    constructor(
        storage: StorageService,
        private readonly callbacks: RestrictedThreeBodyViewModelCallbacks,
    ) {
        super(
            storage,
            'module:restricted-three-body:parameters-v1',
            RESTRICTED_THREE_BODY_PARAMETER_SCHEMA,
        );
        this.resetModelFromParameters();
    }

    update(dt: number): boolean {
        if (this.paused || this.model.snapshot().status !== 'active') {
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
        this.trail.length = 0;
        this.clock.reset();
        super.dispose();
    }

    parameterChanged(key: string): boolean {
        if (
            key === 'speed'
            || key === 'trailLength'
            || key === 'showLagrangePoints'
            || key === 'showGravityVectors'
        ) {
            this.trimTrail();
            return true;
        }
        this.scheduleParameterApply();
        return false;
    }

    createViewState(): RestrictedThreeBodyViewState {
        const snapshot = this.model.snapshot();
        const diagnostics = this.model.diagnostics();
        const status = snapshot.status.replace('-', ' ').toUpperCase();
        return {
            snapshot,
            diagnostics,
            primary: this.model.primaryPosition,
            secondary: this.model.secondaryPosition,
            lagrangePoints: this.lagrangePoints,
            gravityVectors: this.model.gravityVectors(),
            trail: this.trail,
            showLagrangePoints: this.getBoolean('showLagrangePoints'),
            showGravityVectors: this.getBoolean('showGravityVectors'),
            diagnosticsText: [
                `t ${snapshot.elapsedTime.toFixed(2)}`,
                `C ${diagnostics.jacobiConstant.toFixed(5)}`,
                `ΔC ${diagnostics.normalizedJacobiDrift.toExponential(2)}`,
                `|v| ${diagnostics.speed.toFixed(3)}`,
            ].join(' · '),
            modelSummary: [
                status,
                `μ ${this.model.parameters.mu.toFixed(5)}`,
                `r₁ ${diagnostics.primaryDistance.toFixed(3)}`,
                `r₂ ${diagnostics.secondaryDistance.toFixed(3)}`,
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
        this.model.setParameters({ mu: this.getNumber('mu') });
        const initialState: CR3BPState = {
            x: this.getNumber('initialX'),
            y: this.getNumber('initialY'),
            vx: this.getNumber('initialVx'),
            vy: this.getNumber('initialVy'),
        };
        this.model.reset(initialState);
        this.lagrangePoints = this.model.lagrangePoints();
        this.clock.reset();
        this.sampleCounter = 0;
        this.trail.length = 0;
        this.pushTrailPoint();
    }

    private pushTrailPoint(): void {
        const snapshot = this.model.snapshot();
        this.trail.push({
            x: snapshot.state.x,
            y: snapshot.state.y,
            time: snapshot.elapsedTime,
        });
        this.trimTrail();
    }

    private trimTrail(): void {
        const capacity = Math.max(1, Math.round(this.getNumber('trailLength')));
        if (this.trail.length > capacity) {
            this.trail.splice(0, this.trail.length - capacity);
        }
    }
}
