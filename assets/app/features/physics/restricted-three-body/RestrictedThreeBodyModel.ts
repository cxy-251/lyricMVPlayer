import type {
    PlanarBodyState,
    PlanarThreeBodyDiagnostics,
    PlanarThreeBodyParameters,
    PlanarThreeBodyPreset,
    PlanarThreeBodySnapshot,
    PlanarVector,
} from './RestrictedThreeBodyTypes';

interface BodyDerivative {
    readonly x: number;
    readonly y: number;
    readonly vx: number;
    readonly vy: number;
}

const FIGURE_EIGHT_POSITIONS: readonly PlanarVector[] = [
    { x: -0.97000436, y: 0.24308753 },
    { x: 0.97000436, y: -0.24308753 },
    { x: 0, y: 0 },
];
const FIGURE_EIGHT_VELOCITIES: readonly PlanarVector[] = [
    { x: 0.466203685, y: 0.43236573 },
    { x: 0.466203685, y: 0.43236573 },
    { x: -0.93240737, y: -0.86473146 },
];

export class PlanarThreeBodyModel {
    private parameters: PlanarThreeBodyParameters;
    private bodies: PlanarBodyState[] = [];
    private elapsedTime = 0;
    private initialEnergy = 0;

    constructor(parameters: PlanarThreeBodyParameters) {
        this.parameters = this.validateParameters(parameters);
        this.reset(PlanarThreeBodyModel.createPreset(
            'hierarchical-triple',
            [1, 1, 1],
            1,
            this.parameters.gravity,
        ));
    }

    static createPreset(
        preset: PlanarThreeBodyPreset,
        masses: readonly number[],
        velocityScale: number,
        gravity: number,
    ): readonly PlanarBodyState[] {
        if (masses.length !== 3 || masses.some((mass) => !Number.isFinite(mass) || mass <= 0)) {
            throw new Error('Planar three-body presets require three positive finite masses');
        }
        const gravityVelocityScale = Math.sqrt(Math.max(1e-9, gravity));
        let bodies: PlanarBodyState[];

        if (preset === 'rotating-triangle') {
            const radius = 0.86;
            const totalMass = masses[0] + masses[1] + masses[2];
            const angularSpeed = Math.sqrt(
                Math.max(1e-9, gravity * totalMass / (3 * Math.sqrt(3) * radius ** 3)),
            );
            bodies = masses.map((mass, index) => {
                const angle = Math.PI / 2 + index * Math.PI * 2 / 3;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                return {
                    mass,
                    x,
                    y,
                    vx: -y * angularSpeed * velocityScale,
                    vy: x * angularSpeed * velocityScale,
                };
            });
        } else if (preset === 'figure-eight') {
            bodies = masses.map((mass, index) => ({
                mass,
                x: FIGURE_EIGHT_POSITIONS[index].x,
                y: FIGURE_EIGHT_POSITIONS[index].y,
                vx: FIGURE_EIGHT_VELOCITIES[index].x
                    * velocityScale
                    * gravityVelocityScale,
                vy: FIGURE_EIGHT_VELOCITIES[index].y
                    * velocityScale
                    * gravityVelocityScale,
            }));
        } else {
            const innerRadius = 0.28;
            const outerSeparation = 2.4;
            const pairMass = masses[0] + masses[1];
            const totalMass = pairMass + masses[2];
            const pairCenterX = -masses[2] / totalMass * outerSeparation;
            const outerX = pairMass / totalMass * outerSeparation;
            const innerAngularSpeed = Math.sqrt(
                Math.max(1e-9, gravity * pairMass / (8 * innerRadius ** 3)),
            );
            const outerAngularSpeed = Math.sqrt(
                Math.max(1e-9, gravity * totalMass / outerSeparation ** 3),
            );
            const pairCenterVy = -pairCenterX * outerAngularSpeed;
            const outerVy = -outerX * outerAngularSpeed;
            bodies = [
                {
                    mass: masses[0],
                    x: pairCenterX - innerRadius,
                    y: 0,
                    vx: 0,
                    vy: pairCenterVy + innerRadius * innerAngularSpeed,
                },
                {
                    mass: masses[1],
                    x: pairCenterX + innerRadius,
                    y: 0,
                    vx: 0,
                    vy: pairCenterVy - innerRadius * innerAngularSpeed,
                },
                {
                    mass: masses[2],
                    x: outerX,
                    y: 0,
                    vx: 0,
                    vy: outerVy,
                },
            ].map((body) => ({
                ...body,
                vx: body.vx * velocityScale,
                vy: body.vy * velocityScale,
            }));
        }

        return this.normalizeBarycentricState(bodies);
    }

    setParameters(parameters: PlanarThreeBodyParameters): void {
        this.parameters = this.validateParameters(parameters);
    }

    reset(bodies: readonly PlanarBodyState[]): void {
        if (bodies.length !== 3) {
            throw new Error('Planar three-body model requires exactly three bodies');
        }
        this.bodies = bodies.map((body) => this.validateBody(body));
        this.elapsedTime = 0;
        this.initialEnergy = this.totalEnergy(this.bodies);
    }

    step(dt: number): void {
        if (!Number.isFinite(dt) || dt <= 0) {
            throw new Error('Planar three-body step must be positive and finite');
        }
        const k1 = this.derivative(this.bodies);
        const k2 = this.derivative(this.offset(this.bodies, k1, dt / 2));
        const k3 = this.derivative(this.offset(this.bodies, k2, dt / 2));
        const k4 = this.derivative(this.offset(this.bodies, k3, dt));
        this.bodies = this.bodies.map((body, index) => ({
            mass: body.mass,
            x: body.x + dt * (
                k1[index].x + 2 * k2[index].x + 2 * k3[index].x + k4[index].x
            ) / 6,
            y: body.y + dt * (
                k1[index].y + 2 * k2[index].y + 2 * k3[index].y + k4[index].y
            ) / 6,
            vx: body.vx + dt * (
                k1[index].vx + 2 * k2[index].vx + 2 * k3[index].vx + k4[index].vx
            ) / 6,
            vy: body.vy + dt * (
                k1[index].vy + 2 * k2[index].vy + 2 * k3[index].vy + k4[index].vy
            ) / 6,
        })).map((body) => this.validateBody(body));
        this.elapsedTime += dt;
    }

    snapshot(): PlanarThreeBodySnapshot {
        return {
            elapsedTime: this.elapsedTime,
            bodies: this.bodies.map((body) => ({ ...body })),
        };
    }

    accelerations(): readonly PlanarVector[] {
        return this.computeAccelerations(this.bodies);
    }

    diagnostics(): PlanarThreeBodyDiagnostics {
        const totalMass = this.bodies.reduce((sum, body) => sum + body.mass, 0);
        const momentum = this.bodies.reduce(
            (sum, body) => ({
                x: sum.x + body.mass * body.vx,
                y: sum.y + body.mass * body.vy,
            }),
            { x: 0, y: 0 },
        );
        const barycenter = this.bodies.reduce(
            (sum, body) => ({
                x: sum.x + body.mass * body.x / totalMass,
                y: sum.y + body.mass * body.y / totalMass,
            }),
            { x: 0, y: 0 },
        );
        let minimumDistance = Number.POSITIVE_INFINITY;
        for (let left = 0; left < this.bodies.length; left += 1) {
            for (let right = left + 1; right < this.bodies.length; right += 1) {
                minimumDistance = Math.min(
                    minimumDistance,
                    Math.hypot(
                        this.bodies[right].x - this.bodies[left].x,
                        this.bodies[right].y - this.bodies[left].y,
                    ),
                );
            }
        }
        const totalEnergy = this.totalEnergy(this.bodies);
        return {
            totalEnergy,
            normalizedEnergyDrift: Math.abs(totalEnergy - this.initialEnergy)
                / Math.max(1, Math.abs(this.initialEnergy)),
            momentum,
            momentumMagnitude: Math.hypot(momentum.x, momentum.y),
            barycenter,
            minimumDistance,
        };
    }

    private derivative(bodies: readonly PlanarBodyState[]): readonly BodyDerivative[] {
        const accelerations = this.computeAccelerations(bodies);
        return bodies.map((body, index) => ({
            x: body.vx,
            y: body.vy,
            vx: accelerations[index].x,
            vy: accelerations[index].y,
        }));
    }

    private computeAccelerations(bodies: readonly PlanarBodyState[]): readonly PlanarVector[] {
        const { gravity, softening } = this.parameters;
        const softeningSquared = softening * softening;
        return bodies.map((body, index) => {
            let x = 0;
            let y = 0;
            for (let otherIndex = 0; otherIndex < bodies.length; otherIndex += 1) {
                if (index === otherIndex) {
                    continue;
                }
                const other = bodies[otherIndex];
                const dx = other.x - body.x;
                const dy = other.y - body.y;
                const inverseCube = (dx * dx + dy * dy + softeningSquared) ** -1.5;
                x += gravity * other.mass * dx * inverseCube;
                y += gravity * other.mass * dy * inverseCube;
            }
            return { x, y };
        });
    }

    private offset(
        bodies: readonly PlanarBodyState[],
        derivative: readonly BodyDerivative[],
        scale: number,
    ): readonly PlanarBodyState[] {
        return bodies.map((body, index) => ({
            mass: body.mass,
            x: body.x + derivative[index].x * scale,
            y: body.y + derivative[index].y * scale,
            vx: body.vx + derivative[index].vx * scale,
            vy: body.vy + derivative[index].vy * scale,
        }));
    }

    private totalEnergy(bodies: readonly PlanarBodyState[]): number {
        const kinetic = bodies.reduce(
            (sum, body) => sum + 0.5 * body.mass * (
                body.vx * body.vx + body.vy * body.vy
            ),
            0,
        );
        let potential = 0;
        for (let left = 0; left < bodies.length; left += 1) {
            for (let right = left + 1; right < bodies.length; right += 1) {
                const dx = bodies[right].x - bodies[left].x;
                const dy = bodies[right].y - bodies[left].y;
                potential -= this.parameters.gravity
                    * bodies[left].mass
                    * bodies[right].mass
                    / Math.sqrt(
                        dx * dx
                        + dy * dy
                        + this.parameters.softening * this.parameters.softening,
                    );
            }
        }
        return kinetic + potential;
    }

    private validateParameters(
        parameters: PlanarThreeBodyParameters,
    ): PlanarThreeBodyParameters {
        if (!Number.isFinite(parameters.gravity) || parameters.gravity <= 0) {
            throw new Error('Planar three-body gravity must be positive and finite');
        }
        if (!Number.isFinite(parameters.softening) || parameters.softening < 0) {
            throw new Error('Planar three-body softening must be finite and non-negative');
        }
        return { ...parameters };
    }

    private validateBody(body: PlanarBodyState): PlanarBodyState {
        if (!Number.isFinite(body.mass) || body.mass <= 0) {
            throw new Error('Planar three-body mass must be positive and finite');
        }
        for (const [name, value] of Object.entries(body)) {
            if (name === 'mass') {
                continue;
            }
            if (!Number.isFinite(value) || Math.abs(value) > 1e7) {
                throw new Error(`Planar three-body state ${name} diverged`);
            }
        }
        return { ...body };
    }

    private static normalizeBarycentricState(
        bodies: readonly PlanarBodyState[],
    ): readonly PlanarBodyState[] {
        const totalMass = bodies.reduce((sum, body) => sum + body.mass, 0);
        const center = bodies.reduce(
            (sum, body) => ({
                x: sum.x + body.mass * body.x / totalMass,
                y: sum.y + body.mass * body.y / totalMass,
            }),
            { x: 0, y: 0 },
        );
        const centerVelocity = bodies.reduce(
            (sum, body) => ({
                x: sum.x + body.mass * body.vx / totalMass,
                y: sum.y + body.mass * body.vy / totalMass,
            }),
            { x: 0, y: 0 },
        );
        return bodies.map((body) => ({
            ...body,
            x: body.x - center.x,
            y: body.y - center.y,
            vx: body.vx - centerVelocity.x,
            vy: body.vy - centerVelocity.y,
        }));
    }
}
