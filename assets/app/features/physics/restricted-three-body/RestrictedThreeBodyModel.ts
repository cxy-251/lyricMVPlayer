import type {
    CR3BPDiagnostics,
    CR3BPGravityVectors,
    CR3BPLagrangePoint,
    CR3BPParameters,
    CR3BPSnapshot,
    CR3BPState,
    CR3BPStatus,
    CR3BPVector,
} from './RestrictedThreeBodyTypes';

interface Derivative {
    readonly x: number;
    readonly y: number;
    readonly vx: number;
    readonly vy: number;
}

const DEFAULT_STATE: CR3BPState = {
    x: 0.82,
    y: 0,
    vx: 0,
    vy: 0.17,
};

const COLLISION_RADIUS = 0.025;
const ESCAPE_RADIUS = 4;

export class RestrictedThreeBodyModel {
    private currentParameters: CR3BPParameters;
    private state: CR3BPState = { ...DEFAULT_STATE };
    private initialState: CR3BPState = { ...DEFAULT_STATE };
    private elapsedTime = 0;
    private status: CR3BPStatus = 'active';
    private initialJacobiConstant = 0;

    constructor(parameters: CR3BPParameters) {
        this.currentParameters = this.validateParameters(parameters);
        this.reset();
    }

    get parameters(): CR3BPParameters {
        return this.currentParameters;
    }

    get primaryPosition(): CR3BPVector {
        return { x: -this.currentParameters.mu, y: 0 };
    }

    get secondaryPosition(): CR3BPVector {
        return { x: 1 - this.currentParameters.mu, y: 0 };
    }

    setParameters(parameters: CR3BPParameters): void {
        this.currentParameters = this.validateParameters(parameters);
        this.reset(this.initialState);
    }

    reset(state: CR3BPState = this.initialState): void {
        this.initialState = this.validateState(state);
        this.state = { ...this.initialState };
        this.elapsedTime = 0;
        this.status = this.classify(this.state);
        this.initialJacobiConstant = this.jacobiConstant(this.state);
    }

    step(dt: number): void {
        if (!Number.isFinite(dt) || dt <= 0) {
            throw new Error('Restricted three-body step must be positive and finite');
        }
        if (this.status !== 'active') {
            return;
        }

        this.state = this.integrate(this.state, dt);
        this.elapsedTime += dt;
        this.validateState(this.state);
        this.status = this.classify(this.state);
    }

    snapshot(): CR3BPSnapshot {
        return {
            elapsedTime: this.elapsedTime,
            state: { ...this.state },
            status: this.status,
        };
    }

    diagnostics(): CR3BPDiagnostics {
        const jacobiConstant = this.jacobiConstant(this.state);
        const primary = this.primaryPosition;
        const secondary = this.secondaryPosition;
        const primaryDistance = Math.hypot(
            this.state.x - primary.x,
            this.state.y - primary.y,
        );
        const secondaryDistance = Math.hypot(
            this.state.x - secondary.x,
            this.state.y - secondary.y,
        );
        return {
            jacobiConstant,
            normalizedJacobiDrift: Math.abs(
                jacobiConstant - this.initialJacobiConstant,
            ) / Math.max(1, Math.abs(this.initialJacobiConstant)),
            speed: Math.hypot(this.state.vx, this.state.vy),
            primaryDistance,
            secondaryDistance,
        };
    }

    gravityVectors(): CR3BPGravityVectors {
        const { mu } = this.currentParameters;
        const primary = this.primaryPosition;
        const secondary = this.secondaryPosition;
        return {
            primary: this.gravityFrom(
                this.state,
                primary,
                1 - mu,
            ),
            secondary: this.gravityFrom(
                this.state,
                secondary,
                mu,
            ),
        };
    }

    lagrangePoints(): readonly CR3BPLagrangePoint[] {
        const { mu } = this.currentParameters;
        const triangularX = 0.5 - mu;
        const triangularY = Math.sqrt(3) / 2;
        return [
            { name: 'L1', x: this.solveCollinear(1 - mu - Math.cbrt(mu / 3)), y: 0 },
            { name: 'L2', x: this.solveCollinear(1 - mu + Math.cbrt(mu / 3)), y: 0 },
            { name: 'L3', x: this.solveCollinear(-1 - 5 * mu / 12), y: 0 },
            { name: 'L4', x: triangularX, y: triangularY },
            { name: 'L5', x: triangularX, y: -triangularY },
        ];
    }

    private integrate(state: CR3BPState, dt: number): CR3BPState {
        const k1 = this.derivative(state);
        const k2 = this.derivative(this.offset(state, k1, dt / 2));
        const k3 = this.derivative(this.offset(state, k2, dt / 2));
        const k4 = this.derivative(this.offset(state, k3, dt));
        return {
            x: state.x + dt * (k1.x + 2 * k2.x + 2 * k3.x + k4.x) / 6,
            y: state.y + dt * (k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6,
            vx: state.vx + dt * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx) / 6,
            vy: state.vy + dt * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy) / 6,
        };
    }

    private derivative(state: CR3BPState): Derivative {
        const { mu } = this.currentParameters;
        const primaryDx = state.x + mu;
        const secondaryDx = state.x - 1 + mu;
        const primaryDistance = Math.max(
            1e-9,
            Math.hypot(primaryDx, state.y),
        );
        const secondaryDistance = Math.max(
            1e-9,
            Math.hypot(secondaryDx, state.y),
        );
        const primaryCube = primaryDistance ** 3;
        const secondaryCube = secondaryDistance ** 3;
        const potentialX = state.x
            - (1 - mu) * primaryDx / primaryCube
            - mu * secondaryDx / secondaryCube;
        const potentialY = state.y
            - (1 - mu) * state.y / primaryCube
            - mu * state.y / secondaryCube;
        return {
            x: state.vx,
            y: state.vy,
            vx: 2 * state.vy + potentialX,
            vy: -2 * state.vx + potentialY,
        };
    }

    private offset(
        state: CR3BPState,
        derivative: Derivative,
        scale: number,
    ): CR3BPState {
        return {
            x: state.x + derivative.x * scale,
            y: state.y + derivative.y * scale,
            vx: state.vx + derivative.vx * scale,
            vy: state.vy + derivative.vy * scale,
        };
    }

    private jacobiConstant(state: CR3BPState): number {
        const { mu } = this.currentParameters;
        const primaryDistance = Math.max(
            1e-9,
            Math.hypot(state.x + mu, state.y),
        );
        const secondaryDistance = Math.max(
            1e-9,
            Math.hypot(state.x - 1 + mu, state.y),
        );
        const twicePotential = state.x * state.x
            + state.y * state.y
            + 2 * (1 - mu) / primaryDistance
            + 2 * mu / secondaryDistance;
        return twicePotential - state.vx * state.vx - state.vy * state.vy;
    }

    private gravityFrom(
        state: CR3BPState,
        source: CR3BPVector,
        mass: number,
    ): CR3BPVector {
        const dx = source.x - state.x;
        const dy = source.y - state.y;
        const distance = Math.max(1e-9, Math.hypot(dx, dy));
        const factor = mass / (distance ** 3);
        return { x: dx * factor, y: dy * factor };
    }

    private solveCollinear(initialGuess: number): number {
        let x = initialGuess;
        for (let index = 0; index < 24; index += 1) {
            const value = this.collinearEquation(x);
            const epsilon = 1e-6;
            const slope = (
                this.collinearEquation(x + epsilon)
                - this.collinearEquation(x - epsilon)
            ) / (2 * epsilon);
            if (!Number.isFinite(slope) || Math.abs(slope) < 1e-10) {
                break;
            }
            const next = x - value / slope;
            if (!Number.isFinite(next)) {
                break;
            }
            if (Math.abs(next - x) < 1e-12) {
                return next;
            }
            x = next;
        }
        return x;
    }

    private collinearEquation(x: number): number {
        const { mu } = this.currentParameters;
        const primaryDx = x + mu;
        const secondaryDx = x - 1 + mu;
        return x
            - (1 - mu) * primaryDx / Math.max(1e-12, Math.abs(primaryDx) ** 3)
            - mu * secondaryDx / Math.max(1e-12, Math.abs(secondaryDx) ** 3);
    }

    private classify(state: CR3BPState): CR3BPStatus {
        const primary = this.primaryPosition;
        const secondary = this.secondaryPosition;
        if (Math.hypot(state.x - primary.x, state.y) <= COLLISION_RADIUS) {
            return 'collision-primary';
        }
        if (Math.hypot(state.x - secondary.x, state.y) <= COLLISION_RADIUS) {
            return 'collision-secondary';
        }
        if (Math.hypot(state.x, state.y) >= ESCAPE_RADIUS) {
            return 'escaped';
        }
        return 'active';
    }

    private validateParameters(parameters: CR3BPParameters): CR3BPParameters {
        if (
            !Number.isFinite(parameters.mu)
            || parameters.mu <= 0
            || parameters.mu > 0.5
        ) {
            throw new Error('Restricted three-body mass ratio mu must be in (0, 0.5]');
        }
        return { ...parameters };
    }

    private validateState(state: CR3BPState): CR3BPState {
        for (const [name, value] of Object.entries(state)) {
            if (!Number.isFinite(value) || Math.abs(value) > 1e6) {
                throw new Error(`Restricted three-body state ${name} diverged`);
            }
        }
        return { ...state };
    }
}
