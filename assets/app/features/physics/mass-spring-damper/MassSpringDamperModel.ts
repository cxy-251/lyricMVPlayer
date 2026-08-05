import type {
    MassSpringDamperDiagnostics,
    MassSpringDamperInitialState,
    MassSpringDamperParameters,
    MassSpringDamperSnapshot,
} from './MassSpringDamperTypes';

interface Derivative {
    readonly displacement: number;
    readonly velocity: number;
}

const DEFAULT_INITIAL_STATE: MassSpringDamperInitialState = {
    displacement: 0.35,
    velocity: 0,
};

export class MassSpringDamperModel {
    private currentParameters: MassSpringDamperParameters;
    private initialState: MassSpringDamperInitialState = { ...DEFAULT_INITIAL_STATE };
    private displacement = DEFAULT_INITIAL_STATE.displacement;
    private velocity = DEFAULT_INITIAL_STATE.velocity;
    private elapsedTime = 0;
    private referenceEnergy = 0;
    private dissipatedEnergy = 0;
    private inputWork = 0;

    constructor(parameters: MassSpringDamperParameters) {
        this.currentParameters = this.validateParameters(parameters);
        this.reset();
    }

    get parameters(): MassSpringDamperParameters {
        return this.currentParameters;
    }

    setParameters(parameters: MassSpringDamperParameters): void {
        this.currentParameters = this.validateParameters(parameters);
        this.reset(this.initialState);
    }

    reset(state: MassSpringDamperInitialState = this.initialState): void {
        this.initialState = this.validateState(state);
        this.displacement = this.initialState.displacement;
        this.velocity = this.initialState.velocity;
        this.elapsedTime = 0;
        this.dissipatedEnergy = 0;
        this.inputWork = 0;
        this.referenceEnergy = this.mechanicalEnergy();
    }

    step(dt: number): void {
        if (!Number.isFinite(dt) || dt <= 0) {
            throw new Error('Mass-spring-damper step must be a positive finite number');
        }

        const x0 = this.displacement;
        const v0 = this.velocity;
        const t0 = this.elapsedTime;

        const k1 = this.derivative(x0, v0, t0);
        const k2 = this.derivative(
            x0 + k1.displacement * dt / 2,
            v0 + k1.velocity * dt / 2,
            t0 + dt / 2,
        );
        const k3 = this.derivative(
            x0 + k2.displacement * dt / 2,
            v0 + k2.velocity * dt / 2,
            t0 + dt / 2,
        );
        const k4 = this.derivative(
            x0 + k3.displacement * dt,
            v0 + k3.velocity * dt,
            t0 + dt,
        );

        this.displacement = x0 + dt * (
            k1.displacement + 2 * k2.displacement + 2 * k3.displacement + k4.displacement
        ) / 6;
        this.velocity = v0 + dt * (
            k1.velocity + 2 * k2.velocity + 2 * k3.velocity + k4.velocity
        ) / 6;
        this.elapsedTime = t0 + dt;

        const averageVelocity = (v0 + this.velocity) / 2;
        const midpointTime = t0 + dt / 2;
        this.dissipatedEnergy += this.currentParameters.damping
            * averageVelocity * averageVelocity * dt;
        this.inputWork += this.forceAt(midpointTime) * averageVelocity * dt;

        if (!Number.isFinite(this.displacement) || !Number.isFinite(this.velocity)) {
            throw new Error('Mass-spring-damper state diverged');
        }
    }

    snapshot(): MassSpringDamperSnapshot {
        return {
            elapsedTime: this.elapsedTime,
            displacement: this.displacement,
            velocity: this.velocity,
            acceleration: this.accelerationAt(
                this.displacement,
                this.velocity,
                this.elapsedTime,
            ),
            appliedForce: this.forceAt(this.elapsedTime),
        };
    }

    diagnostics(): MassSpringDamperDiagnostics {
        const { mass, stiffness, damping } = this.currentParameters;
        const naturalFrequency = Math.sqrt(stiffness / mass);
        const dampingRatio = damping / (2 * Math.sqrt(mass * stiffness));
        const dampedFrequency = dampingRatio < 1
            ? naturalFrequency * Math.sqrt(1 - dampingRatio * dampingRatio)
            : 0;
        const mechanicalEnergy = this.mechanicalEnergy();

        return {
            naturalFrequency,
            dampingRatio,
            dampedFrequency,
            mechanicalEnergy,
            dissipatedEnergy: this.dissipatedEnergy,
            inputWork: this.inputWork,
            energyBalanceError: mechanicalEnergy
                + this.dissipatedEnergy
                - this.referenceEnergy
                - this.inputWork,
            regime: this.classifyRegime(dampingRatio),
        };
    }

    private derivative(
        displacement: number,
        velocity: number,
        time: number,
    ): Derivative {
        return {
            displacement: velocity,
            velocity: this.accelerationAt(displacement, velocity, time),
        };
    }

    private accelerationAt(
        displacement: number,
        velocity: number,
        time: number,
    ): number {
        const { mass, stiffness, damping } = this.currentParameters;
        return (
            this.forceAt(time)
            - damping * velocity
            - stiffness * displacement
        ) / mass;
    }

    private forceAt(time: number): number {
        const { forcingAmplitude, forcingFrequency } = this.currentParameters;
        return forcingAmplitude * Math.sin(forcingFrequency * time);
    }

    private mechanicalEnergy(): number {
        const { mass, stiffness } = this.currentParameters;
        return 0.5 * mass * this.velocity * this.velocity
            + 0.5 * stiffness * this.displacement * this.displacement;
    }

    private classifyRegime(
        dampingRatio: number,
    ): MassSpringDamperDiagnostics['regime'] {
        if (Math.abs(dampingRatio - 1) <= 1e-3) {
            return 'critical';
        }
        return dampingRatio < 1 ? 'underdamped' : 'overdamped';
    }

    private validateParameters(
        parameters: MassSpringDamperParameters,
    ): MassSpringDamperParameters {
        if (!Number.isFinite(parameters.mass) || parameters.mass <= 0) {
            throw new Error('Mass must be a positive finite number');
        }
        if (!Number.isFinite(parameters.stiffness) || parameters.stiffness <= 0) {
            throw new Error('Stiffness must be a positive finite number');
        }
        if (!Number.isFinite(parameters.damping) || parameters.damping < 0) {
            throw new Error('Damping must be a non-negative finite number');
        }
        if (
            !Number.isFinite(parameters.forcingAmplitude)
            || parameters.forcingAmplitude < 0
        ) {
            throw new Error('Forcing amplitude must be a non-negative finite number');
        }
        if (
            !Number.isFinite(parameters.forcingFrequency)
            || parameters.forcingFrequency < 0
        ) {
            throw new Error('Forcing frequency must be a non-negative finite number');
        }
        return { ...parameters };
    }

    private validateState(
        state: MassSpringDamperInitialState,
    ): MassSpringDamperInitialState {
        if (!Number.isFinite(state.displacement) || !Number.isFinite(state.velocity)) {
            throw new Error('Initial displacement and velocity must be finite');
        }
        return { ...state };
    }
}
