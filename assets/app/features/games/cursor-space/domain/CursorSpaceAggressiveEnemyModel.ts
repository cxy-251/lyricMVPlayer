import type {
    CursorSpaceEnemyBehavior,
    CursorSpaceEnemyBehaviorContext,
} from './CursorSpaceCombatModel';
import { CursorSpaceModel as CursorSpaceClosedWallModel } from './CursorSpaceClosedWallModel';
import type { CursorSpaceWall } from './CursorSpaceClosedWallModel';
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

const MINIMUM_LENGTH = 0.0001;
const ENEMY_REMOVAL_MARGIN = 180;
const PLAYER_LEAD_TIME = 0.34;
const PURSUIT_WEIGHT = 5.4;
const MAXIMUM_SURVIVAL_WEIGHT = 3.15;
const MAXIMUM_FRIENDLY_WEIGHT = 0.62;
const WALL_ROUTE_CLEARANCE = 28;
const FIRE_THREAT_CEILING = 0.18;

interface Direction {
    readonly x: number;
    readonly y: number;
}

/**
 * Final enemy-behaviour facade.
 *
 * Enemy decision order is explicit:
 * 1. kill and intercept the player;
 * 2. preserve the aircraft from player fire and the arena boundary;
 * 3. avoid friendly aircraft and friendly fire lanes.
 *
 * Pursuit always remains the dominant steering vector. Survival can bend the
 * attack path but cannot replace it, while friendly avoidance is only a small
 * correction. Walls are treated as routing obstacles so enemies seek a route
 * around them instead of orbiting or repeatedly bouncing in place.
 */
export class CursorSpaceModel {
    readonly player: CursorSpacePlayer;
    readonly stats: CursorSpaceStats;
    readonly enemies: CursorSpaceEnemy[];
    readonly projectiles: CursorSpaceProjectile[];
    readonly effects: CursorSpaceEffect[];
    readonly walls: CursorSpaceWall[];

    private readonly core: CursorSpaceClosedWallModel;

    constructor(config: CursorSpaceConfig = cursorSpaceConfig) {
        const enemyBehavior: CursorSpaceEnemyBehavior = {
            updateEnemies: (context, dt): void => {
                this.updateAggressiveEnemies(context, dt);
            },
            // Enemy projectiles do not damage enemy aircraft in the combat model,
            // so overlapping aircraft must not turn friendly fire into a hard veto.
            blocksFriendlyFireLane: (): boolean => false,
        };
        this.core = new CursorSpaceClosedWallModel({
            ...config,
            enemyBehavior,
        });
        this.player = this.core.player;
        this.stats = this.core.stats;
        this.enemies = this.core.enemies;
        this.projectiles = this.core.projectiles;
        this.effects = this.core.effects;
        this.walls = this.core.walls;
    }

    get currentBounds(): Readonly<CursorSpaceBounds> {
        return this.core.currentBounds;
    }

    get wallActive(): boolean {
        return this.core.wallActive;
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
        this.core.step(deltaTime);
    }

    private updateAggressiveEnemies(
        context: CursorSpaceEnemyBehaviorContext,
        dt: number,
    ): void {
        for (let enemyIndex = 0; enemyIndex < context.enemies.length; enemyIndex += 1) {
            const enemy = context.enemies[enemyIndex];
            if (!enemy.active) {
                continue;
            }

            const pursuit = this.aggressivePursuitDirection(
                enemy,
                context.player,
                context.bounds,
            );
            const projectileThreat = context.playerProjectileThreat(enemy);
            const boundaryThreat = context.boundaryThreat(enemy);
            const collisionThreat = context.enemyCollisionThreat(enemyIndex, enemy);
            const friendlyThreat = context.friendlySeparationThreat(enemyIndex, enemy);

            const survivalThreat = Math.max(
                projectileThreat.threat,
                boundaryThreat.threat,
            );
            const friendlyPressure = Math.max(
                collisionThreat.threat,
                friendlyThreat.threat,
            );

            const survivalDirection = this.weightedDirection(
                projectileThreat.x * projectileThreat.threat * 1.2
                    + boundaryThreat.x * boundaryThreat.threat,
                projectileThreat.y * projectileThreat.threat * 1.2
                    + boundaryThreat.y * boundaryThreat.threat,
                pursuit,
            );
            const friendlyDirection = this.weightedDirection(
                collisionThreat.x * collisionThreat.threat
                    + friendlyThreat.x * friendlyThreat.threat,
                collisionThreat.y * collisionThreat.threat
                    + friendlyThreat.y * friendlyThreat.threat,
                pursuit,
            );

            const survivalWeight = survivalThreat <= 0
                ? 0
                : Math.min(
                    MAXIMUM_SURVIVAL_WEIGHT,
                    0.45 + survivalThreat * 2.7,
                );
            const friendlyWeight = friendlyPressure <= 0
                ? 0
                : Math.min(
                    MAXIMUM_FRIENDLY_WEIGHT,
                    friendlyPressure * MAXIMUM_FRIENDLY_WEIGHT,
                );

            const desired = this.normalized(
                pursuit.x * PURSUIT_WEIGHT
                    + survivalDirection.x * survivalWeight
                    + friendlyDirection.x * friendlyWeight,
                pursuit.y * PURSUIT_WEIGHT
                    + survivalDirection.y * survivalWeight
                    + friendlyDirection.y * friendlyWeight,
                enemy.rotation,
            );
            const desiredRotation = Math.atan2(desired.y, desired.x);
            const maximumTurn = enemy.turnRate * (
                1.3 + survivalThreat * 1.25 + friendlyPressure * 0.12
            ) * dt;
            const difference = this.wrapAngle(desiredRotation - enemy.rotation);
            enemy.rotation = this.wrapAngle(
                enemy.rotation + this.clamp(difference, -maximumTurn, maximumTurn),
            );

            // Keep the value below the combat core's fire suppression threshold.
            // Survival still changes steering, but cannot disable the attack.
            const displayedThreat = Math.max(survivalThreat, friendlyPressure * 0.25);
            enemy.threat += (
                Math.min(FIRE_THREAT_CEILING, displayedThreat) - enemy.threat
            ) * (1 - Math.exp(-10 * dt));

            // Enemy speed remains exactly its configured scalar speed.
            enemy.velocity.x = Math.cos(enemy.rotation) * enemy.movementSpeed;
            enemy.velocity.y = Math.sin(enemy.rotation) * enemy.movementSpeed;
            enemy.position.x += enemy.velocity.x * dt;
            enemy.position.y += enemy.velocity.y * dt;

            if (
                !Number.isFinite(enemy.position.x)
                || !Number.isFinite(enemy.position.y)
                || enemy.position.x < context.bounds.left - ENEMY_REMOVAL_MARGIN
                || enemy.position.x > context.bounds.right + ENEMY_REMOVAL_MARGIN
                || enemy.position.y < context.bounds.bottom - ENEMY_REMOVAL_MARGIN
                || enemy.position.y > context.bounds.top + ENEMY_REMOVAL_MARGIN
            ) {
                enemy.active = false;
                context.clearProjectilesFromEnemy(enemyIndex);
            }
        }
    }

    private aggressivePursuitDirection(
        enemy: Readonly<CursorSpaceEnemy>,
        player: Readonly<CursorSpacePlayer>,
        bounds: Readonly<CursorSpaceBounds>,
    ): Direction {
        if (!player.alive) {
            return {
                x: Math.cos(enemy.rotation),
                y: Math.sin(enemy.rotation),
            };
        }

        const targetX = this.clamp(
            player.position.x + player.velocity.x * PLAYER_LEAD_TIME,
            bounds.left,
            bounds.right,
        );
        const targetY = this.clamp(
            player.position.y + player.velocity.y * PLAYER_LEAD_TIME,
            bounds.bottom,
            bounds.top,
        );
        const waypoint = this.routeAroundWalls(
            enemy.position.x,
            enemy.position.y,
            targetX,
            targetY,
            enemy.radius + WALL_ROUTE_CLEARANCE,
            bounds,
        );
        return this.normalized(
            waypoint.x - enemy.position.x,
            waypoint.y - enemy.position.y,
            enemy.rotation,
        );
    }

    private routeAroundWalls(
        startX: number,
        startY: number,
        targetX: number,
        targetY: number,
        clearance: number,
        bounds: Readonly<CursorSpaceBounds>,
    ): { x: number; y: number } {
        if (this.segmentClearOfWalls(startX, startY, targetX, targetY, clearance)) {
            return { x: targetX, y: targetY };
        }

        let bestX = targetX;
        let bestY = targetY;
        let bestCost = Number.POSITIVE_INFINITY;
        let bestFirstLegCost = Number.POSITIVE_INFINITY;

        for (const wall of this.walls) {
            const candidates = [
                { x: wall.x - clearance, y: wall.y - clearance },
                { x: wall.x - clearance, y: wall.y + wall.height + clearance },
                { x: wall.x + wall.width + clearance, y: wall.y - clearance },
                {
                    x: wall.x + wall.width + clearance,
                    y: wall.y + wall.height + clearance,
                },
            ];

            for (const rawCandidate of candidates) {
                const candidate = {
                    x: this.clamp(rawCandidate.x, bounds.left + 2, bounds.right - 2),
                    y: this.clamp(rawCandidate.y, bounds.bottom + 2, bounds.top - 2),
                };
                if (!this.segmentClearOfWalls(
                    startX,
                    startY,
                    candidate.x,
                    candidate.y,
                    Math.max(2, clearance * 0.55),
                )) {
                    continue;
                }

                const firstLeg = Math.hypot(candidate.x - startX, candidate.y - startY);
                const secondLeg = Math.hypot(targetX - candidate.x, targetY - candidate.y);
                const secondLegClear = this.segmentClearOfWalls(
                    candidate.x,
                    candidate.y,
                    targetX,
                    targetY,
                    Math.max(2, clearance * 0.55),
                );
                const cost = firstLeg + secondLeg + (secondLegClear ? 0 : 900);

                if (cost < bestCost) {
                    bestCost = cost;
                    bestX = candidate.x;
                    bestY = candidate.y;
                }
                if (firstLeg < bestFirstLegCost && !Number.isFinite(bestCost)) {
                    bestFirstLegCost = firstLeg;
                    bestX = candidate.x;
                    bestY = candidate.y;
                }
            }
        }

        return { x: bestX, y: bestY };
    }

    private segmentClearOfWalls(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        padding: number,
    ): boolean {
        for (const wall of this.walls) {
            if (this.segmentIntersectsWall(
                startX,
                startY,
                endX,
                endY,
                wall,
                padding,
            )) {
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
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        let minimumTime = 0;
        let maximumTime = 1;

        const clip = (
            start: number,
            delta: number,
            minimum: number,
            maximum: number,
        ): boolean => {
            if (Math.abs(delta) < MINIMUM_LENGTH) {
                return start >= minimum && start <= maximum;
            }
            const first = (minimum - start) / delta;
            const second = (maximum - start) / delta;
            minimumTime = Math.max(minimumTime, Math.min(first, second));
            maximumTime = Math.min(maximumTime, Math.max(first, second));
            return minimumTime <= maximumTime;
        };

        return clip(startX, deltaX, left, right)
            && clip(startY, deltaY, bottom, top)
            && maximumTime >= 0
            && minimumTime <= 1;
    }

    private weightedDirection(
        x: number,
        y: number,
        fallback: Readonly<Direction>,
    ): Direction {
        const length = Math.hypot(x, y);
        if (length < MINIMUM_LENGTH) {
            return fallback;
        }
        return { x: x / length, y: y / length };
    }

    private normalized(x: number, y: number, fallbackRotation: number): Direction {
        const length = Math.hypot(x, y);
        if (length < MINIMUM_LENGTH) {
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

export type { CursorSpaceWall };
