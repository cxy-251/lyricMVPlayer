import { ParameterController } from '../../../parameters/ParameterController';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import type { StorageService } from '../../../services/StorageService';
import { DrivenCavityFlowModel } from './DrivenCavityFlowModel';
import type {
    CavityDisplayMode,
    CavityResolution,
    CavityTracer,
    DrivenCavityFlowViewState,
} from './DrivenCavityFlowTypes';

const PARAMETER_APPLY_DELAY_MS = 140;
const LATTICE_STEPS_PER_SECOND = 60;
const MAXIMUM_STEPS_PER_FRAME = 6;
const RESOLUTIONS: Record<CavityResolution, number> = {
    low: 40,
    medium: 56,
    high: 72,
};

export const DRIVEN_CAVITY_FLOW_PARAMETER_SCHEMA: ParameterSchema = [
    {
        kind: 'select',
        key: 'resolution',
        label: 'Lattice resolution',
        defaultValue: 'medium',
        options: [
            { value: 'low', label: '40 × 40 · FAST' },
            { value: 'medium', label: '56 × 56 · BALANCED' },
            { value: 'high', label: '72 × 72 · DETAILED' },
        ],
    },
    {
        kind: 'number',
        key: 'lidSpeed',
        label: 'Moving-lid speed U',
        defaultValue: 0.08,
        minimum: 0.02,
        maximum: 0.12,
        step: 0.005,
        decimals: 3,
        unit: ' lu/step',
    },
    {
        kind: 'number',
        key: 'viscosity',
        label: 'Kinematic viscosity ν',
        defaultValue: 0.04,
        minimum: 0.02,
        maximum: 0.12,
        step: 0.005,
        decimals: 3,
        unit: ' lu²/step',
    },
    {
        kind: 'number',
        key: 'speed',
        label: 'Simulation time scale',
        defaultValue: 1,
        minimum: 0.25,
        maximum: 2,
        step: 0.25,
        decimals: 2,
        unit: '×',
    },
    {
        kind: 'select',
        key: 'displayMode',
        label: 'Result contour',
        defaultValue: 'speed',
        options: [
            { value: 'speed', label: 'VELOCITY MAGNITUDE' },
            { value: 'vorticity', label: 'VORTICITY' },
            { value: 'tracers', label: 'VELOCITY + PARTICLES' },
        ],
    },
    {
        kind: 'number',
        key: 'tracerCount',
        label: 'Particle-track count',
        defaultValue: 240,
        minimum: 80,
        maximum: 520,
        step: 40,
        decimals: 0,
    },
    {
        kind: 'toggle',
        key: 'showVectors',
        label: 'Velocity vectors',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
    {
        kind: 'toggle',
        key: 'showGrid',
        label: 'Reference grid',
        defaultValue: false,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
];

export interface DrivenCavityFlowViewModelCallbacks {
    stateChanged(): void;
    reportError(error: unknown): void;
}

export class DrivenCavityFlowViewModel extends ParameterController {
    private readonly model = new DrivenCavityFlowModel({
        width: RESOLUTIONS.medium,
        height: RESOLUTIONS.medium,
        lidSpeed: 0.08,
        kinematicViscosity: 0.04,
    });
    private readonly tracers: CavityTracer[] = [];
    private parameterApplyTimer: ReturnType<typeof setTimeout> | null = null;
    private simulationAccumulator = 0;
    private paused = false;

    constructor(
        storage: StorageService,
        private readonly callbacks: DrivenCavityFlowViewModelCallbacks,
    ) {
        super(
            storage,
            'module:driven-cavity-flow:parameters-v2',
            DRIVEN_CAVITY_FLOW_PARAMETER_SCHEMA,
        );
        this.resetModelFromParameters();
    }

    update(dt: number): boolean {
        if (this.paused) return false;
        this.simulationAccumulator += Math.max(0, Math.min(0.1, dt))
            * this.getNumber('speed')
            * LATTICE_STEPS_PER_SECOND;
        const steps = Math.min(
            MAXIMUM_STEPS_PER_FRAME,
            Math.floor(this.simulationAccumulator),
        );
        if (steps < 1) return false;

        this.model.step(steps);
        this.advectTracers(steps);
        this.simulationAccumulator -= steps;
        if (
            steps === MAXIMUM_STEPS_PER_FRAME
            && this.simulationAccumulator >= 1
        ) this.simulationAccumulator %= 1;
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
        this.tracers.length = 0;
        super.dispose();
    }

    parameterChanged(key: string): boolean {
        if (
            key === 'speed'
            || key === 'displayMode'
            || key === 'showVectors'
            || key === 'showGrid'
        ) return true;
        if (key === 'tracerCount') {
            this.seedTracers();
            return true;
        }
        this.scheduleParameterApply();
        return false;
    }

    createViewState(): DrivenCavityFlowViewState {
        const snapshot = this.model.snapshot();
        const diagnostics = this.model.diagnostics();
        const displayMode = this.getString('displayMode') as CavityDisplayMode;
        const resultName = displayMode === 'vorticity'
            ? 'VORTICITY CONTOUR'
            : displayMode === 'tracers'
                ? 'VELOCITY CONTOUR + PARTICLES'
                : 'VELOCITY MAGNITUDE CONTOUR';
        return {
            snapshot,
            diagnostics,
            tracers: this.tracers,
            displayMode,
            showVectors: this.getBoolean('showVectors'),
            showGrid: this.getBoolean('showGrid'),
            diagnosticsText: [
                `step ${snapshot.elapsedSteps}`,
                `Re ${diagnostics.reynoldsNumber.toFixed(0)}`,
                `max ${diagnostics.maximumSpeed.toFixed(4)}`,
                `mass drift ${diagnostics.normalizedMassDrift.toExponential(2)}`,
            ].join(' · '),
            modelSummary: [
                resultName,
                `${snapshot.width} × ${snapshot.height}`,
                'TOP WALL →',
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
        if (this.parameterApplyTimer === null) return;
        clearTimeout(this.parameterApplyTimer);
        this.parameterApplyTimer = null;
    }

    private resetModelFromParameters(): void {
        const resolution = this.getString('resolution') as CavityResolution;
        const size = RESOLUTIONS[resolution] ?? RESOLUTIONS.medium;
        this.model.setParameters({
            width: size,
            height: size,
            lidSpeed: this.getNumber('lidSpeed'),
            kinematicViscosity: this.getNumber('viscosity'),
        });
        this.simulationAccumulator = 0;
        this.paused = false;
        this.seedTracers();
    }

    private seedTracers(): void {
        const count = Math.max(1, Math.round(this.getNumber('tracerCount')));
        const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
        const rows = Math.max(1, Math.ceil(count / columns));
        this.tracers.length = 0;
        for (let index = 0; index < count; index += 1) {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const jitterX = ((index * 0.61803398875) % 1 - 0.5) * 0.35;
            const jitterY = ((index * 0.41421356237) % 1 - 0.5) * 0.35;
            this.tracers.push({
                x: this.clamp((column + 0.5 + jitterX) / columns, 0.025, 0.975),
                y: this.clamp((row + 0.5 + jitterY) / rows, 0.025, 0.975),
            });
        }
    }

    private advectTracers(steps: number): void {
        const gridLength = Math.max(1, this.model.parameters.width - 1);
        const scale = steps / gridLength;
        for (const tracer of this.tracers) {
            const first = this.model.sampleVelocity(tracer.x, tracer.y);
            const middleX = this.clamp(tracer.x + first.x * scale * 0.5, 0.01, 0.99);
            const middleY = this.clamp(tracer.y + first.y * scale * 0.5, 0.01, 0.99);
            const middle = this.model.sampleVelocity(middleX, middleY);
            tracer.x = this.clamp(tracer.x + middle.x * scale, 0.01, 0.99);
            tracer.y = this.clamp(tracer.y + middle.y * scale, 0.01, 0.99);
        }
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
