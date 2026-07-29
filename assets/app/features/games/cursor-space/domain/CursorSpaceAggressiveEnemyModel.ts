import type {
    CursorSpaceEnemyBehavior,
    CursorSpaceEnemyBehaviorContext,
} from './CursorSpaceEnemyBehavior';
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

const WALL_ESCAPE_MARGIN = 76;
const WALL_ESCAPE_PROBE = 92;
const WALL_STUCK_BUILD_RATE = 1;
const WALL_STUCK_DECAY_RATE = 3.8;
const WALL_STUCK_DOMINANCE_TIME = 0.34;
const WALL_STUCK_SIDE_SWITCH_INTERVAL = 0.58;
const WALL_ESCAPE_NUDGE_LIMIT = 4.5;

interface Direction {
    readonly x: number;
    readonly y: number;
}

interface WallEscapeThreat extends Direction {
    readonly threat: number;
    readonly stuckTime: number;
}

interface WallEscapeGeometry {
    readonly distance: number;
    readonly normalX: number;
    readonly normalY: number;
}

/**
 * Final enemy-behaviour facade.
 *
 * Enemy decision order is explicit:
 * 1. kill and intercept the player;
 * 2. preserve the aircraft from player fire, walls and the arena boundary;
 * 3. avoid friendly aircraft and friendly fire lanes.
 *
 * Pursuit remains dominant in open space. Near walls, continuous lack of net
 * progress raises an escape signal until the enemy commits to an outward and
 * tangential route instead of repeatedly reflecting in place.
 */
export class CursorSpaceModel {
    readonly player: CursorSpacePlayer;
    readonly stats: CursorSpaceStats;
    readonly enemies: CursorSpaceEnemy[];
    readonly projectiles: CursorSpaceProjectile[];
    readonly effects: CursorSpaceEffect[];
    readonly walls: CursorSpaceWall[];

    private readonly core: CursorSpaceClosedWallModel;
    private readonly previousEnemyX: number[];
    private readonly previousEnemyY: number[];
    private readonly enemyWallStuckTime: number[];
    private readonly enemyWallEscapeSide: Array<-1 | 1>;

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
        this.previousEnemyX = new Array<number>(this.enemies.length).fill(Number.NaN);
        this.previousEnemyY = new Array<number>(this.enemies.length).fill(Number.NaN);
        this.enemyWallStuckTime = new Array<number>(this.enemies.length).fill(0);
        this.enemyWallEscapeSide = Array.from(
            { length: this.enemies.length },
            (_, index): -1 | 1 => index % 2 === 0 ? 1 : -1,
        );
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
        this.resetEnemyWallTracking();
    }

    step(deltaTime: number): void {
        this.core.step(deltaTime);
    }

    private resetEnemyWallTracking(): void {
        this.previousEnemyX.fill(Number.NaN);
        this.previousEnemyY.fill(Number.NaN);
        this.enemyWallStuckTime.fill(0);
        for (let index = 0; index < this.enemyWallEscapeSide.length; index += 1) {
            this.enemyWallEscapeSide[index] = index % 2 === 0 ? 1 : -1;
        }
    }

    private updateAggressiveEnemies(
        context: CursorSpaceEnemyBehaviorContext,
        dt: number,
    ): void {
        for (let enemyIndex = 0; enemyIndex < context.enemies.length; enemyIndex += 1) {
            const enemy = context.enemies[enemyIndex];
            if (!enemy.active) {
                this.previousEnemyX[enemyIndex] = Number.NaN;
                this.previousEnemyY[enemyIndex] = Number.NaN;
                this.enemyWallStuckTime[enemyIndex] = 0;
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
            const wallEscape = this.wallEscapeThreat(enemyIndex, enemy, dt);

            const survivalThreat = Math.max(
                projectileThreat.threat,
                boundaryThreat.threat,
                wallEscape.threat,
            );
            const friendlyPressure = Math.max(
                collisionThreat.threat,
                friendlyThreat.threat,
            );

            const survivalDirection = this.weightedDirection(
                projectileThreat.x * projectileThreat.threat * 1.2
                    + boundaryThreat.x * boundaryThreat.threat
                    + wallEscape.x * wallEscape.threat * 2.1,
                projectileThreat.y * projectileThreat.threat * 1.2
                    + boundaryThreat.y * boundaryThreat.threat
                    + wallEscape.y * wallEscape.threat * 2.1,
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
                    MAXIMUM_SURVIVAL_WEIGHT + wallEscape.threat * 3.2,
                    0.45 + survivalThreat * 2.7 + wallEscape.stuckTime * 4.6,
                );
            const friendlyWeight = friendlyPressure <= 0
                ? 0
                : Math.min(
                    MAXIMUM_FRIENDLY_WEIGHT,
                    friendlyPressure * MAXIMUM_FRIENDLY_WEIGHT,
                );
            const pursuitWeight = PURSUIT_WEIGHT * (
                1 - wallEscape.threat * 0.78
            );

            const desired = this.normalized(
                pursuit.x * pursuitWeight
                    + survivalDirection.x * survivalWeight
                    + friendlyDirection.x * friendlyWeight
                    + wallEscape.x * wallEscape.threat * (
                        1.4 + Math.min(4.2, wallEscape.stuckTime * 5.2)
                    ),
                pursuit.y * pursuitWeight
                    + survivalDirection.y * survivalWeight
                    + friendlyDirection.y * friendlyWeight
                    + wallEscape.y * wallEscape.threat * (
                        1.4 + Math.min(4.2, wallEscape.stuckTime * 5.2)
                    ),
                enemy.rotation,
            );
            const desiredRotation = Math.atan2(desired.y, desired.x);
            const maximumTurn = enemy.turnRate * (
                1.3
                + survivalThreat * 1.25
                + friendlyPressure * 0.12
                + wallEscape.threat * 4.6
                + Math.min(2.4, wallEscape.stuckTime * 2.8)
            ) * dt;
            const difference = this.wrapAngle(desiredRotation - enemy.rotation);
            enemy.rotation = this.wrapAngle(
                enemy.rotation + this.clamp(difference, -maximumTurn, maximumTurn),
            );

            // Keep the value below the combat core's fire suppression threshold.
            // Survival still changes steering, but cannot disable the attack.
            const displayedThreat = Math.max(
                survivalThreat,
                friendlyPressure * 0.25,
            );
            enemy.threat += (
                Math.min(FIRE_THREAT_CEILING, displayedThreat) - enemy.threat
            ) * (1 - Math.exp(-10 * dt));

            if (wallEscape.stuckTime >= WALL_STUCK_DOMINANCE_TIME) {
                const nudge = Math.min(
                    WALL_ESCAPE_NUDGE_LIMIT,
                    enemy.movementSpeed * dt * 0.38,
                );
                enemy.position.x += wallEscape.x * nudge;
                enemy.position.y += wallEscape.y * nudge;
                enemy.fireRemaining = Math.max(enemy.fireRemaining, 0.12);
                enemy.burstRemaining = 0;
            }

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
                this.previousEnemyX[enemyIndex] = Number.NaN;
                this.previousEnemyY[enemyIndex] = Number.NaN;
                this.enemyWallStuckTime[enemyIndex] = 0;
            }
        }
    }

    private wallEscapeThreat(
        enemyIndex: number,
        enemy: Readonly<CursorSpaceEnemy>,
        dt: number,
    ): WallEscapeThreat {
        const previousX = this.previousEnemyX[enemyIndex];
        const previousY = this.previousEnemyY[enemyIndex];
        const hadPrevious = Number.isFinite(previousX) && Number.isFinite(previousY);
        const netMovement = hadPrevious
            ? Math.hypot(enemy.position.x - previousX, enemy.position.y - previousY)
            : enemy.movementSpeed * dt;
        this.previousEnemyX[enemyIndex] = enemy.position.x;
        this.previousEnemyY[enemyIndex] = enemy.position.y;

        if (this.walls.length === 0) {
            this.enemyWallStuckTime[enemyIndex] = 0;
            return {
                x: Math.cos(enemy.rotation),
                y: Math.sin(enemy.rotation),
                threat: 0,
                stuckTime: 0,
            };
        }

        const padding = enemy.radius + 4;
        let nearest: WallEscapeGeometry | null = null;
        for (const wall of this.walls) {
            const geometry = this.wallEscapeGeometry(
                enemy.position.x,
                enemy.position.y,
                wall,
                padding,
            );
            if (!nearest || geometry.distance < nearest.distance) {
                nearest = geometry;
            }
        }

        if (!nearest || nearest.distance >= WALL_ESCAPE_MARGIN) {
            this.enemyWallStuckTime[enemyIndex] *= Math.exp(-WALL_STUCK_DECAY_RATE * dt);
            return {
                x: Math.cos(enemy.rotation),
                y: Math.sin(enemy.rotation),
                threat: 0,
                stuckTime: this.enemyWallStuckTime[enemyIndex],
            };
        }

        const expectedMovement = enemy.movementSpeed * dt * 0.28;
        if (hadPrevious && netMovement < expectedMovement) {
            this.enemyWallStuckTime[enemyIndex] += dt * WALL_STUCK_BUILD_RATE;
        } else {
            this.enemyWallStuckTime[enemyIndex] *= Math.exp(-WALL_STUCK_DECAY_RATE * dt);
        }
        const stuckTime = this.enemyWallStuckTime[enemyIndex];

        if (
            stuckTime > WALL_STUCK_DOMINANCE_TIME
            && Math.floor((stuckTime - dt) / WALL_STUCK_SIDE_SWITCH_INTERVAL)
                !== Math.floor(stuckTime / WALL_STUCK_SIDE_SWITCH_INTERVAL)
        ) {
            this.enemyWallEscapeSide[enemyIndex] = this.enemyWallEscapeSide[enemyIndex] === 1
                ? -1
                : 1;
        }

        let side = this.enemyWallEscapeSide[enemyIndex];
        let tangentX = -nearest.normalY * side;
        let tangentY = nearest.normalX * side;
        if (!this.segmentTraversableFromCurrent(
            enemy.position.x,
            enemy.position.y,
            enemy.position.x + tangentX * WALL_ESCAPE_PROBE,
            enemy.position.y + tangentY * WALL_ESCAPE_PROBE,
            padding,
        )) {
            side = side === 1 ? -1 : 1;
            this.enemyWallEscapeSide[enemyIndex] = side;
            tangentX = -nearest.normalY * side;
            tangentY = nearest.normalX * side;
        }

        const proximityThreat = this.clamp(
            1 - nearest.distance / WALL_ESCAPE_MARGIN,
            0,
            1,
        );
        const stuckThreat = this.clamp(stuckTime / WALL_STUCK_DOMINANCE_TIME, 0, 1);
        const threat = Math.max(proximityThreat, stuckThreat);
        const direction = this.weightedDirection(
            nearest.normalX * (1.2 + threat * 2.2)
                + tangentX * (0.55 + stuckTime * 3.4),
            nearest.normalY * (1.2 + threat * 2.2)
                + tangentY * (0.55 + stuckTime * 3.4),
            { x: nearest.normalX, y: nearest.normalY },
        );
        return {
            x: direction.x,
            y: direction.y,
            threat,
            stuckTime,
        };
    }

    private wallEscapeGeometry(
        x: number,
        y: number,
        wall: Readonly<CursorSpaceWall>,
        padding: number,
    ): WallEscapeGeometry {
        const left = wall.x - padding;
        const right = wall.x + wall.width + padding;
        const bottom = wall.y - padding;
        const top = wall.y + wall.height + padding;
        const nearestX = this.clamp(x, left, right);
        const nearestY = this.clamp(y, bottom, top);
        const dx = x - nearestX;
        const dy = y - nearestY;
        const distance = Math.hypot(dx, dy);
        if (distance > MINIMUM_LENGTH) {
            return {
                distance,
                normalX: dx / distance,
                normalY: dy / distance,
            };
        }

        const exits = [
            { distance: Math.abs(x - left), normalX: -1, normalY: 0 },
            { distance: Math.abs(right - x), normalX: 1, normalY: 0 },
            { distance: Math.abs(y - bottom), normalX: 0, normalY: -1 },
            { distance: Math.abs(top - y), normalX: 0, normalY: 1 },
        ];
        exits.sort((first, second) => first.distance - second.distance);
        return {
            distance: 0,
            normalX: exits[0].normalX,
            normalY: exits[0].normalY,
        };
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
        if (this.segmentTraversableFromCurrent(
            startX,
            startY,
            targetX,
            targetY,
            clearance,
        )) {
            return { x: targetX, y: targetY };
        }

        let bestX = targetX;
        let bestY = targetY;
        let bestCost = Number.POSITIVE_INFINITY;

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
                const legClearance = Math.max(2, clearance * 0.55);
                if (!this.segmentTraversableFromCurrent(
                    startX,
                    startY,
                    candidate.x,
                    candidate.y,
                    legClearance,
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
                    legClearance,
                );
                const cost = firstLeg + secondLeg + (secondLegClear ? 0 : 900);
                if (cost < bestCost) {
                    bestCost = cost;
                    bestX = candidate.x;
                    bestY = candidate.y;
                }
            }
        }

        return { x: bestX, y: bestY };
    }

    private segmentTraversableFromCurrent(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        padding: number,
    ): boolean {
        for (const wall of this.walls) {
            if (!this.segmentIntersectsWall(
                startX,
                startY,
                endX,
                endY,
                wall,
                padding,
            )) {
                continue;
            }
            if (!this.pointInsideExpandedWall(startX, startY, wall, padding)) {
                return false;
            }
            if (this.pointInsideExpandedWall(endX, endY, wall, padding)) {
                return false;
            }
            const escape = this.nearestWallEscapeNormal(startX, startY, wall, padding);
            const movementX = endX - startX;
            const movementY = endY - startY;
            if (movementX * escape.x + movementY * escape.y <= 0) {
                return false;
            }
        }
        return true;
    }

    private pointInsideExpandedWall(
        x: number,
        y: number,
        wall: Readonly<CursorSpaceWall>,
        padding: number,
    ): boolean {
        return x >= wall.x - padding
            && x <= wall.x + wall.width + padding
            && y >= wall.y - padding
            && y <= wall.y + wall.height + padding;
    }

    private nearestWallEscapeNormal(
        x: number,
        y: number,
        wall: Readonly<CursorSpaceWall>,
        padding: number,
    ): Direction {
        const left = wall.x - padding;
        const right = wall.x + wall.width + padding;
        const bottom = wall.y - padding;
        const top = wall.y + wall.height + padding;
        const exits = [
            { distance: Math.abs(x - left), x: -1, y: 0 },
            { distance: Math.abs(right - x), x: 1, y: 0 },
            { distance: Math.abs(y - bottom), x: 0, y: -1 },
            { distance: Math.abs(top - y), x: 0, y: 1 },
        ];
        exits.sort((first, second) => first.distance - second.distance);
        return { x: exits[0].x, y: exits[0].y };
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
