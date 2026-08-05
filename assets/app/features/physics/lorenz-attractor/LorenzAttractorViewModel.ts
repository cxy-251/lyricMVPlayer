import { FixedStepClock } from '../../../animation/FixedStepClock';
import { ParameterController } from '../../../parameters/ParameterController';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import type { StorageService } from '../../../services/StorageService';
import { LorenzAttractorModel } from './LorenzAttractorModel';
import type {
    LorenzAttractorViewState,
    LorenzParameters,
    LorenzState,
    LorenzTrailPoint,
} from './LorenzAttractorTypes';

const PARAMETER_APPLY_DELAY_MS = 140;
const FIXED_STEP_SECONDS = 1 / 240;
const MAXIMUM_SUBSTEPS = 48;
const TRAIL_CAPACITY = 2400;
const SAMPLE_INTERVAL = 4;
const CLASSIC_BETA = 8 / 3;
const FRACTION_MATCH_TOLERANCE = 5e-7;

const DEFAULT_PARAMETERS: LorenzParameters = {
    sigma: 10,
    rho: 28,
    beta: CLASSIC_BETA,
};

export const LORENZ_ATTRACTOR_PARAMETER_SCHEMA: ParameterSchema = [
    {
        kind: 'number',
        key: 'sigma',
        label: 'σ · velocity response',
        description: 'How quickly circulation responds to the temperature-contrast state.',
        defaultValue: 10,
        minimum: 1,
        maximum: 24,
        step: 0.5,
        decimals: 1,
        unit: '',
    },
    {
        kind: 'number',
        key: 'rho',
        label: 'ρ · thermal driving',
        description: 'Dimensionless heating strength, analogous to a reduced Rayleigh control parameter.',
        defaultValue: 28,
        minimum: 0.5,
        maximum: 60,
        step: 0.5,
        decimals: 1,
        unit: '',
    },
    {
        kind: 'number',
        key: 'beta',
        label: 'β · geometry loss · ⁸⁄₃',
        description: 'Geometric dissipation factor. The classic Lorenz value is exactly 8/3.',
        defaultValue: CLASSIC_BETA,
        minimum: 0.5,
        maximum: 8,
        step: 1 / 30,
        decimals: 6,
        unit: '',
        formatValue: (value) => Math.abs(value - CLASSIC_BETA) < FRACTION_MATCH_TOLERANCE
            ? '⁸⁄₃'
            : value.toFixed(3),
    },
    {
        kind: 'number',
        key: 'initialX',
        label: 'Initial x · circulation',
        description: 'Initial circulation intensity and direction.',
        defaultValue: 1,
        minimum: -20,
        maximum: 20,
        step: 0.5,
        decimals: 1,
        unit: '',
    },
    {
        kind: 'number',
        key: 'initialY',
        label: 'Initial y · horizontal ΔT',
        description: 'Initial horizontal temperature-contrast state.',
        defaultValue: 1,
        minimum: -20,
        maximum: 20,
        step: 0.5,
        decimals: 1,
        unit: '',
    },
    {
        kind: 'number',
        key: 'initialZ',
        label: 'Initial z · vertical ΔT',
        description: 'Initial vertical temperature-profile distortion.',
        defaultValue: 1,
        minimum: 0,
        maximum: 50,
        step: 0.5,
        decimals: 1,
        unit: '',
    },
    {
        kind: 'number',
        key: 'perturbation',
        label: 'Nearby-state offset Δx₀',
        description: 'Difference between the two initial states used to demonstrate sensitive dependence.',
        defaultValue: 0.00001,
        minimum: 0.000001,
        maximum: 0.01,
        step: 0.000001,
        decimals: 6,
        unit: '',
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
        key: 'showShadow',
        label: 'Nearby trajectory',
        description: 'Show the trajectory starting only Δx₀ away from the primary state.',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
    {
        kind: 'toggle',
        key: 'rotateView',
        label: 'Rotate state-space view',
        description: 'Rotate the projection of the abstract x-y-z state space.',
        defaultValue: true,
        onLabel: 'ON',
        offLabel: 'OFF',
    },
];

export interface LorenzAttractorViewModelCallbacks {
    stateChanged(): void;
    reportError(error: unknown): void;
}

export class LorenzAttractorViewModel extends ParameterController {
    private readonly clock = new FixedStepClock(FIXED_STEP_SECONDS, MAXIMUM_SUBSTEPS);
    private readonly model = new LorenzAttractorModel(DEFAULT_PARAMETERS);
    private readonly primaryTrail: LorenzTrailPoint[] = [];
    private readonly shadowTrail: LorenzTrailPoint[] = [];
    private parameterApplyTimer: ReturnType<typeof setTimeout> | null = null;
    private paused = false;
    private sampleCounter = 0;
    private viewAngle = 0;

    constructor(
        storage: StorageService,
        private readonly callbacks: LorenzAttractorViewModelCallbacks,
    ) {
        super(
            storage,
            'module:lorenz-attractor:parameters-v1',
            LORENZ_ATTRACTOR_PARAMETER_SCHEMA,
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

        if (this.getBoolean('rotateView')) {
            this.viewAngle = (this.viewAngle + dt * 0.22) % (Math.PI * 2);
        }
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
        this.primaryTrail.length = 0;
        this.shadowTrail.length = 0;
        this.clock.reset();
        super.dispose();
    }

    parameterChanged(key: string): boolean {
        if (key === 'speed' || key === 'showShadow' || key === 'rotateView') {
            return true;
        }
        this.scheduleParameterApply();
        return false;
    }

    createViewState(): LorenzAttractorViewState {
        const snapshot = this.model.snapshot();
        const diagnostics = this.model.diagnostics();
        return {
            snapshot,
            primaryTrail: this.primaryTrail,
            shadowTrail: this.shadowTrail,
            showShadow: this.getBoolean('showShadow'),
            rotateView: this.getBoolean('rotateView'),
            viewAngle: this.viewAngle,
            diagnostics: [
                `t ${snapshot.elapsedTime.toFixed(2)}`,
                `Δ ${diagnostics.separation.toExponential(3)}`,
                `log₁₀Δ ${diagnostics.logSeparation.toFixed(2)}`,
                `∇·f ${diagnostics.divergence.toFixed(3)}`,
            ].join(' · '),
            modelSummary: [
                diagnostics.regime.toUpperCase().replace('-', ' '),
                `σ ${this.model.parameters.sigma.toFixed(2)}`,
                `ρ ${this.model.parameters.rho.toFixed(2)}`,
                `β ${this.formatBeta(this.model.parameters.beta)}`,
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
        this.model.setParameters(this.readParameters());
        const primary = this.readInitialState();
        const shadow = {
            ...primary,
            x: primary.x + this.getNumber('perturbation'),
        };
        this.model.reset(primary, shadow);
        this.clock.reset();
        this.sampleCounter = 0;
        this.viewAngle = 0;
        this.primaryTrail.length = 0;
        this.shadowTrail.length = 0;
        this.pushTrailPoints();
    }

    private readParameters(): LorenzParameters {
        return {
            sigma: this.getNumber('sigma'),
            rho: this.getNumber('rho'),
            beta: this.getNumber('beta'),
        };
    }

    private readInitialState(): LorenzState {
        return {
            x: this.getNumber('initialX'),
            y: this.getNumber('initialY'),
            z: this.getNumber('initialZ'),
        };
    }

    private pushTrailPoints(): void {
        const snapshot = this.model.snapshot();
        this.pushBounded(this.primaryTrail, {
            ...snapshot.primary,
            time: snapshot.elapsedTime,
        });
        this.pushBounded(this.shadowTrail, {
            ...snapshot.shadow,
            time: snapshot.elapsedTime,
        });
    }

    private pushBounded(target: LorenzTrailPoint[], point: LorenzTrailPoint): void {
        target.push(point);
        if (target.length > TRAIL_CAPACITY) {
            target.splice(0, target.length - TRAIL_CAPACITY);
        }
    }

    private formatBeta(value: number): string {
        return Math.abs(value - CLASSIC_BETA) < FRACTION_MATCH_TOLERANCE
            ? '⁸⁄₃'
            : value.toFixed(3);
    }
}
