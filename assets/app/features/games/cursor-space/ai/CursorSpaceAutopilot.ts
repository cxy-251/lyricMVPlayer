import type { CursorSpaceModel } from '../../CursorSpaceModel';
import type {
    CursorSpaceBounds,
    CursorSpaceEnemy,
    CursorSpaceProjectile,
} from '../../CursorSpaceTypes';

const CANDIDATE_COUNT = 36;
const LOOK_AHEAD_DISTANCE = 188;
const PLAYER_MAXIMUM_SPEED = 540;
const PLAYER_RADIUS = 10;
const ENEMY_HORIZON = 1.08;
const PROJECTILE_HORIZON = 1.24;
const ENEMY_SAFETY_PADDING = 78;
const PROJECTILE_SAFETY_PADDING = 68;
const BOUNDARY_MARGIN = 104;
const ENGAGEMENT_RADIUS = 248;
const NORMAL_TURN_RATE = 4.4;
const EMERGENCY_TURN_RATE = 9.8;
const SURVIVAL_TIE_WINDOW = 42;
const MINIMUM_LENGTH = 0.0001;

interface Direction {
    x: number;
    y: number;
}

interface CandidateEvaluation {
    heading: number;
    survival: number;
    tactical: number;
}

export class CursorSpaceAutopilot {
    private elapsed = 0;
    private heading = 0;
    private orbitSide: -1 | 1 = 1;
    private initialized = false;

    reset(): void {
        this.elapsed = 0;
        this.heading = 0;
        this.orbitSide = 1;
        this.initialized = false;
    }

    update(model: CursorSpaceModel, deltaTime: number): void {
        const dt = Math.max(0, Math.min(0.05, deltaTime));
        const player = model.player;
        if (dt === 0) {
            return;
        }
        if (!player.alive) {
            model.clearTarget();
            this.initialized = false;
            return;
        }

        this.elapsed += dt;
        if (!this.initialized) {
            const speed = Math.hypot(player.velocity.x, player.velocity.y);
            this.heading = speed > 8
                ? Math.atan2(player.velocity.y, player.velocity.x)
                : this.initialHeading(model.currentBounds, player.position.x, player.position.y);
            this.initialized = true;
        }

        if (Math.floor((this.elapsed - dt) / 8.5) !== Math.floor(this.elapsed / 8.5)) {
            this.orbitSide = this.orbitSide === 1 ? -1 : 1;
        }

        const danger = this.immediateDanger(model);
        const boundaryDanger = this.boundaryDanger(model);
        const activeEnemies = this.activeEnemyCount(model);
        const hullRatio = player.maximumHealth > 0
            ? player.health / player.maximumHealth
            : 0;
        let throttle = 0.3
            + Math.min(0.16, activeEnemies * 0.009)
            + danger * 0.7;
        if (hullRatio < 0.5) {
            throttle += 0.08;
        }
        if (boundaryDanger > 0.35) {
            throttle *= 1 - boundaryDanger * 0.42;
        }
        throttle = this.clamp(throttle, 0.28, 1);

        const preferred = this.preferredEngagementDirection(model);
        let best: CandidateEvaluation | null = null;

        for (let index = 0; index < CANDIDATE_COUNT; index += 1) {
            const angle = Math.PI * 2 * index / CANDIDATE_COUNT;
            const directionX = Math.cos(angle);
            const directionY = Math.sin(angle);
            const candidate = this.evaluateDirection(
                model,
                angle,
                directionX,
                directionY,
                preferred,
                throttle,
            );
            if (!best || this.isBetterCandidate(candidate, best)) {
                best = candidate;
            }
        }

        const bestHeading = best?.heading ?? this.heading;
        const turnRate = NORMAL_TURN_RATE
            + (EMERGENCY_TURN_RATE - NORMAL_TURN_RATE) * danger;
        const difference = this.wrapAngle(bestHeading - this.heading);
        const maximumTurn = turnRate * dt;
        this.heading = this.wrapAngle(
            this.heading + this.clamp(difference, -maximumTurn, maximumTurn),
        );

        const bounds = model.currentBounds;
        const insetX = Math.min(18, Math.max(0.5, (bounds.right - bounds.left) * 0.5 - 0.5));
        const insetY = Math.min(18, Math.max(0.5, (bounds.top - bounds.bottom) * 0.5 - 0.5));
        const targetX = this.clamp(
            player.position.x + Math.cos(this.heading) * LOOK_AHEAD_DISTANCE,
            bounds.left + insetX,
            bounds.right - insetX,
        );
        const targetY = this.clamp(
            player.position.y + Math.sin(this.heading) * LOOK_AHEAD_DISTANCE,
            bounds.bottom + insetY,
            bounds.top - insetY,
        );
        model.setTarget(targetX, targetY, throttle);
    }

    private evaluateDirection(
        model: CursorSpaceModel,
        heading: number,
        directionX: number,
        directionY: number,
        preferred: Direction,
        throttle: number,
    ): CandidateEvaluation {
        const player = model.player;
        const predictedSpeed = PLAYER_MAXIMUM_SPEED * throttle;
        const candidateVelocityX = directionX * predictedSpeed;
        const candidateVelocityY = directionY * predictedSpeed;
        const candidateX = player.position.x + directionX * LOOK_AHEAD_DISTANCE;
        const candidateY = player.position.y + directionY * LOOK_AHEAD_DISTANCE;
        let survival = this.boundarySurvival(
            model.currentBounds,
            candidateX,
            candidateY,
        );

        for (const enemy of model.enemies) {
            if (!enemy.active) {
                continue;
            }
            survival += this.enemySurvivalScore(
                player.position.x,
                player.position.y,
                candidateVelocityX,
                candidateVelocityY,
                enemy,
            );
        }

        for (const projectile of model.projectiles) {
            if (!projectile.active || projectile.owner !== 'enemy') {
                continue;
            }
            survival += this.projectileSurvivalScore(
                player.position.x,
                player.position.y,
                candidateVelocityX,
                candidateVelocityY,
                projectile,
            );
        }

        let tactical = (directionX * preferred.x + directionY * preferred.y) * 30;
        const playerSpeed = Math.hypot(player.velocity.x, player.velocity.y);
        if (playerSpeed > 12) {
            tactical += (
                directionX * player.velocity.x / playerSpeed
                + directionY * player.velocity.y / playerSpeed
            ) * 12;
        }
        tactical += Math.cos(this.wrapAngle(heading - this.heading)) * 9;
        tactical += Math.sin(this.elapsed * 0.61 + directionX * 2.1 + directionY * 2.7) * 1.2;

        return { heading, survival, tactical };
    }

    private isBetterCandidate(
        candidate: Readonly<CandidateEvaluation>,
        current: Readonly<CandidateEvaluation>,
    ): boolean {
        const survivalDifference = candidate.survival - current.survival;
        if (Math.abs(survivalDifference) > SURVIVAL_TIE_WINDOW) {
            return survivalDifference > 0;
        }
        return candidate.tactical > current.tactical;
    }

    private boundarySurvival(
        bounds: Readonly<CursorSpaceBounds>,
        x: number,
        y: number,
    ): number {
        const left = x - bounds.left;
        const right = bounds.right - x;
        const bottom = y - bounds.bottom;
        const top = bounds.top - y;
        const clearance = Math.min(left, right, bottom, top);

        if (clearance <= 0) {
            return -24_000 - Math.abs(clearance) * 120;
        }
        if (clearance < BOUNDARY_MARGIN) {
            const pressure = 1 - clearance / BOUNDARY_MARGIN;
            return -4_800 * pressure * pressure * pressure;
        }
        return Math.min(36, clearance * 0.08);
    }

    private enemySurvivalScore(
        playerX: number,
        playerY: number,
        candidateVelocityX: number,
        candidateVelocityY: number,
        enemy: Readonly<CursorSpaceEnemy>,
    ): number {
        const relativeX = enemy.position.x - playerX;
        const relativeY = enemy.position.y - playerY;
        const relativeVelocityX = enemy.velocity.x - candidateVelocityX;
        const relativeVelocityY = enemy.velocity.y - candidateVelocityY;
        const closest = this.closestApproach(
            relativeX,
            relativeY,
            relativeVelocityX,
            relativeVelocityY,
            ENEMY_HORIZON,
        );
        const collisionRadius = PLAYER_RADIUS + enemy.radius;
        const safetyRadius = collisionRadius + ENEMY_SAFETY_PADDING;

        if (closest.distance <= collisionRadius) {
            const penetration = 1 - closest.distance / Math.max(1, collisionRadius);
            return -18_000 - penetration * 8_000;
        }
        if (closest.distance >= safetyRadius) {
            return 0;
        }

        const pressure = 1 - (closest.distance - collisionRadius)
            / (safetyRadius - collisionRadius);
        const urgency = 1 - closest.time / ENEMY_HORIZON;
        return -(
            pressure * pressure * 4_000
            + pressure * urgency * 1_650
        );
    }

    private projectileSurvivalScore(
        playerX: number,
        playerY: number,
        candidateVelocityX: number,
        candidateVelocityY: number,
        projectile: Readonly<CursorSpaceProjectile>,
    ): number {
        const relativeX = projectile.position.x - playerX;
        const relativeY = projectile.position.y - playerY;
        const relativeVelocityX = projectile.velocity.x - candidateVelocityX;
        const relativeVelocityY = projectile.velocity.y - candidateVelocityY;
        const closest = this.closestApproach(
            relativeX,
            relativeY,
            relativeVelocityX,
            relativeVelocityY,
            PROJECTILE_HORIZON,
        );
        const collisionRadius = PLAYER_RADIUS + projectile.radius;
        const safetyRadius = collisionRadius + PROJECTILE_SAFETY_PADDING;

        if (closest.distance <= collisionRadius) {
            const penetration = 1 - closest.distance / Math.max(1, collisionRadius);
            return -28_000 - penetration * 12_000;
        }
        if (closest.distance >= safetyRadius) {
            return 0;
        }

        const pressure = 1 - (closest.distance - collisionRadius)
            / (safetyRadius - collisionRadius);
        const urgency = 1 - closest.time / PROJECTILE_HORIZON;
        return -(
            pressure * pressure * 7_800
            + pressure * urgency * 3_600
        );
    }

    private immediateDanger(model: CursorSpaceModel): number {
        const player = model.player;
        let danger = this.boundaryDanger(model) * 0.65;

        for (const enemy of model.enemies) {
            if (!enemy.active) {
                continue;
            }
            const distance = Math.hypot(
                enemy.position.x - player.position.x,
                enemy.position.y - player.position.y,
            );
            danger = Math.max(danger, this.clamp(1 - distance / 138, 0, 1));
        }

        for (const projectile of model.projectiles) {
            if (!projectile.active || projectile.owner !== 'enemy') {
                continue;
            }
            const closest = this.closestApproach(
                projectile.position.x - player.position.x,
                projectile.position.y - player.position.y,
                projectile.velocity.x - player.velocity.x,
                projectile.velocity.y - player.velocity.y,
                0.78,
            );
            danger = Math.max(danger, this.clamp(1 - closest.distance / 90, 0, 1));
        }

        return danger;
    }

    private boundaryDanger(model: CursorSpaceModel): number {
        const player = model.player;
        const left = player.position.x - model.currentBounds.left;
        const right = model.currentBounds.right - player.position.x;
        const bottom = player.position.y - model.currentBounds.bottom;
        const top = model.currentBounds.top - player.position.y;
        const clearance = Math.min(left, right, bottom, top);
        return this.clamp(1 - clearance / 92, 0, 1);
    }

    private preferredEngagementDirection(model: CursorSpaceModel): Direction {
        const player = model.player;
        let nearest: CursorSpaceEnemy | null = null;
        let nearestDistanceSquared = Number.POSITIVE_INFINITY;

        for (const enemy of model.enemies) {
            if (!enemy.active) {
                continue;
            }
            const dx = player.position.x - enemy.position.x;
            const dy = player.position.y - enemy.position.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared < nearestDistanceSquared) {
                nearest = enemy;
                nearestDistanceSquared = distanceSquared;
            }
        }

        if (!nearest) {
            const centerX = (model.currentBounds.left + model.currentBounds.right) / 2;
            const centerY = (model.currentBounds.bottom + model.currentBounds.top) / 2;
            return this.normalized(
                centerX - player.position.x + Math.cos(this.elapsed * 0.41) * 54,
                centerY - player.position.y + Math.sin(this.elapsed * 0.34) * 54,
            );
        }

        const distance = Math.sqrt(Math.max(MINIMUM_LENGTH, nearestDistanceSquared));
        const radialX = (player.position.x - nearest.position.x) / distance;
        const radialY = (player.position.y - nearest.position.y) / distance;
        const tangentX = -radialY * this.orbitSide;
        const tangentY = radialX * this.orbitSide;
        const hullRatio = player.maximumHealth > 0
            ? player.health / player.maximumHealth
            : 0;
        const desiredRadius = ENGAGEMENT_RADIUS + (1 - hullRatio) * 90;
        const radialWeight = this.clamp(
            (desiredRadius - distance) / desiredRadius,
            -0.45,
            1.45,
        );

        return this.normalized(
            tangentX * 0.62 + radialX * radialWeight,
            tangentY * 0.62 + radialY * radialWeight,
        );
    }

    private activeEnemyCount(model: CursorSpaceModel): number {
        let count = 0;
        for (const enemy of model.enemies) {
            if (enemy.active) {
                count += 1;
            }
        }
        return count;
    }

    private closestApproach(
        relativeX: number,
        relativeY: number,
        relativeVelocityX: number,
        relativeVelocityY: number,
        horizon: number,
    ): { distance: number; time: number } {
        const speedSquared = relativeVelocityX * relativeVelocityX
            + relativeVelocityY * relativeVelocityY;
        const time = speedSquared > MINIMUM_LENGTH
            ? this.clamp(
                -(relativeX * relativeVelocityX + relativeY * relativeVelocityY)
                    / speedSquared,
                0,
                horizon,
            )
            : 0;
        const closestX = relativeX + relativeVelocityX * time;
        const closestY = relativeY + relativeVelocityY * time;
        return {
            distance: Math.hypot(closestX, closestY),
            time,
        };
    }

    private initialHeading(bounds: Readonly<CursorSpaceBounds>, x: number, y: number): number {
        const centerX = (bounds.left + bounds.right) / 2;
        const centerY = (bounds.bottom + bounds.top) / 2;
        const angleToCenter = Math.atan2(centerY - y, centerX - x);
        return this.wrapAngle(angleToCenter + Math.PI * 0.5);
    }

    private normalized(x: number, y: number): Direction {
        const length = Math.hypot(x, y);
        if (length < MINIMUM_LENGTH) {
            return { x: Math.cos(this.heading), y: Math.sin(this.heading) };
        }
        return { x: x / length, y: y / length };
    }

    private wrapAngle(value: number): number {
        let angle = value;
        while (angle > Math.PI) {
            angle -= Math.PI * 2;
        }
        while (angle < -Math.PI) {
            angle += Math.PI * 2;
        }
        return angle;
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
