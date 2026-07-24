import type { CursorSpaceModel } from './CursorSpaceModel';
import type {
    CursorSpaceBounds,
    CursorSpaceEnemy,
    CursorSpaceProjectile,
} from './CursorSpaceTypes';

const CANDIDATE_COUNT = 24;
const LOOK_AHEAD_DISTANCE = 148;
const PLAYER_PREDICTED_SPEED = 360;
const ENEMY_HORIZON = 0.62;
const PROJECTILE_HORIZON = 0.78;
const ENEMY_SAFETY_PADDING = 54;
const PROJECTILE_SAFETY_RADIUS = 76;
const BOUNDARY_MARGIN = 82;
const ENGAGEMENT_RADIUS = 178;
const MAXIMUM_TURN_RATE = 3.4;
const MINIMUM_LENGTH = 0.0001;

interface Direction {
    x: number;
    y: number;
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
        if (dt === 0 || !player.alive) {
            model.clearTarget();
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

        if (Math.floor((this.elapsed - dt) / 7.5) !== Math.floor(this.elapsed / 7.5)) {
            this.orbitSide = this.orbitSide === 1 ? -1 : 1;
        }

        const preferred = this.preferredEngagementDirection(model);
        let bestHeading = this.heading;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (let index = 0; index < CANDIDATE_COUNT; index += 1) {
            const angle = Math.PI * 2 * index / CANDIDATE_COUNT;
            const directionX = Math.cos(angle);
            const directionY = Math.sin(angle);
            const score = this.scoreDirection(model, directionX, directionY, preferred);
            if (score > bestScore) {
                bestScore = score;
                bestHeading = angle;
            }
        }

        const difference = this.wrapAngle(bestHeading - this.heading);
        const maximumTurn = MAXIMUM_TURN_RATE * dt;
        this.heading = this.wrapAngle(
            this.heading + this.clamp(difference, -maximumTurn, maximumTurn),
        );

        const bounds = model.currentBounds;
        const inset = 18;
        const targetX = this.clamp(
            player.position.x + Math.cos(this.heading) * LOOK_AHEAD_DISTANCE,
            bounds.left + inset,
            bounds.right - inset,
        );
        const targetY = this.clamp(
            player.position.y + Math.sin(this.heading) * LOOK_AHEAD_DISTANCE,
            bounds.bottom + inset,
            bounds.top - inset,
        );
        model.setTarget(targetX, targetY);
    }

    private scoreDirection(
        model: CursorSpaceModel,
        directionX: number,
        directionY: number,
        preferred: Direction,
    ): number {
        const player = model.player;
        const candidateVelocityX = directionX * PLAYER_PREDICTED_SPEED;
        const candidateVelocityY = directionY * PLAYER_PREDICTED_SPEED;
        const candidateX = player.position.x + directionX * LOOK_AHEAD_DISTANCE;
        const candidateY = player.position.y + directionY * LOOK_AHEAD_DISTANCE;
        let score = 0;

        score += (directionX * preferred.x + directionY * preferred.y) * 52;

        const playerSpeed = Math.hypot(player.velocity.x, player.velocity.y);
        if (playerSpeed > 12) {
            score += (
                directionX * player.velocity.x / playerSpeed
                + directionY * player.velocity.y / playerSpeed
            ) * 26;
        }

        score += this.boundaryScore(model.currentBounds, candidateX, candidateY);

        for (const enemy of model.enemies) {
            if (!enemy.active) {
                continue;
            }
            score += this.enemyThreatScore(
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
            score += this.projectileThreatScore(
                player.position.x,
                player.position.y,
                candidateVelocityX,
                candidateVelocityY,
                projectile,
            );
        }

        score += Math.sin(this.elapsed * 0.72 + directionX * 2.3 + directionY * 3.1) * 1.8;
        return score;
    }

    private boundaryScore(bounds: Readonly<CursorSpaceBounds>, x: number, y: number): number {
        const left = x - bounds.left;
        const right = bounds.right - x;
        const bottom = y - bounds.bottom;
        const top = bounds.top - y;
        const clearance = Math.min(left, right, bottom, top);

        if (clearance <= 0) {
            return -1000 - Math.abs(clearance) * 12;
        }
        if (clearance < BOUNDARY_MARGIN) {
            const pressure = 1 - clearance / BOUNDARY_MARGIN;
            return -240 * pressure * pressure;
        }
        return Math.min(18, clearance * 0.045);
    }

    private enemyThreatScore(
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
        const safetyRadius = enemy.radius + ENEMY_SAFETY_PADDING;
        if (closest.distance >= safetyRadius) {
            return Math.min(8, closest.distance * 0.012);
        }

        const spatialThreat = 1 - closest.distance / safetyRadius;
        const temporalThreat = 1 - closest.time / ENEMY_HORIZON;
        return -(
            spatialThreat * spatialThreat * 310
            + temporalThreat * spatialThreat * 120
        );
    }

    private projectileThreatScore(
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
        const safetyRadius = PROJECTILE_SAFETY_RADIUS + projectile.radius;
        if (closest.distance >= safetyRadius) {
            return 0;
        }

        const spatialThreat = 1 - closest.distance / safetyRadius;
        const temporalThreat = 1 - closest.time / PROJECTILE_HORIZON;
        return -(
            spatialThreat * spatialThreat * 460
            + temporalThreat * spatialThreat * 210
        );
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
                centerX - player.position.x + Math.cos(this.elapsed * 0.43) * 60,
                centerY - player.position.y + Math.sin(this.elapsed * 0.37) * 60,
            );
        }

        const distance = Math.sqrt(Math.max(MINIMUM_LENGTH, nearestDistanceSquared));
        const radialX = (player.position.x - nearest.position.x) / distance;
        const radialY = (player.position.y - nearest.position.y) / distance;
        const tangentX = -radialY * this.orbitSide;
        const tangentY = radialX * this.orbitSide;
        const radialWeight = this.clamp(
            (ENGAGEMENT_RADIUS - distance) / ENGAGEMENT_RADIUS,
            -0.9,
            1.2,
        );

        return this.normalized(
            tangentX * 0.92 + radialX * radialWeight,
            tangentY * 0.92 + radialY * radialWeight,
        );
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
