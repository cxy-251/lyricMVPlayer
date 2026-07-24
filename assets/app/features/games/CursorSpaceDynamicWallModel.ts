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

const WALL_UNLOCK_LEVEL = 40;
const WALL_CHANGE_INTERVAL = 10;
const WALL_PROJECTILE_THICKNESS = 32;
const WALL_AIRCRAFT_CLEARANCE = 1.5;
const WALL_AI_CLEARANCE = 30;
const WALL_EFFECT_SPACING = 16;
const MAX_WALL_EFFECTS = 120;

export interface CursorSpaceWall {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

interface WallSample {
    readonly x: number;
    readonly y: number;
    readonly directionX: number;
    readonly directionY: number;
    readonly radius: number;
}

interface WallPush {
    readonly x: number;
    readonly y: number;
    readonly normalX: number;
    readonly normalY: number;
    readonly penetration: number;
}

interface SeededRandom {
    next(): number;
    range(minimum: number, maximum: number): number;
    integer(minimum: number, maximumInclusive: number): number;
}

/**
 * Public Cursor Space gameplay model.
 *
 * - player aircraft starts and respawns without escorts;
 * - every player kill restores one missing escort, capped at two;
 * - every enemy is destroyed by one player projectile;
 * - enemy dodges change heading only and preserve scalar speed;
 * - walls unlock at level 40 and deterministically change every ten levels.
 */
export class CursorSpaceModel {
    readonly player: CursorSpacePlayer;
    readonly stats: CursorSpaceStats;
    readonly enemies: CursorSpaceEnemy[];
    readonly projectiles: CursorSpaceProjectile[];
    readonly effects: CursorSpaceEffect[];
    readonly walls: CursorSpaceWall[] = [];

    private readonly core: CursorSpaceCombatModel;
    private readonly config: CursorSpaceConfig;
    private readonly previousEnemyX: number[];
    private readonly previousEnemyY: number[];
    private readonly wallSamples: WallSample[] = [];

    private previousPlayerX = 0;
    private previousPlayerY = 0;
    private wallEffectStart = 0;
    private wallEffectCount = 0;
    private wallPhase = -1;

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
            // Escort acquisition is handled here from the first player kill.
            escortUnlockLevel: Number.MAX_SAFE_INTEGER,
        });
        this.player = this.core.player;
        this.stats = this.core.stats;
        this.enemies = this.core.enemies;
        this.projectiles = this.core.projectiles;
        this.effects = this.core.effects;
        this.previousEnemyX = new Array<number>(this.enemies.length).fill(0);
        this.previousEnemyY = new Array<number>(this.enemies.length).fill(0);
        this.clearEscortLives();
        this.normalizeOneHitEnemies();
        this.captureAircraftPositions();
    }

    get currentBounds(): Readonly<CursorSpaceBounds> {
        return this.core.currentBounds;
    }

    get wallActive(): boolean {
        return this.walls.length > 0;
    }

    setBounds(bounds: CursorSpaceBounds): void {
        this.core.setBounds(bounds);
        const phase = this.wallPhaseForLevel(this.stats.level);
        if (phase >= 0) {
            this.rebuildWalls(phase);
            this.resolveAircraftWallCollisions();
            this.refreshWallEffects();
        }
    }

    setTarget(x: number, y: number, throttle?: number): void {
        if (throttle !== undefined && this.wallActive) {
            const target = this.routeAiTarget(x, y);
            this.core.setTarget(target.x, target.y, throttle);
            return;
        }
        this.core.setTarget(x, y, throttle);
    }

    clearTarget(): void {
        this.core.clearTarget();
    }

    reset(): void {
        this.releaseWallEffects();
        this.walls.length = 0;
        this.wallSamples.length = 0;
        this.wallPhase = -1;
        this.core.reset();
        this.clearEscortLives();
        this.normalizeOneHitEnemies();
        this.captureAircraftPositions();
    }

    step(deltaTime: number): void {
        const dt = Math.max(0, Math.min(0.05, deltaTime));
        if (dt === 0) {
            return;
        }

        const wasAlive = this.player.alive;
        const previousPlayerKills = this.stats.enemiesDestroyedByPlayer;

        this.normalizeOneHitEnemies();
        this.syncWallState();
        this.captureAircraftPositions();

        if (this.wallActive) {
            this.refreshWallEffects();
            this.blockProjectilesByWalls(dt, true);
        }

        if (this.player.alive) {
            this.applyVisibleEnemyDodges(dt);
            this.interceptBodyBoundShots(dt);
        }

        this.core.step(dt);
        this.normalizeOneHitEnemies();

        if (!wasAlive && this.player.alive) {
            this.clearEscortLives();
        }

        const newPlayerKills = this.stats.enemiesDestroyedByPlayer - previousPlayerKills;
        if (this.player.alive && newPlayerKills > 0) {
            this.restoreEscortLives(newPlayerKills);
        }

        this.syncWallState();
        if (this.wallActive) {
            this.resolveAircraftWallCollisions();
            this.blockProjectilesByWalls(0, false);
            this.refreshWallEffects();
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

    private clearEscortLives(): void {
        this.player.maximumHealth = 1;
        this.player.health = this.player.alive ? 1 : 0;
        this.player.escortCount = 0;
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
        if (!this.player.alive || this.player.escortCount <= 0) {
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
        const ring = this.findFreeNonWallEffect();
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
            const fragment = this.findFreeNonWallEffect();
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

    private findFreeNonWallEffect(): CursorSpaceEffect | null {
        const limit = this.wallEffectCount > 0 ? this.wallEffectStart : this.effects.length;
        for (let index = 0; index < limit; index += 1) {
            const effect = this.effects[index];
            if (!effect.active) {
                return effect;
            }
        }
        return null;
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

            enemy.velocity.x = Math.cos(enemy.rotation) * enemy.movementSpeed;
            enemy.velocity.y = Math.sin(enemy.rotation) * enemy.movementSpeed;
        }
    }

    private syncWallState(): void {
        const phase = this.wallPhaseForLevel(this.stats.level);
        if (phase < 0) {
            if (this.wallActive || this.wallEffectCount > 0) {
                this.releaseWallEffects();
                this.walls.length = 0;
                this.wallSamples.length = 0;
                this.wallPhase = -1;
            }
            return;
        }

        if (!this.wallActive || phase !== this.wallPhase) {
            this.rebuildWalls(phase);
        }
    }

    private wallPhaseForLevel(level: number): number {
        if (level < WALL_UNLOCK_LEVEL) {
            return -1;
        }
        return Math.floor(level / WALL_CHANGE_INTERVAL);
    }

    private rebuildWalls(phase: number): void {
        this.releaseWallEffects();
        this.walls.length = 0;
        this.wallSamples.length = 0;
        this.wallPhase = phase;

        const bounds = this.currentBounds;
        const arenaWidth = bounds.right - bounds.left;
        const arenaHeight = bounds.top - bounds.bottom;
        if (arenaWidth < 260 || arenaHeight < 190) {
            return;
        }

        const random = this.createRandom(phase * 0x9e3779b1);
        const centerX = (bounds.left + bounds.right) * 0.5;
        const centerY = (bounds.bottom + bounds.top) * 0.5;
        const thickness = this.clamp(
            Math.min(arenaWidth, arenaHeight) * random.range(0.045, 0.065),
            18,
            WALL_PROJECTILE_THICKNESS,
        );
        const offsetX = random.range(-arenaWidth * 0.08, arenaWidth * 0.08);
        const offsetY = random.range(-arenaHeight * 0.07, arenaHeight * 0.07);
        const layout = random.integer(0, 3);

        if (layout === 0) {
            this.buildGatedRing(
                centerX + offsetX,
                centerY + offsetY,
                arenaWidth,
                arenaHeight,
                thickness,
                random,
            );
        } else if (layout === 1) {
            this.buildStaggeredLanes(
                centerX,
                centerY,
                arenaWidth,
                arenaHeight,
                thickness,
                random,
            );
        } else if (layout === 2) {
            this.buildBrokenCross(
                centerX + offsetX * 0.55,
                centerY + offsetY * 0.55,
                arenaWidth,
                arenaHeight,
                thickness,
                random,
            );
        } else {
            this.buildTwinChambers(
                centerX,
                centerY,
                arenaWidth,
                arenaHeight,
                thickness,
                random,
            );
        }

        this.buildWallSamples();
        this.wallEffectCount = this.wallSamples.length;
        this.wallEffectStart = Math.max(0, this.effects.length - this.wallEffectCount);
        for (let index = this.wallEffectStart; index < this.effects.length; index += 1) {
            this.effects[index].active = false;
        }
    }

    private buildGatedRing(
        centerX: number,
        centerY: number,
        arenaWidth: number,
        arenaHeight: number,
        thickness: number,
        random: SeededRandom,
    ): void {
        const innerWidth = this.clamp(
            arenaWidth * random.range(0.5, 0.66),
            210,
            540,
        );
        const innerHeight = this.clamp(
            arenaHeight * random.range(0.44, 0.6),
            150,
            330,
        );
        const horizontalGate = this.clamp(innerWidth * random.range(0.18, 0.3), 66, 120);
        const verticalGate = this.clamp(innerHeight * random.range(0.22, 0.36), 58, 104);
        const horizontalLength = Math.max(24, (innerWidth - horizontalGate) * 0.5);
        const verticalLength = Math.max(24, (innerHeight - verticalGate) * 0.5);
        const left = centerX - innerWidth * 0.5;
        const right = centerX + innerWidth * 0.5;
        const bottom = centerY - innerHeight * 0.5;
        const top = centerY + innerHeight * 0.5;

        this.addWall(left, top - thickness * 0.5, horizontalLength, thickness);
        this.addWall(right - horizontalLength, top - thickness * 0.5, horizontalLength, thickness);
        this.addWall(left, bottom - thickness * 0.5, horizontalLength, thickness);
        this.addWall(right - horizontalLength, bottom - thickness * 0.5, horizontalLength, thickness);

        this.addWall(left - thickness * 0.5, bottom, thickness, verticalLength);
        this.addWall(left - thickness * 0.5, top - verticalLength, thickness, verticalLength);
        this.addWall(right - thickness * 0.5, bottom, thickness, verticalLength);
        this.addWall(right - thickness * 0.5, top - verticalLength, thickness, verticalLength);
    }

    private buildStaggeredLanes(
        centerX: number,
        centerY: number,
        arenaWidth: number,
        arenaHeight: number,
        thickness: number,
        random: SeededRandom,
    ): void {
        const laneHeight = arenaHeight * random.range(0.5, 0.68);
        const halfHeight = laneHeight * 0.5;
        const gap = this.clamp(arenaHeight * random.range(0.16, 0.24), 64, 116);
        const xSpread = arenaWidth * random.range(0.16, 0.24);
        const upperLength = Math.max(24, halfHeight - gap * 0.5);
        const lowerLength = Math.max(24, halfHeight - gap * 0.5);

        this.addWall(
            centerX - xSpread - thickness * 0.5,
            centerY - halfHeight,
            thickness,
            lowerLength,
        );
        this.addWall(
            centerX - xSpread - thickness * 0.5,
            centerY + gap * 0.5,
            thickness,
            upperLength,
        );
        this.addWall(
            centerX + xSpread - thickness * 0.5,
            centerY - halfHeight,
            thickness,
            upperLength,
        );
        this.addWall(
            centerX + xSpread - thickness * 0.5,
            centerY + gap * 0.5,
            thickness,
            lowerLength,
        );

        const bridgeWidth = arenaWidth * random.range(0.22, 0.34);
        const bridgeGap = this.clamp(bridgeWidth * random.range(0.22, 0.32), 58, 104);
        const bridgePart = Math.max(24, (bridgeWidth - bridgeGap) * 0.5);
        const bridgeY = centerY + random.range(-arenaHeight * 0.12, arenaHeight * 0.12);
        this.addWall(centerX - bridgeWidth * 0.5, bridgeY, bridgePart, thickness);
        this.addWall(centerX + bridgeGap * 0.5, bridgeY, bridgePart, thickness);
    }

    private buildBrokenCross(
        centerX: number,
        centerY: number,
        arenaWidth: number,
        arenaHeight: number,
        thickness: number,
        random: SeededRandom,
    ): void {
        const horizontalWidth = arenaWidth * random.range(0.52, 0.72);
        const verticalHeight = arenaHeight * random.range(0.48, 0.7);
        const horizontalGap = this.clamp(horizontalWidth * random.range(0.18, 0.28), 70, 124);
        const verticalGap = this.clamp(verticalHeight * random.range(0.2, 0.32), 62, 112);
        const horizontalPart = Math.max(24, (horizontalWidth - horizontalGap) * 0.5);
        const verticalPart = Math.max(24, (verticalHeight - verticalGap) * 0.5);

        this.addWall(
            centerX - horizontalWidth * 0.5,
            centerY - thickness * 0.5,
            horizontalPart,
            thickness,
        );
        this.addWall(
            centerX + horizontalGap * 0.5,
            centerY - thickness * 0.5,
            horizontalPart,
            thickness,
        );
        this.addWall(
            centerX - thickness * 0.5,
            centerY - verticalHeight * 0.5,
            thickness,
            verticalPart,
        );
        this.addWall(
            centerX - thickness * 0.5,
            centerY + verticalGap * 0.5,
            thickness,
            verticalPart,
        );
    }

    private buildTwinChambers(
        centerX: number,
        centerY: number,
        arenaWidth: number,
        arenaHeight: number,
        thickness: number,
        random: SeededRandom,
    ): void {
        const chamberWidth = arenaWidth * random.range(0.2, 0.28);
        const chamberHeight = arenaHeight * random.range(0.34, 0.48);
        const gap = arenaWidth * random.range(0.12, 0.2);
        const gate = this.clamp(chamberHeight * random.range(0.24, 0.36), 58, 100);
        const verticalPart = Math.max(22, (chamberHeight - gate) * 0.5);

        const leftCenter = centerX - gap * 0.5 - chamberWidth * 0.5;
        const rightCenter = centerX + gap * 0.5 + chamberWidth * 0.5;
        const bottom = centerY - chamberHeight * 0.5;
        const top = centerY + chamberHeight * 0.5;

        for (const chamberCenter of [leftCenter, rightCenter]) {
            const left = chamberCenter - chamberWidth * 0.5;
            const right = chamberCenter + chamberWidth * 0.5;
            this.addWall(left, bottom, chamberWidth, thickness);
            this.addWall(left, top - thickness, chamberWidth, thickness);
            this.addWall(left, bottom, thickness, verticalPart);
            this.addWall(left, top - verticalPart, thickness, verticalPart);
            this.addWall(right - thickness, bottom, thickness, verticalPart);
            this.addWall(right - thickness, top - verticalPart, thickness, verticalPart);
        }
    }

    private addWall(x: number, y: number, width: number, height: number): void {
        if (width <= 0 || height <= 0) {
            return;
        }
        this.walls.push({ x, y, width, height });
    }

    private buildWallSamples(): void {
        const radius = WALL_EFFECT_SPACING * 0.58;
        for (const wall of this.walls) {
            const horizontal = wall.width >= wall.height;
            const length = horizontal ? wall.width : wall.height;
            const rowOffset = (horizontal ? wall.height : wall.width) * 0.22;
            const count = Math.max(1, Math.ceil(length / WALL_EFFECT_SPACING));

            for (let row = -1; row <= 1; row += 2) {
                for (let index = 0; index < count; index += 1) {
                    if (this.wallSamples.length >= MAX_WALL_EFFECTS) {
                        return;
                    }
                    const progress = (index + 0.5) / count;
                    this.wallSamples.push({
                        x: horizontal
                            ? wall.x + progress * wall.width
                            : wall.x + wall.width * 0.5 + row * rowOffset,
                        y: horizontal
                            ? wall.y + wall.height * 0.5 + row * rowOffset
                            : wall.y + progress * wall.height,
                        directionX: horizontal ? 1 : 0,
                        directionY: horizontal ? 0 : 1,
                        radius,
                    });
                }
            }
        }
    }

    private refreshWallEffects(): void {
        if (!this.wallActive || this.wallEffectCount <= 0) {
            return;
        }

        for (let index = 0; index < this.wallEffectCount; index += 1) {
            const effect = this.effects[this.wallEffectStart + index];
            const sample = this.wallSamples[index];
            if (!effect || !sample) {
                continue;
            }
            effect.active = true;
            effect.kind = 'fragment';
            effect.position.x = sample.x;
            effect.position.y = sample.y;
            effect.velocity.x = sample.directionX;
            effect.velocity.y = sample.directionY;
            effect.life = 999;
            effect.initialLife = 999;
            effect.radius = sample.radius;
        }
    }

    private releaseWallEffects(): void {
        for (let index = 0; index < this.wallEffectCount; index += 1) {
            const effect = this.effects[this.wallEffectStart + index];
            if (effect) {
                effect.active = false;
            }
        }
        this.wallEffectStart = 0;
        this.wallEffectCount = 0;
    }

    private blockProjectilesByWalls(dt: number, predictMovement: boolean): void {
        if (!this.wallActive) {
            return;
        }

        for (const projectile of this.projectiles) {
            if (!projectile.active) {
                continue;
            }
            const nextX = predictMovement
                ? projectile.position.x + projectile.velocity.x * dt
                : projectile.position.x;
            const nextY = predictMovement
                ? projectile.position.y + projectile.velocity.y * dt
                : projectile.position.y;

            for (const wall of this.walls) {
                if (this.segmentIntersectsWall(
                    projectile.position.x,
                    projectile.position.y,
                    nextX,
                    nextY,
                    wall,
                    projectile.radius,
                )) {
                    projectile.active = false;
                    break;
                }
            }
        }
    }

    private captureAircraftPositions(): void {
        this.previousPlayerX = this.player.position.x;
        this.previousPlayerY = this.player.position.y;
        for (let index = 0; index < this.enemies.length; index += 1) {
            this.previousEnemyX[index] = this.enemies[index].position.x;
            this.previousEnemyY[index] = this.enemies[index].position.y;
        }
    }

    private resolveAircraftWallCollisions(): void {
        if (!this.wallActive) {
            return;
        }
        this.resolvePlayerWallCollision();
        this.resolveEnemyWallCollisions();
    }

    private resolvePlayerWallCollision(): void {
        if (!this.player.alive) {
            return;
        }

        let collided = false;
        for (let iteration = 0; iteration < 5; iteration += 1) {
            const push = this.deepestPlayerWallPush();
            if (!push) {
                break;
            }
            collided = true;
            this.player.position.x += push.x;
            this.player.position.y += push.y;
            this.removeVelocityIntoWall(this.player.velocity, push.normalX, push.normalY);
        }

        if (collided && this.playerTouchesWall()) {
            this.player.position.x = this.previousPlayerX;
            this.player.position.y = this.previousPlayerY;
            this.player.velocity.x = 0;
            this.player.velocity.y = 0;
        }
    }

    private deepestPlayerWallPush(): WallPush | null {
        let deepest: WallPush | null = null;
        const consider = (x: number, y: number, radius: number): void => {
            for (const wall of this.walls) {
                const push = this.circleWallPush(x, y, radius, wall);
                if (push && (!deepest || push.penetration > deepest.penetration)) {
                    deepest = push;
                }
            }
        };

        consider(this.player.position.x, this.player.position.y, this.config.playerRadius);
        for (let index = 0; index < this.player.escortCount; index += 1) {
            const escort = cursorSpaceEscortWorldPosition(this.player, index);
            consider(escort.x, escort.y, this.config.escortRadius);
        }
        return deepest;
    }

    private playerTouchesWall(): boolean {
        if (this.circleTouchesAnyWall(
            this.player.position.x,
            this.player.position.y,
            this.config.playerRadius,
        )) {
            return true;
        }
        for (let index = 0; index < this.player.escortCount; index += 1) {
            const escort = cursorSpaceEscortWorldPosition(this.player, index);
            if (this.circleTouchesAnyWall(escort.x, escort.y, this.config.escortRadius)) {
                return true;
            }
        }
        return false;
    }

    private resolveEnemyWallCollisions(): void {
        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
            const enemy = this.enemies[enemyIndex];
            if (!enemy.active) {
                continue;
            }

            let collided = false;
            for (let iteration = 0; iteration < 3; iteration += 1) {
                let deepest: WallPush | null = null;
                for (const wall of this.walls) {
                    const push = this.circleWallPush(
                        enemy.position.x,
                        enemy.position.y,
                        enemy.radius,
                        wall,
                    );
                    if (push && (!deepest || push.penetration > deepest.penetration)) {
                        deepest = push;
                    }
                }
                if (!deepest) {
                    break;
                }
                collided = true;
                enemy.position.x += deepest.x;
                enemy.position.y += deepest.y;
                this.reflectEnemyFromWall(enemy, deepest.normalX, deepest.normalY);
            }

            if (collided && this.circleTouchesAnyWall(
                enemy.position.x,
                enemy.position.y,
                enemy.radius,
            )) {
                enemy.position.x = this.previousEnemyX[enemyIndex];
                enemy.position.y = this.previousEnemyY[enemyIndex];
                enemy.rotation = this.wrapAngle(
                    enemy.rotation + enemy.dodgeSide * Math.PI * 0.5,
                );
                enemy.velocity.x = Math.cos(enemy.rotation) * enemy.movementSpeed;
                enemy.velocity.y = Math.sin(enemy.rotation) * enemy.movementSpeed;
            }
        }
    }

    private reflectEnemyFromWall(
        enemy: CursorSpaceEnemy,
        normalX: number,
        normalY: number,
    ): void {
        const velocityDot = enemy.velocity.x * normalX + enemy.velocity.y * normalY;
        if (velocityDot < 0) {
            enemy.velocity.x -= 2 * velocityDot * normalX;
            enemy.velocity.y -= 2 * velocityDot * normalY;
        } else {
            enemy.velocity.x = normalX * enemy.movementSpeed;
            enemy.velocity.y = normalY * enemy.movementSpeed;
        }
        const speed = Math.hypot(enemy.velocity.x, enemy.velocity.y);
        if (speed < MINIMUM_VECTOR_LENGTH) {
            enemy.velocity.x = normalX * enemy.movementSpeed;
            enemy.velocity.y = normalY * enemy.movementSpeed;
        } else {
            enemy.velocity.x = enemy.velocity.x / speed * enemy.movementSpeed;
            enemy.velocity.y = enemy.velocity.y / speed * enemy.movementSpeed;
        }
        enemy.rotation = Math.atan2(enemy.velocity.y, enemy.velocity.x);
        enemy.dodgeSide = enemy.dodgeSide === 1 ? -1 : 1;
        enemy.fireRemaining = Math.max(enemy.fireRemaining, 0.18);
        enemy.burstRemaining = 0;
    }

    private removeVelocityIntoWall(
        velocity: { x: number; y: number },
        normalX: number,
        normalY: number,
    ): void {
        const velocityDot = velocity.x * normalX + velocity.y * normalY;
        if (velocityDot < 0) {
            velocity.x -= velocityDot * normalX;
            velocity.y -= velocityDot * normalY;
        }
    }

    private circleTouchesAnyWall(x: number, y: number, radius: number): boolean {
        for (const wall of this.walls) {
            if (this.circleWallPush(x, y, radius, wall)) {
                return true;
            }
        }
        return false;
    }

    private circleWallPush(
        x: number,
        y: number,
        radius: number,
        wall: Readonly<CursorSpaceWall>,
    ): WallPush | null {
        const left = wall.x;
        const right = wall.x + wall.width;
        const bottom = wall.y;
        const top = wall.y + wall.height;
        const nearestX = this.clamp(x, left, right);
        const nearestY = this.clamp(y, bottom, top);
        const dx = x - nearestX;
        const dy = y - nearestY;
        const distanceSquared = dx * dx + dy * dy;
        const contactRadius = radius + WALL_AIRCRAFT_CLEARANCE;

        if (distanceSquared >= contactRadius * contactRadius) {
            return null;
        }

        if (distanceSquared > MINIMUM_VECTOR_LENGTH) {
            const distance = Math.sqrt(distanceSquared);
            const penetration = contactRadius - distance;
            const normalX = dx / distance;
            const normalY = dy / distance;
            return {
                x: normalX * penetration,
                y: normalY * penetration,
                normalX,
                normalY,
                penetration,
            };
        }

        const distances = [
            { distance: x - left, normalX: -1, normalY: 0 },
            { distance: right - x, normalX: 1, normalY: 0 },
            { distance: y - bottom, normalX: 0, normalY: -1 },
            { distance: top - y, normalX: 0, normalY: 1 },
        ];
        distances.sort((first, second) => first.distance - second.distance);
        const nearest = distances[0];
        const penetration = Math.max(0, nearest.distance) + contactRadius;
        return {
            x: nearest.normalX * penetration,
            y: nearest.normalY * penetration,
            normalX: nearest.normalX,
            normalY: nearest.normalY,
            penetration,
        };
    }

    private routeAiTarget(targetX: number, targetY: number): { x: number; y: number } {
        const startX = this.player.position.x;
        const startY = this.player.position.y;
        if (this.segmentClearOfWalls(startX, startY, targetX, targetY, WALL_AI_CLEARANCE)) {
            return { x: targetX, y: targetY };
        }

        let bestX = targetX;
        let bestY = targetY;
        let bestCost = Number.POSITIVE_INFINITY;
        for (const wall of this.walls) {
            const left = wall.x - WALL_AI_CLEARANCE;
            const right = wall.x + wall.width + WALL_AI_CLEARANCE;
            const bottom = wall.y - WALL_AI_CLEARANCE;
            const top = wall.y + wall.height + WALL_AI_CLEARANCE;
            const candidates = [
                { x: left, y: bottom },
                { x: left, y: top },
                { x: right, y: bottom },
                { x: right, y: top },
            ];

            for (const candidate of candidates) {
                if (!this.segmentClearOfWalls(
                    startX,
                    startY,
                    candidate.x,
                    candidate.y,
                    this.config.playerRadius,
                )) {
                    continue;
                }
                const cost = Math.hypot(candidate.x - startX, candidate.y - startY)
                    + Math.hypot(targetX - candidate.x, targetY - candidate.y);
                if (cost < bestCost) {
                    bestCost = cost;
                    bestX = candidate.x;
                    bestY = candidate.y;
                }
            }
        }

        const bounds = this.currentBounds;
        return {
            x: this.clamp(
                bestX,
                bounds.left + this.config.playerRadius,
                bounds.right - this.config.playerRadius,
            ),
            y: this.clamp(
                bestY,
                bounds.bottom + this.config.playerRadius,
                bounds.top - this.config.playerRadius,
            ),
        };
    }

    private segmentClearOfWalls(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        padding: number,
    ): boolean {
        for (const wall of this.walls) {
            if (this.segmentIntersectsWall(startX, startY, endX, endY, wall, padding)) {
                return false;
            }
        }
        return true;
    }

    private segmentIntersectsWall(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        wall: Readonly<CursorSpaceWall>,
        padding: number,
    ): boolean {
        const left = wall.x - padding;
        const right = wall.x + wall.width + padding;
        const bottom = wall.y - padding;
        const top = wall.y + wall.height + padding;
        let minimumTime = 0;
        let maximumTime = 1;
        const deltaX = endX - startX;
        const deltaY = endY - startY;

        const clip = (start: number, delta: number, minimum: number, maximum: number): boolean => {
            if (Math.abs(delta) < MINIMUM_VECTOR_LENGTH) {
                return start >= minimum && start <= maximum;
            }
            const first = (minimum - start) / delta;
            const second = (maximum - start) / delta;
            const entry = Math.min(first, second);
            const exit = Math.max(first, second);
            minimumTime = Math.max(minimumTime, entry);
            maximumTime = Math.min(maximumTime, exit);
            return minimumTime <= maximumTime;
        };

        return clip(startX, deltaX, left, right)
            && clip(startY, deltaY, bottom, top)
            && maximumTime >= 0
            && minimumTime <= 1;
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

    private createRandom(seedValue: number): SeededRandom {
        let state = seedValue >>> 0;
        const next = (): number => {
            state += 0x6d2b79f5;
            let value = state;
            value = Math.imul(value ^ value >>> 15, value | 1);
            value ^= value + Math.imul(value ^ value >>> 7, value | 61);
            return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
        };
        return {
            next,
            range: (minimum: number, maximum: number): number => (
                minimum + (maximum - minimum) * next()
            ),
            integer: (minimum: number, maximumInclusive: number): number => (
                minimum + Math.floor(next() * (maximumInclusive - minimum + 1))
            ),
        };
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
