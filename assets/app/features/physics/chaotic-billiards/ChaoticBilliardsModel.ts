import type {
    BilliardCollisionMarker,
    BilliardParticleState,
    BilliardVector,
    ChaoticBilliardsDiagnostics,
    ChaoticBilliardsParameters,
    ChaoticBilliardsSnapshot,
} from './ChaoticBilliardsTypes';

interface CollisionCandidate {
    readonly time: number;
    readonly point: BilliardVector;
    readonly normal: BilliardVector;
}

interface ParticleAdvanceResult {
    readonly state: BilliardParticleState;
    readonly collisionCount: number;
    readonly collision: BilliardCollisionMarker | null;
}

const TIME_EPSILON = 1e-10;
const POSITION_EPSILON = 1e-9;
const MAXIMUM_COLLISIONS_PER_STEP = 8;

export class ChaoticBilliardsModel {
    private currentParameters: ChaoticBilliardsParameters;
    private primary: BilliardParticleState = { x: 0, y: 0, vx: 1, vy: 0 };
    private nearby: BilliardParticleState = { x: 0, y: 0, vx: 1, vy: 0 };
    private elapsedTime = 0;
    private primaryCollisionCount = 0;
    private nearbyCollisionCount = 0;
    private primaryCollision: BilliardCollisionMarker | null = null;
    private nearbyCollision: BilliardCollisionMarker | null = null;

    constructor(parameters: ChaoticBilliardsParameters) {
        this.currentParameters = this.validateParameters(parameters);
        this.reset(0.18, 27 * Math.PI / 180, 0.001 * Math.PI / 180);
    }

    get parameters(): ChaoticBilliardsParameters {
        return this.currentParameters;
    }

    setParameters(parameters: ChaoticBilliardsParameters): void {
        this.currentParameters = this.validateParameters(parameters);
    }

    reset(
        initialY: number,
        launchAngleRadians: number,
        perturbationRadians: number,
    ): void {
        if (!Number.isFinite(initialY) || Math.abs(initialY) >= this.currentParameters.radius) {
            throw new Error('Billiard initial y must lie inside the table');
        }
        if (!Number.isFinite(launchAngleRadians)) {
            throw new Error('Billiard launch angle must be finite');
        }
        if (!Number.isFinite(perturbationRadians) || perturbationRadians < 0) {
            throw new Error('Billiard perturbation must be finite and non-negative');
        }

        this.primary = this.createParticle(initialY, launchAngleRadians);
        this.nearby = this.createParticle(
            initialY,
            launchAngleRadians + perturbationRadians,
        );
        this.elapsedTime = 0;
        this.primaryCollisionCount = 0;
        this.nearbyCollisionCount = 0;
        this.primaryCollision = null;
        this.nearbyCollision = null;
    }

    step(dt: number): void {
        if (!Number.isFinite(dt) || dt <= 0) {
            throw new Error('Billiard step must be positive and finite');
        }
        const primary = this.advanceParticle(
            this.primary,
            dt,
            this.primaryCollisionCount,
            this.primaryCollision,
        );
        const nearby = this.advanceParticle(
            this.nearby,
            dt,
            this.nearbyCollisionCount,
            this.nearbyCollision,
        );
        this.primary = primary.state;
        this.nearby = nearby.state;
        this.primaryCollisionCount = primary.collisionCount;
        this.nearbyCollisionCount = nearby.collisionCount;
        this.primaryCollision = primary.collision;
        this.nearbyCollision = nearby.collision;
        this.elapsedTime += dt;
    }

    snapshot(): ChaoticBilliardsSnapshot {
        return {
            elapsedTime: this.elapsedTime,
            primary: { ...this.primary },
            nearby: { ...this.nearby },
            primaryCollisionCount: this.primaryCollisionCount,
            nearbyCollisionCount: this.nearbyCollisionCount,
            primaryCollision: this.primaryCollision
                ? {
                    point: { ...this.primaryCollision.point },
                    normal: { ...this.primaryCollision.normal },
                }
                : null,
            nearbyCollision: this.nearbyCollision
                ? {
                    point: { ...this.nearbyCollision.point },
                    normal: { ...this.nearbyCollision.normal },
                }
                : null,
        };
    }

    diagnostics(): ChaoticBilliardsDiagnostics {
        const separation = Math.hypot(
            this.primary.x - this.nearby.x,
            this.primary.y - this.nearby.y,
        );
        return {
            separation,
            logarithmicSeparation: Math.log10(Math.max(1e-9, separation)),
            primarySpeed: Math.hypot(this.primary.vx, this.primary.vy),
            nearbySpeed: Math.hypot(this.nearby.vx, this.nearby.vy),
        };
    }

    private createParticle(
        initialY: number,
        angleRadians: number,
    ): BilliardParticleState {
        const speed = this.currentParameters.particleSpeed;
        return {
            x: 0,
            y: initialY,
            vx: Math.cos(angleRadians) * speed,
            vy: Math.sin(angleRadians) * speed,
        };
    }

    private advanceParticle(
        initial: BilliardParticleState,
        dt: number,
        initialCollisionCount: number,
        previousCollision: BilliardCollisionMarker | null,
    ): ParticleAdvanceResult {
        let state = { ...initial };
        let remaining = dt;
        let collisionCount = initialCollisionCount;
        let collision = previousCollision;

        for (
            let iteration = 0;
            iteration < MAXIMUM_COLLISIONS_PER_STEP && remaining > TIME_EPSILON;
            iteration += 1
        ) {
            const candidate = this.findEarliestCollision(state);
            if (!candidate || candidate.time > remaining) {
                state = {
                    ...state,
                    x: state.x + state.vx * remaining,
                    y: state.y + state.vy * remaining,
                };
                remaining = 0;
                break;
            }

            state = {
                ...state,
                x: candidate.point.x,
                y: candidate.point.y,
            };
            remaining -= candidate.time;
            const normalVelocity = state.vx * candidate.normal.x
                + state.vy * candidate.normal.y;
            state = {
                x: state.x - candidate.normal.x * POSITION_EPSILON,
                y: state.y - candidate.normal.y * POSITION_EPSILON,
                vx: state.vx - 2 * normalVelocity * candidate.normal.x,
                vy: state.vy - 2 * normalVelocity * candidate.normal.y,
            };
            collisionCount += 1;
            collision = {
                point: candidate.point,
                normal: candidate.normal,
            };
        }

        return {
            state,
            collisionCount,
            collision,
        };
    }

    private findEarliestCollision(
        state: BilliardParticleState,
    ): CollisionCandidate | null {
        const candidates: CollisionCandidate[] = [];
        const { radius } = this.currentParameters;
        const halfLength = this.currentParameters.boundary === 'circle'
            ? 0
            : this.currentParameters.straightHalfLength;

        if (halfLength > 0) {
            if (state.vy > TIME_EPSILON) {
                const time = (radius - state.y) / state.vy;
                const x = state.x + state.vx * time;
                if (
                    time > TIME_EPSILON
                    && x >= -halfLength - POSITION_EPSILON
                    && x <= halfLength + POSITION_EPSILON
                ) {
                    candidates.push({
                        time,
                        point: { x, y: radius },
                        normal: { x: 0, y: 1 },
                    });
                }
            } else if (state.vy < -TIME_EPSILON) {
                const time = (-radius - state.y) / state.vy;
                const x = state.x + state.vx * time;
                if (
                    time > TIME_EPSILON
                    && x >= -halfLength - POSITION_EPSILON
                    && x <= halfLength + POSITION_EPSILON
                ) {
                    candidates.push({
                        time,
                        point: { x, y: -radius },
                        normal: { x: 0, y: -1 },
                    });
                }
            }
        }

        const centers = halfLength === 0
            ? [0]
            : [-halfLength, halfLength];
        for (const centerX of centers) {
            const candidate = this.circleCollision(state, centerX, radius, halfLength);
            if (candidate) {
                candidates.push(candidate);
            }
        }

        if (candidates.length === 0) {
            return null;
        }
        return candidates.reduce((earliest, candidate) => (
            candidate.time < earliest.time ? candidate : earliest
        ));
    }

    private circleCollision(
        state: BilliardParticleState,
        centerX: number,
        radius: number,
        halfLength: number,
    ): CollisionCandidate | null {
        const dx = state.x - centerX;
        const dy = state.y;
        const speedSquared = state.vx * state.vx + state.vy * state.vy;
        const linear = 2 * (dx * state.vx + dy * state.vy);
        const constant = dx * dx + dy * dy - radius * radius;
        const discriminant = linear * linear - 4 * speedSquared * constant;
        if (discriminant < 0) {
            return null;
        }

        const root = Math.sqrt(Math.max(0, discriminant));
        const times = [
            (-linear - root) / (2 * speedSquared),
            (-linear + root) / (2 * speedSquared),
        ];
        for (const time of times) {
            if (time <= TIME_EPSILON) {
                continue;
            }
            const point = {
                x: state.x + state.vx * time,
                y: state.y + state.vy * time,
            };
            const belongsToBoundary = halfLength === 0
                || (centerX > 0 && point.x >= halfLength - POSITION_EPSILON)
                || (centerX < 0 && point.x <= -halfLength + POSITION_EPSILON);
            if (!belongsToBoundary) {
                continue;
            }
            return {
                time,
                point,
                normal: {
                    x: (point.x - centerX) / radius,
                    y: point.y / radius,
                },
            };
        }
        return null;
    }

    private validateParameters(
        parameters: ChaoticBilliardsParameters,
    ): ChaoticBilliardsParameters {
        if (parameters.boundary !== 'stadium' && parameters.boundary !== 'circle') {
            throw new Error('Billiard boundary must be stadium or circle');
        }
        if (!Number.isFinite(parameters.radius) || parameters.radius <= 0) {
            throw new Error('Billiard radius must be positive and finite');
        }
        if (
            !Number.isFinite(parameters.straightHalfLength)
            || parameters.straightHalfLength < 0
        ) {
            throw new Error('Billiard straight length must be finite and non-negative');
        }
        if (!Number.isFinite(parameters.particleSpeed) || parameters.particleSpeed <= 0) {
            throw new Error('Billiard particle speed must be positive and finite');
        }
        return { ...parameters };
    }
}
