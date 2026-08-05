import { FixedStepClock } from '../../../animation/FixedStepClock';
import { ParameterController } from '../../../parameters/ParameterController';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import type { StorageService } from '../../../services/StorageService';
import { PlanarThreeBodyModel } from './RestrictedThreeBodyModel';
import type {
    PlanarThreeBodyPreset,
    PlanarThreeBodyViewState,
    PlanarTrailPoint,
} from './RestrictedThreeBodyTypes';

const FIXED_STEP_SECONDS = 1 / 600;
const MAXIMUM_SUBSTEPS = 60;
const PARAMETER_APPLY_DELAY_MS = 140;
const SAMPLE_INTERVAL = 4;
const SOFTENING_LENGTH = 0.015;

export const PLANAR_THREE_BODY_PARAMETER_SCHEMA: ParameterSchema = [
    {
        kind: 'select',
        key: 'preset',
        label: 'Initial motion',
        defaultValue: 'hierarchical-triple',
        options: [
            { value: 'hierarchical-triple', label: 'HIERARCHICAL TRIPLE' },
            { value: 'figure-eight', label: 'FIGURE EIGHT' },
            { value: 'rotating-triangle', label: 'ROTATING TRIANGLE' },
        ],
    },
    {
        kind: 'number',
        key: 'mass1',
        label: 'Mass m₁',
        defaultValue: 1,
        minimum: 0.25,
        maximum: 3,
        step: 0.05,
        decimals: 2,
    },
    {
        kind: 'number',
        key: 'mass2',
        label: 'Mass m₂',
        defaultValue: 1,
        minimum: 0.25,
        maximum: 3,
        step: 0.05,
        decimals: 2,
    },
    {
        kind: 'number',
        key: 'mass3',
        label: 'Mass m₃',
        defaultValue: 1,
        minimum: 0.25,
        maximum: 3,
        step: 0.05,
        decimals: 2,
    },
    {
        kind: 'number',
        key: 'gravity',
        label: 'Gravity strength G',
        defaultValue: 1,
        minimum: 0.3,
        maximum: 2,
        step: 0.05,
        decimals: 2,
    },
    {
        kind: 'number',
        key: 'velocityScale',
        label: 'Initial velocity scale',
        defaultValue: 1,
        minimum: 0.45,
        maximum: 1.55,
        step: 0.05,
        decimals: 2,
        unit: '×',
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
        kind: 'number',
        key: 'trailLength',
        label: 'Trajectory samples per body',
        defaultValue: 2200,
        minimum: 400,
        maximum: 5000,
        step: 200,
        decimals: 0,
    },
    {
        kind: 'toggle',
        key: 'showVelocityVectors',
        label: 'Velocity vectors',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
    {
        kind: 'toggle',
        key: 'showBarycenter',
        label: 'System barycenter',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
];

export interface PlanarThreeBodyViewModelCallbacks {
    stateChanged(): void;
    reportError(error: unknown): void;
}

export class PlanarThreeBodyViewModel extends ParameterController {
    private readonly clock = new FixedStepClock(
        FIXED_STEP_SECONDS,
        MAXIMUM_SUBSTEPS,
    );
    private readonly model = new PlanarThreeBodyModel({
        gravity: 1,
        softening: SOFTENING_LENGTH,
    });
    private readonly trails: PlanarTrailPoint[][] = [[], [], []];
    private parameterApplyTimer: ReturnType<typeof setTimeout> | null = null;
    private paused = false;
    private sampleCounter = 0;

    constructor(
        storage: StorageService,
        private readonly callbacks: PlanarThreeBodyViewModelCallbacks,
    ) {
        super(
            storage,
            'module:planar-three-body:parameters-v3',
            PLANAR_THREE_BODY_PARAMETER_SCHEMA,
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
        this.clearTrails();
        this.clock.reset();
        super.dispose();
    }

    parameterChanged(key: string): boolean {
        if (
            key === 'speed'
            || key === 'trailLength'
            || key === 'showVelocityVectors'
            || key === 'showBarycenter'
        ) {
            this.trimTrails();
            return true;
        }
        this.scheduleParameterApply();
        return false;
    }

    createViewState(): PlanarThreeBodyViewState {
        const snapshot = this.model.snapshot();
        const diagnostics = this.model.diagnostics();
        const preset = this.getString('preset') as PlanarThreeBodyPreset;
        return {
            snapshot,
            diagnostics,
            accelerations: this.model.accelerations(),
            trails: this.trails,
            preset,
            showVelocityVectors: this.getBoolean('showVelocityVectors'),
            showBarycenter: this.getBoolean('showBarycenter'),
            diagnosticsText: [
                `t ${snapshot.elapsedTime.toFixed(2)}`,
                `E ${diagnostics.totalEnergy.toFixed(5)}`,
                `ΔE ${diagnostics.normalizedEnergyDrift.toExponential(2)}`,
                `|P| ${diagnostics.momentumMagnitude.toExponential(2)}`,
            ].join(' · '),
            modelSummary: [
                preset.split('-').join(' ').toUpperCase(),
                'THREE DYNAMIC MASSES',
                `rmin ${diagnostics.minimumDistance.toFixed(3)}`,
                `COM (${diagnostics.barycenter.x.toExponential(1)}, ${diagnostics.barycenter.y.toExponential(1)})`,
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
        const gravity = this.getNumber('gravity');
        this.model.setParameters({
            gravity,
            softening: SOFTENING_LENGTH,
        });
        this.model.reset(PlanarThreeBodyModel.createPreset(
            this.getString('preset') as PlanarThreeBodyPreset,
            [
                this.getNumber('mass1'),
                this.getNumber('mass2'),
                this.getNumber('mass3'),
            ],
            this.getNumber('velocityScale'),
            gravity,
        ));
        this.paused = false;
        this.clock.reset();
        this.sampleCounter = 0;
        this.clearTrails();
        this.pushTrailPoints();
    }

    private pushTrailPoints(): void {
        const snapshot = this.model.snapshot();
        snapshot.bodies.forEach((body, index) => {
            this.trails[index].push({
                x: body.x,
                y: body.y,
                time: snapshot.elapsedTime,
            });
        });
        this.trimTrails();
    }

    private trimTrails(): void {
        const capacity = Math.max(1, Math.round(this.getNumber('trailLength')));
        for (const trail of this.trails) {
            if (trail.length > capacity) {
                trail.splice(0, trail.length - capacity);
            }
        }
    }

    private clearTrails(): void {
        for (const trail of this.trails) {
            trail.length = 0;
        }
    }
}
