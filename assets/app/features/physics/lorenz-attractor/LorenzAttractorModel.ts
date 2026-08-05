import type {
    LorenzDiagnostics,
    LorenzParameters,
    LorenzSnapshot,
    LorenzState,
} from './LorenzAttractorTypes';

interface Derivative {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

const DEFAULT_PRIMARY: LorenzState = { x: 1, y: 1, z: 1 };
const DEFAULT_SHADOW: LorenzState = { x: 1.00001, y: 1, z: 1 };

export class LorenzAttractorModel {
    private currentParameters: LorenzParameters;
    private primary: LorenzState = { ...DEFAULT_PRIMARY };
    private shadow: LorenzState = { ...DEFAULT_SHADOW };
    private initialPrimary: LorenzState = { ...DEFAULT_PRIMARY };
    private initialShadow: LorenzState = { ...DEFAULT_SHADOW };
    private elapsedTime = 0;

    constructor(parameters: LorenzParameters) {
        this.currentParameters = this.validateParameters(parameters);
        this.reset();
    }

    get parameters(): LorenzParameters {
        return this.currentParameters;
    }

    setParameters(parameters: LorenzParameters): void {
        this.currentParameters = this.validateParameters(parameters);
        this.reset(this.initialPrimary, this.initialShadow);
    }

    reset(
        primary: LorenzState = this.initialPrimary,
        shadow: LorenzState = this.initialShadow,
    ): void {
        this.initialPrimary = this.validateState(primary);
        this.initialShadow = this.validateState(shadow);
        this.primary = { ...this.initialPrimary };
        this.shadow = { ...this.initialShadow };
        this.elapsedTime = 0;
    }

    step(dt: number): void {
        if (!Number.isFinite(dt) || dt <= 0) {
            throw new Error('Lorenz step must be a positive finite number');
        }
        this.primary = this.integrate(this.primary, dt);
        this.shadow = this.integrate(this.shadow, dt);
        this.elapsedTime += dt;
        this.validateState(this.primary);
        this.validateState(this.shadow);
    }

    snapshot(): LorenzSnapshot {
        return {
            elapsedTime: this.elapsedTime,
            primary: this.primary,
            shadow: this.shadow,
        };
    }

    diagnostics(): LorenzDiagnostics {
        const dx = this.shadow.x - this.primary.x;
        const dy = this.shadow.y - this.primary.y;
        const dz = this.shadow.z - this.primary.z;
        const separation = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const { sigma, rho, beta } = this.currentParameters;
        const hopfDenominator = sigma - beta - 1;
        const hopfThreshold = hopfDenominator > 0
            ? sigma * (sigma + beta + 3) / hopfDenominator
            : null;

        let regime: LorenzDiagnostics['regime'];
        if (rho < 1) {
            regime = 'stable-origin';
        } else if (hopfThreshold === null || rho < hopfThreshold) {
            regime = 'steady-convection';
        } else {
            regime = 'post-hopf';
        }

        return {
            separation,
            logSeparation: Math.log10(Math.max(1e-16, separation)),
            divergence: -(sigma + 1 + beta),
            hopfThreshold,
            regime,
        };
    }

    private integrate(state: LorenzState, dt: number): LorenzState {
        const k1 = this.derivative(state);
        const k2 = this.derivative(this.offset(state, k1, dt / 2));
        const k3 = this.derivative(this.offset(state, k2, dt / 2));
        const k4 = this.derivative(this.offset(state, k3, dt));
        return {
            x: state.x + dt * (k1.x + 2 * k2.x + 2 * k3.x + k4.x) / 6,
            y: state.y + dt * (k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6,
            z: state.z + dt * (k1.z + 2 * k2.z + 2 * k3.z + k4.z) / 6,
        };
    }

    private derivative(state: LorenzState): Derivative {
        const { sigma, rho, beta } = this.currentParameters;
        return {
            x: sigma * (state.y - state.x),
            y: state.x * (rho - state.z) - state.y,
            z: state.x * state.y - beta * state.z,
        };
    }

    private offset(state: LorenzState, derivative: Derivative, scale: number): LorenzState {
        return {
            x: state.x + derivative.x * scale,
            y: state.y + derivative.y * scale,
            z: state.z + derivative.z * scale,
        };
    }

    private validateParameters(parameters: LorenzParameters): LorenzParameters {
        for (const [name, value] of Object.entries(parameters)) {
            if (!Number.isFinite(value) || value <= 0) {
                throw new Error(`Lorenz parameter ${name} must be positive`);
            }
        }
        return { ...parameters };
    }

    private validateState(state: LorenzState): LorenzState {
        for (const [name, value] of Object.entries(state)) {
            if (!Number.isFinite(value) || Math.abs(value) > 1e6) {
                throw new Error(`Lorenz state ${name} diverged`);
            }
        }
        return { ...state };
    }
}
