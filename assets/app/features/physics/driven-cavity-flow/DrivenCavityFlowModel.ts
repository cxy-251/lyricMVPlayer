import type {
    CavityVelocity,
    DrivenCavityFlowDiagnostics,
    DrivenCavityFlowParameters,
    DrivenCavityFlowSnapshot,
} from './DrivenCavityFlowTypes';

const Q = 9;
const CX = [0, 1, 0, -1, 0, 1, -1, -1, 1] as const;
const CY = [0, 0, 1, 0, -1, 1, 1, -1, -1] as const;
const W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36] as const;
const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6] as const;

export class DrivenCavityFlowModel {
    private params: DrivenCavityFlowParameters;
    private f = new Float64Array(0);
    private next = new Float64Array(0);
    private rho = new Float32Array(0);
    private ux = new Float32Array(0);
    private uy = new Float32Array(0);
    private omega = new Float32Array(0);
    private steps = 0;
    private initialMass = 1;

    constructor(parameters: DrivenCavityFlowParameters) {
        this.params = this.validate(parameters);
        this.allocate();
        this.reset();
    }

    get parameters(): DrivenCavityFlowParameters {
        return this.params;
    }

    setParameters(parameters: DrivenCavityFlowParameters): void {
        const next = this.validate(parameters);
        if (next.width !== this.params.width || next.height !== this.params.height) {
            this.params = next;
            this.allocate();
        } else {
            this.params = next;
        }
        this.reset();
    }

    reset(): void {
        const cells = this.params.width * this.params.height;
        for (let cell = 0; cell < cells; cell += 1) {
            for (let q = 0; q < Q; q += 1) this.f[cell * Q + q] = W[q];
        }
        this.next.fill(0);
        this.steps = 0;
        this.computeFields();
        this.initialMass = this.mass();
    }

    step(iterations = 1): void {
        const count = Math.max(1, Math.floor(iterations));
        if (!Number.isFinite(iterations)) throw new Error('Cavity iterations must be finite');
        for (let index = 0; index < count; index += 1) this.advance();
        this.steps += count;
        this.computeFields();
    }

    snapshot(): DrivenCavityFlowSnapshot {
        return {
            width: this.params.width,
            height: this.params.height,
            elapsedSteps: this.steps,
            density: this.rho,
            velocityX: this.ux,
            velocityY: this.uy,
            vorticity: this.omega,
        };
    }

    diagnostics(): DrivenCavityFlowDiagnostics {
        const { width, height, lidSpeed, kinematicViscosity } = this.params;
        let maximumSpeed = 0;
        let speedSum = 0;
        let topSum = 0;
        let topCount = 0;
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const cell = y * width + x;
                const speed = Math.hypot(this.ux[cell], this.uy[cell]);
                maximumSpeed = Math.max(maximumSpeed, speed);
                speedSum += speed;
                if (y >= height - 3) {
                    topSum += this.ux[cell];
                    topCount += 1;
                }
            }
        }
        const totalMass = this.mass();
        return {
            reynoldsNumber: Math.abs(lidSpeed) * Math.max(1, height - 1) / kinematicViscosity,
            relaxationTime: 0.5 + 3 * kinematicViscosity,
            totalMass,
            normalizedMassDrift: (totalMass - this.initialMass) / this.initialMass,
            maximumSpeed,
            meanSpeed: speedSum / Math.max(1, width * height),
            topMeanVelocityX: topSum / Math.max(1, topCount),
        };
    }

    sampleVelocity(xNormalized: number, yNormalized: number): CavityVelocity {
        const { width, height } = this.params;
        const x = this.clamp(xNormalized, 0, 1) * (width - 1);
        const y = this.clamp(yNormalized, 0, 1) * (height - 1);
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = Math.min(width - 1, x0 + 1);
        const y1 = Math.min(height - 1, y0 + 1);
        const tx = x - x0;
        const ty = y - y0;
        return {
            x: this.sample(this.ux, x0, y0, x1, y1, tx, ty),
            y: this.sample(this.uy, x0, y0, x1, y1, tx, ty),
        };
    }

    private allocate(): void {
        const cells = this.params.width * this.params.height;
        this.f = new Float64Array(cells * Q);
        this.next = new Float64Array(cells * Q);
        this.rho = new Float32Array(cells);
        this.ux = new Float32Array(cells);
        this.uy = new Float32Array(cells);
        this.omega = new Float32Array(cells);
    }

    private advance(): void {
        const { width, height, lidSpeed, kinematicViscosity } = this.params;
        const rate = 1 / (0.5 + 3 * kinematicViscosity);
        this.next.fill(0);
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const cell = y * width + x;
                const offset = cell * Q;
                let density = 0;
                let momentumX = 0;
                let momentumY = 0;
                for (let q = 0; q < Q; q += 1) {
                    const value = this.f[offset + q];
                    density += value;
                    momentumX += value * CX[q];
                    momentumY += value * CY[q];
                }
                if (!Number.isFinite(density) || density <= 0) {
                    throw new Error('Cavity density became invalid');
                }
                const velocityX = momentumX / density;
                const velocityY = momentumY / density;
                const speedSquared = velocityX * velocityX + velocityY * velocityY;
                for (let q = 0; q < Q; q += 1) {
                    const cu = CX[q] * velocityX + CY[q] * velocityY;
                    const equilibrium = W[q] * density * (
                        1 + 3 * cu + 4.5 * cu * cu - 1.5 * speedSquared
                    );
                    const post = this.f[offset + q] - rate * (this.f[offset + q] - equilibrium);
                    const nextX = x + CX[q];
                    const nextY = y + CY[q];
                    if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
                        this.next[(nextY * width + nextX) * Q + q] += post;
                    } else {
                        const wallVelocity = nextY >= height ? lidSpeed : 0;
                        this.next[offset + OPP[q]] += post
                            - 6 * W[q] * density * CX[q] * wallVelocity;
                    }
                }
            }
        }
        const previous = this.f;
        this.f = this.next;
        this.next = previous;
    }

    private computeFields(): void {
        const { width, height } = this.params;
        for (let cell = 0; cell < width * height; cell += 1) {
            const offset = cell * Q;
            let density = 0;
            let momentumX = 0;
            let momentumY = 0;
            for (let q = 0; q < Q; q += 1) {
                const value = this.f[offset + q];
                density += value;
                momentumX += value * CX[q];
                momentumY += value * CY[q];
            }
            this.rho[cell] = density;
            this.ux[cell] = momentumX / Math.max(1e-12, density);
            this.uy[cell] = momentumY / Math.max(1e-12, density);
        }
        for (let y = 0; y < height; y += 1) {
            const y0 = Math.max(0, y - 1);
            const y1 = Math.min(height - 1, y + 1);
            for (let x = 0; x < width; x += 1) {
                const x0 = Math.max(0, x - 1);
                const x1 = Math.min(width - 1, x + 1);
                const dUyDx = (this.uy[y * width + x1] - this.uy[y * width + x0])
                    / Math.max(1, x1 - x0);
                const dUxDy = (this.ux[y1 * width + x] - this.ux[y0 * width + x])
                    / Math.max(1, y1 - y0);
                this.omega[y * width + x] = dUyDx - dUxDy;
            }
        }
    }

    private mass(): number {
        let value = 0;
        for (let index = 0; index < this.rho.length; index += 1) value += this.rho[index];
        return value;
    }

    private sample(
        field: Float32Array,
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        tx: number,
        ty: number,
    ): number {
        const width = this.params.width;
        const a = field[y0 * width + x0] * (1 - tx) + field[y0 * width + x1] * tx;
        const b = field[y1 * width + x0] * (1 - tx) + field[y1 * width + x1] * tx;
        return a * (1 - ty) + b * ty;
    }

    private validate(parameters: DrivenCavityFlowParameters): DrivenCavityFlowParameters {
        if (
            !Number.isInteger(parameters.width)
            || !Number.isInteger(parameters.height)
            || parameters.width < 16
            || parameters.height < 16
            || parameters.width > 96
            || parameters.height > 96
        ) throw new Error('Cavity grid must be between 16 and 96 cells');
        if (!Number.isFinite(parameters.lidSpeed) || Math.abs(parameters.lidSpeed) > 0.15) {
            throw new Error('Cavity lid speed must not exceed 0.15');
        }
        if (
            !Number.isFinite(parameters.kinematicViscosity)
            || parameters.kinematicViscosity < 0.015
            || parameters.kinematicViscosity > 0.2
        ) throw new Error('Cavity viscosity must be between 0.015 and 0.2');
        return { ...parameters };
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
