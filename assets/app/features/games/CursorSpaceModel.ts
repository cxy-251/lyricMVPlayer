import { cursorSpaceEscortWorldPosition } from './CursorSpaceFormation';
import { CursorSpaceModel as CursorSpaceCombatModel } from './CursorSpaceCombatModel';
import {
    cursorSpaceConfig,
    type CursorSpaceBounds,
    type CursorSpaceConfig,
    type CursorSpaceEffect,
    type CursorSpaceEnemy,
    type CursorSpacePlayer,
    type CursorSpaceProjectile,
    type CursorSpaceStats,
} from './CursorSpaceTypes';

const MINIMUM_VECTOR_LENGTH = 0.0001;
const DODGE_HORIZON = 1.45;
const DODGE_PADDING = 92;
const DODGE_TRIGGER = 0.035;
const DODGE_FIRE_DELAY = 0.28;

/**
 * Public gameplay model.
 *
 * The combat core owns spawning, collisions, firing and progression. This
 * facade enforces the player-facing combat rules:
 * - every enemy is destroyed by one projectile hit;
 * - the player body has one life and up to two escorts absorb body-bound shots;
 * - player kills replenish missing escorts;
 * - enemy dodges change heading only and never change movement speed.
 */
export class CursorSpaceModel {
    readonly player: CursorSpacePlayer;
    readonly stats: CursorSpaceStats;
    readonly enemies: CursorSpaceEnemy[];
    readonly projectiles: CursorSpaceProjectile[];
    readonly effects: CursorSpaceEffect[];

    private readonly core: CursorSpaceCombatModel;
    private readonly config: CursorSpaceConfig;

    constructor(config: CursorSpaceConfig = cursorSpaceConfig) {
        this.config = config;
        this.core = new CursorSpaceCombatModel({
            ...config,
            playerMaximumHealth: 1,
            playerCollisionDamage: 1,
            playerHitInvulnerabilityDuration: 0,
            enemyHealthTiers: [1, 1, 1],
            enemyProjectileDamage: 1,
            enemyTierThreeProjectileDamage: 1,
            // Escort restoration is handled here for every level.
            escortUnlockLevel: Number.MAX_SAFE_INTEGER,
        });
        this.player = this.core.player;
        this.stats = this.core.stats;
        this.enemies = this.core.enemies;
        this.projectiles = this.core.projectiles;
        this.effects = this.core.effects;
        this.refillEscortLives();
        this.normalizeOneHitEnemies();
    }

    get currentBounds(): Readonly<CursorSpaceBounds> {
        return this.core.currentBounds;
    }

    setBounds(bounds: CursorSpaceBounds): void {
        this.core.setBounds(bounds);
    }

    setTarget(x: number, y: number, throttle?: number): void {
        this.core.setTarget(x, y, throttle);
    }

    clearTarget(): void {
        this.core.clearTarget();
    }

    reset(): void {
        this.core.reset();
        this.refillEscortLives();
        this.normalizeOneHitEnemies();
    }

    step(deltaTime: number): void {
        const dt = Math.max(0, Math.min(0.05, deltaTime));
        if (dt === 0) {
            return;
        }

        const wasAlive = this.player.alive;
        const previousPlayerKills = this.stats.enemiesDestroyedByPlayer;

        this.normalizeOneHitEnemies();
        if (this.player.alive) {
            this.applyVisibleEnemyDodges(dt);
            this.interceptBodyBoundShots(dt);
        }

        this.core.step(dt);
        this.normalizeOneHitEnemies();

        if (!wasAlive && this.player.alive) {
            this.refillEscortLives();
        }

        const newPlayerKills = this.stats.enemiesDestroyedByPlayer - previousPlayerKills;
        if (this.player.alive && newPlayerKills > 0) {
            this.restoreEscortLives(newPlayerKills);
        }

        this.player.maximumHealth = 1;
        if (this.player.alive) {
            this.player.health = 1;
        }
    }

    private normalizeOneHitEnemies(): void {
        for (const enemy of this.enemies) {
            if (!enemy.active) {
                continue;
            }
            enemy.maximumHealth = 1;
            enemy.health = 1;
        }
    }

    private refillEscortLives(): void {
        this.player.maximumHealth = 1;
        this.player.health = this.player.alive ? 1 : 0;
        this.player.escortCount = this.config.escortCapacity;
        this.player.escortSide = 1;
        this.player.fireSupportLevel = 0;
    }

    private restoreEscortLives(kills: number): void {
        for (let index = 0; index < kills; index += 1) {
            if (this.player.escortCount < this.config.escortCapacity) {
                if (this.player.escortCount === 0) {
                    this.player.escortSide = this.stats.enemiesDestroyedByPlayer % 2 === 0 ? -1 : 1;
                }
                this.player.escortCount += 1;
                continue;
            }

            this.player.fireSupportLevel = Math.min(
                this.config.fireSupportCapacity,
                this.player.fireSupportLevel + 1,
            );
        }
    }

    private interceptBodyBoundShots(dt: number): void {
        if (
            !this.player.alive
            || this.player.escortCount <= 0
            || this.player.invulnerableRemaining > 0
        ) {
            return;
        }

        const predictedPlayerX = this.player.position.x + this.player.velocity.x * dt;
        const predictedPlayerY = this.player.position.y + this.player.velocity.y * dt;

        for (const projectile of this.projectiles) {
            if (
                this.player.escortCount <= 0
                || !projectile.active
                || projectile.owner !== 'enemy'
            ) {
                continue;
            }

            const nextX = projectile.position.x + projectile.velocity.x * dt;
            const nextY = projectile.position.y + projectile.velocity.y * dt;
            const hitRadius = this.config.playerRadius + projectile.radius;
            const distanceSquared = this.pointToSegmentDistanceSquared(
                predictedPlayerX,
                predictedPlayerY,
                projectile.position.x,
                projectile.position.y,
                nextX,
                nextY,
            );

            if (distanceSquared > hitRadius * hitRadius) {
                continue;
            }

            projectile.active = false;
            this.consumeEscortLife(projectile.position.x, projectile.position.y);
        }
    }

    private consumeEscortLife(impactX: number, impactY: number): void {
        if (this.player.escortCount <= 0) {
            return;
        }

        let escortIndex = 0;
        if (this.player.escortCount === 2) {
            const lateralX = -Math.sin(this.player.rotation);
            const lateralY = Math.cos(this.player.rotation);
            const lateralPosition = (impactX - this.player.position.x) * lateralX
                + (impactY - this.player.position.y) * lateralY;
            escortIndex = lateralPosition >= 0 ? 1 : 0;
        }

        const escortPosition = cursorSpaceEscortWorldPosition(this.player, escortIndex);
        if (this.player.escortCount === 2) {
            this.player.escortSide = escortIndex === 0 ? 1 : -1;
            this.player.escortCount = 1;
        } else {
            this.player.escortCount = 0;
        }
        this.spawnEscortBurst(escortPosition.x, escortPosition.y);
    }

    private spawnEscortBurst(x: number, y: number): void {
        const ring = this.effects.find((effect) => !effect.active);
        if (ring) {
            ring.active = true;
            ring.kind = 'ring';
            ring.position.x = x;
            ring.position.y = y;
            ring.velocity.x = 0;
            ring.velocity.y = 0;
            ring.life = 0.3;
            ring.initialLife = ring.life;
            ring.radius = 4;
        }

        for (let index = 0; index < 6; index += 1) {
            const fragment = this.effects.find((effect) => !effect.active);
            if (!fragment) {
                return;
            }
            const angle = Math.PI * 2 * index / 6;
            fragment.active = true;
            fragment.kind = 'fragment';
            fragment.position.x = x;
            fragment.position.y = y;
            fragment.velocity.x = Math.cos(angle) * 120;
            fragment.velocity.y = Math.sin(angle) * 120;
            fragment.life = 0.3;
            fragment.initialLife = fragment.life;
            fragment.radius = 3.4;
        }
    }

    private applyVisibleEnemyDodges(dt: number): void {
        const bounds = this.currentBounds;

        for (const enemy of this.enemies) {
            if (!enemy.active || !this.isInsidePlayArea(enemy, bounds)) {
                continue;
            }

            let bestThreat = 0;
            let dodgeX = 0;
            let dodgeY = 0;
            let dodgeSide: -1 | 1 = enemy.dodgeSide;

            for (const projectile of this.projectiles) {
                if (!projectile.active || projectile.owner !== 'player') {
                    continue;
                }

                const relativeX = projectile.position.x - enemy.position.x;
                const relativeY = projectile.position.y - enemy.position.y;
                const relativeVelocityX = projectile.velocity.x - enemy.velocity.x;
                const relativeVelocityY = projectile.velocity.y - enemy.velocity.y;
                const speedSquared = relativeVelocityX * relativeVelocityX
                    + relativeVelocityY * relativeVelocityY;
                if (speedSquared < 1) {
                    continue;
                }

                const approach = relativeX * relativeVelocityX
                    + relativeY * relativeVelocityY;
                if (approach >= 0) {
                    continue;
                }

                const time = this.clamp(-approach / speedSquared, 0, DODGE_HORIZON);
                const closestX = relativeX + relativeVelocityX * time;
                const closestY = relativeY + relativeVelocityY * time;
                const closestDistance = Math.hypot(closestX, closestY);
                const dangerRadius = enemy.radius
                    + projectile.radius
                    + DODGE_PADDING
                    + enemy.speedTier * 8;
                if (closestDistance >= dangerRadius) {
                    continue;
                }

                const pressure = (1 - closestDistance / dangerRadius)
                    * (1 - time / DODGE_HORIZON * 0.28);
                if (pressure <= bestThreat) {
                    continue;
                }

                const relativeSpeed = Math.sqrt(speedSquared);
                const projectileDirectionX = relativeVelocityX / relativeSpeed;
                const projectileDirectionY = relativeVelocityY / relativeSpeed;
                const normalX = -projectileDirectionY;
                const normalY = projectileDirectionX;
                const toEnemyX = enemy.position.x - projectile.position.x;
                const toEnemyY = enemy.position.y - projectile.position.y;
                const signedSide = toEnemyX * normalX + toEnemyY * normalY;
                const side = Math.sign(signedSide) || enemy.dodgeSide;

                bestThreat = pressure;
                dodgeSide = side > 0 ? 1 : -1;
                dodgeX = normalX * dodgeSide;
                dodgeY = normalY * dodgeSide;
            }

            if (bestThreat <= DODGE_TRIGGER) {
                continue;
            }

            enemy.dodgeSide = dodgeSide;
            enemy.fireRemaining = Math.max(
                enemy.fireRemaining,
                DODGE_FIRE_DELAY + bestThreat * 0.22,
            );
            enemy.burstRemaining = 0;
            enemy.threat = Math.max(enemy.threat, bestThreat);

            const forwardX = Math.cos(enemy.rotation);
            const forwardY = Math.sin(enemy.rotation);
            const desired = this.normalized(
                dodgeX * (1.55 + bestThreat * 0.9) + forwardX * 0.22,
                dodgeY * (1.55 + bestThreat * 0.9) + forwardY * 0.22,
                enemy.rotation,
            );
            const desiredRotation = Math.atan2(desired.y, desired.x);
            const maximumTurn = (
                enemy.turnRate * (3.2 + bestThreat * 3.4) + 1.8
            ) * dt;
            const rotationDifference = this.wrapAngle(desiredRotation - enemy.rotation);
            enemy.rotation = this.wrapAngle(
                enemy.rotation
                    + this.clamp(rotationDifference, -maximumTurn, maximumTurn),
            );

            // Enemy aircraft may turn quickly, but their scalar speed never changes.
            enemy.velocity.x = Math.cos(enemy.rotation) * enemy.movementSpeed;
            enemy.velocity.y = Math.sin(enemy.rotation) * enemy.movementSpeed;
        }
    }

    private pointToSegmentDistanceSquared(
        pointX: number,
        pointY: number,
        startX: number,
        startY: number,
        endX: number,
        endY: number,
    ): number {
        const segmentX = endX - startX;
        const segmentY = endY - startY;
        const lengthSquared = segmentX * segmentX + segmentY * segmentY;
        if (lengthSquared < MINIMUM_VECTOR_LENGTH) {
            return (pointX - startX) ** 2 + (pointY - startY) ** 2;
        }

        const projection = this.clamp(
            ((pointX - startX) * segmentX + (pointY - startY) * segmentY)
                / lengthSquared,
            0,
            1,
        );
        const closestX = startX + segmentX * projection;
        const closestY = startY + segmentY * projection;
        return (pointX - closestX) ** 2 + (pointY - closestY) ** 2;
    }

    private isInsidePlayArea(
        enemy: Readonly<CursorSpaceEnemy>,
        bounds: Readonly<CursorSpaceBounds>,
    ): boolean {
        return enemy.position.x >= bounds.left
            && enemy.position.x <= bounds.right
            && enemy.position.y >= bounds.bottom
            && enemy.position.y <= bounds.top;
    }

    private normalized(
        x: number,
        y: number,
        fallbackRotation: number,
    ): { x: number; y: number } {
        const length = Math.hypot(x, y);
        if (length < MINIMUM_VECTOR_LENGTH) {
            return {
                x: Math.cos(fallbackRotation),
                y: Math.sin(fallbackRotation),
            };
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
