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
 * Public model facade.
 *
 * The combat core owns spawning, collisions, firing and progression. This
 * facade adds two player-facing rules without exposing core internals:
 * - every player kill restores one life, capped at three;
 * - enemies perform an early, visible lateral dodge before the core step.
 */
export class CursorSpaceModel {
    readonly player: CursorSpacePlayer;
    readonly stats: CursorSpaceStats;
    readonly enemies: CursorSpaceEnemy[];
    readonly projectiles: CursorSpaceProjectile[];
    readonly effects: CursorSpaceEffect[];

    private readonly core: CursorSpaceCombatModel;

    constructor(config: CursorSpaceConfig = cursorSpaceConfig) {
        this.core = new CursorSpaceCombatModel(config);
        this.player = this.core.player;
        this.stats = this.core.stats;
        this.enemies = this.core.enemies;
        this.projectiles = this.core.projectiles;
        this.effects = this.core.effects;
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
    }

    step(deltaTime: number): void {
        const dt = Math.max(0, Math.min(0.05, deltaTime));
        if (dt === 0) {
            return;
        }

        if (this.player.alive) {
            this.applyVisibleEnemyDodges(dt);
        }

        const previousPlayerKills = this.stats.enemiesDestroyedByPlayer;
        this.core.step(dt);
        const restoredLives = this.stats.enemiesDestroyedByPlayer - previousPlayerKills;

        if (this.player.alive && restoredLives > 0) {
            this.player.health = Math.min(
                this.player.maximumHealth,
                this.player.health + restoredLives,
            );
        }
    }

    private applyVisibleEnemyDodges(dt: number): void {
        const bounds = this.currentBounds;

        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
            const enemy = this.enemies[enemyIndex];
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

            const lateralStep = enemy.movementSpeed
                * (0.72 + bestThreat * 1.05)
                * dt;
            enemy.position.x = this.clamp(
                enemy.position.x + dodgeX * lateralStep,
                bounds.left + enemy.radius,
                bounds.right - enemy.radius,
            );
            enemy.position.y = this.clamp(
                enemy.position.y + dodgeY * lateralStep,
                bounds.bottom + enemy.radius,
                bounds.top - enemy.radius,
            );

            const burstSpeed = enemy.movementSpeed * (1 + bestThreat * 0.42);
            enemy.velocity.x = Math.cos(enemy.rotation) * burstSpeed;
            enemy.velocity.y = Math.sin(enemy.rotation) * burstSpeed;
        }
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
