export interface DoublePendulumState {
    readonly theta1: number;
    readonly theta2: number;
    readonly omega1: number;
    readonly omega2: number;
}

export interface DoublePendulumParameters {
    readonly gravity: number;
    readonly mass1: number;
    readonly mass2: number;
    readonly length1: number;
    readonly length2: number;
}

export interface DoublePendulumPoint {
    readonly x: number;
    readonly y: number;
}

export interface DoublePendulumPositions {
    readonly first: DoublePendulumPoint;
    readonly second: DoublePendulumPoint;
}

export interface DoublePendulumDiagnostics {
    readonly elapsedTime: number;
    readonly totalEnergy: number;
    readonly relativeEnergyDrift: number;
    readonly constraintError: number;
}

interface StateDerivative {
    readonly theta1: number;
    readonly theta2: number;
    readonly omega1: number;
    readonly omega2: number;
}

const DEFAULT_STATE: DoublePendulumState = {
    theta1: 100 * Math.PI / 180,
    theta2: 65 * Math.PI / 180,
    omega1: 0,
    omega2: 0,
};

export class DoublePendulumModel {
    private currentState: DoublePendulumState = DEFAULT_STATE;
    private initialState: DoublePendulumState = DEFAULT_STATE;
    private currentParameters: DoublePendulumParameters;
    private referenceEnergy = 0;
    private time = 0;

    constructor(parameters: DoublePendulumParameters) {
        this.currentParameters = this.validateParameters(parameters);
        this.reset();
    }

    get state(): DoublePendulumState {
        return this.currentState;
    }

    get parameters(): DoublePendulumParameters {
        return this.currentParameters;
    }

    setParameters(parameters: DoublePendulumParameters): void {
        this.currentParameters = this.validateParameters(parameters);
        this.reset();
    }

    reset(state: DoublePendulumState = this.initialState): void {
        this.initialState = this.validateState(state);
        this.currentState = this.initialState;
        this.time = 0;
        this.referenceEnergy = this.energy(this.currentState);
    }

    step(dt: number): void {
        if (!Number.isFinite(dt) || dt <= 0) {
            throw new Error('Double pendulum step must be a positive finite number');
        }

        const state = this.currentState;
        const k1 = this.derivative(state);
        const k2 = this.derivative(this.offset(state, k1, dt / 2));
        const k3 = this.derivative(this.offset(state, k2, dt / 2));
        const k4 = this.derivative(this.offset(state, k3, dt));

        this.currentState = {
            theta1: this.wrapAngle(state.theta1 + dt * (
                k1.theta1 + 2 * k2.theta1 + 2 * k3.theta1 + k4.theta1
            ) / 6),
            theta2: this.wrapAngle(state.theta2 + dt * (
                k1.theta2 + 2 * k2.theta2 + 2 * k3.theta2 + k4.theta2
            ) / 6),
            omega1: state.omega1 + dt * (
                k1.omega1 + 2 * k2.omega1 + 2 * k3.omega1 + k4.omega1
            ) / 6,
            omega2: state.omega2 + dt * (
                k1.omega2 + 2 * k2.omega2 + 2 * k3.omega2 + k4.omega2
            ) / 6,
        };
        this.time += dt;
    }

    positions(state: DoublePendulumState = this.currentState): DoublePendulumPositions {
        const { length1, length2 } = this.currentParameters;
        const first = {
            x: length1 * Math.sin(state.theta1),
            y: -length1 * Math.cos(state.theta1),
        };
        const second = {
            x: first.x + length2 * Math.sin(state.theta2),
            y: first.y - length2 * Math.cos(state.theta2),
        };
        return { first, second };
    }

    energy(state: DoublePendulumState = this.currentState): number {
        const { gravity, mass1, mass2, length1, length2 } = this.currentParameters;
        const delta = state.theta1 - state.theta2;
        const kinetic = 0.5 * (mass1 + mass2) * length1 * length1
            * state.omega1 * state.omega1
            + 0.5 * mass2 * length2 * length2 * state.omega2 * state.omega2
            + mass2 * length1 * length2 * state.omega1 * state.omega2 * Math.cos(delta);
        const potential = -(mass1 + mass2) * gravity * length1 * Math.cos(state.theta1)
            - mass2 * gravity * length2 * Math.cos(state.theta2);
        return kinetic + potential;
    }

    diagnostics(): DoublePendulumDiagnostics {
        const positions = this.positions();
        const { length1, length2 } = this.currentParameters;
        const firstLength = Math.hypot(positions.first.x, positions.first.y);
        const secondLength = Math.hypot(
            positions.second.x - positions.first.x,
            positions.second.y - positions.first.y,
        );
        const totalEnergy = this.energy();

        return {
            elapsedTime: this.time,
            totalEnergy,
            relativeEnergyDrift: Math.abs(totalEnergy - this.referenceEnergy)
                / Math.max(1e-9, Math.abs(this.referenceEnergy)),
            constraintError: Math.max(
                Math.abs(firstLength - length1),
                Math.abs(secondLength - length2),
            ),
        };
    }

    private derivative(state: DoublePendulumState): StateDerivative {
        const { gravity, mass1, mass2, length1, length2 } = this.currentParameters;
        const delta = state.theta1 - state.theta2;
        const sinDelta = Math.sin(delta);
        const cosDelta = Math.cos(delta);

        const m11 = (mass1 + mass2) * length1 * length1;
        const m12 = mass2 * length1 * length2 * cosDelta;
        const m22 = mass2 * length2 * length2;
        const rhs1 = -mass2 * length1 * length2 * sinDelta
            * state.omega2 * state.omega2
            - (mass1 + mass2) * gravity * length1 * Math.sin(state.theta1);
        const rhs2 = mass2 * length1 * length2 * sinDelta
            * state.omega1 * state.omega1
            - mass2 * gravity * length2 * Math.sin(state.theta2);
        const determinant = m11 * m22 - m12 * m12;

        if (determinant <= Number.EPSILON) {
            throw new Error('Double pendulum mass matrix is singular');
        }

        const alpha1 = (rhs1 * m22 - m12 * rhs2) / determinant;
        const alpha2 = (m11 * rhs2 - m12 * rhs1) / determinant;

        return {
            theta1: state.omega1,
            theta2: state.omega2,
            omega1: alpha1,
            omega2: alpha2,
        };
    }

    private offset(
        state: DoublePendulumState,
        derivative: StateDerivative,
        scale: number,
    ): DoublePendulumState {
        return {
            theta1: state.theta1 + derivative.theta1 * scale,
            theta2: state.theta2 + derivative.theta2 * scale,
            omega1: state.omega1 + derivative.omega1 * scale,
            omega2: state.omega2 + derivative.omega2 * scale,
        };
    }

    private validateParameters(parameters: DoublePendulumParameters): DoublePendulumParameters {
        for (const [name, value] of Object.entries(parameters)) {
            if (!Number.isFinite(value) || value <= 0) {
                throw new Error(`Double pendulum parameter ${name} must be positive`);
            }
        }
        return { ...parameters };
    }

    private validateState(state: DoublePendulumState): DoublePendulumState {
        for (const [name, value] of Object.entries(state)) {
            if (!Number.isFinite(value)) {
                throw new Error(`Double pendulum state ${name} must be finite`);
            }
        }
        return { ...state };
    }

    private wrapAngle(angle: number): number {
        return Math.atan2(Math.sin(angle), Math.cos(angle));
    }
}
