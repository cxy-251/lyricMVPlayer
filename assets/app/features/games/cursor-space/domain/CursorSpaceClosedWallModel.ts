import { cursorSpaceEscortWorldPosition } from './CursorSpaceFormation';
import {
    CursorSpaceModel as CursorSpaceDynamicWallModel,
    type CursorSpaceWall,
    type CursorSpaceWallProgression,
} from './CursorSpaceDynamicWallModel';
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

const WALL_UNLOCK_LEVEL = 20;
const WALL_CHANGE_INTERVAL = 10;
const WALL_EFFECT_LIFE = 999;
const WALL_EFFECT_MARKER = 900;
const MINIMUM_LENGTH = 0.0001;
const MAX_INTERIOR_LINES_PER_WALL = 5;
const TARGET_LOCK_DURATION = 0.85;
const TARGET_CORRIDOR_PADDING = 5;
const WALL_FIRE_PADDING = 3;

const CLOSED_WALL_PROGRESSION: CursorSpaceWallProgression = {
    unlockLevel: WALL_UNLOCK_LEVEL,
    changeInterval: WALL_CHANGE_INTERVAL,
};

interface WallLine {
    readonly x: number;
    readonly y: number;
    readonly directionX: number;
    readonly directionY: number;
    readonly radius: number;
}

/**
 * Final Cursor Space facade.
 *
 * Dynamic walls own collision and progression. This layer keeps their visual
 * rectangles closed and adds wall-aware fire control:
 * - walls unlock at level 20 and change every ten levels;
 * - wall-occluded enemies cannot consume player shots;
 * - a short target lock prevents late-game aim thrashing;
 * - assisted fire is decoupled from evasive movement when the core cannot fire.
 */
export class CursorSpaceModel {
    readonly player: CursorSpacePlayer;
    readonly stats: CursorSpaceStats;
    readonly enemies: CursorSpaceEnemy[];
    readonly projectiles: CursorSpaceProjectile[];
    readonly effects: CursorSpaceEffect[];
    readonly walls: CursorSpaceWall[];

    private readonly core: CursorSpaceDynamicWallModel;
    private readonly config: CursorSpaceConfig;
    private readonly projectileActiveSnapshot: boolean[];
    private assistFireRemaining = 0;
    private lockedTargetIndex = -1;
    private targetLockRemaining = 0;

    constructor(config: CursorSpaceConfig = cursorSpaceConfig) {
        this.config = config;
        this.core = new CursorSpaceDynamicWallModel(config, CLOSED_WALL_PROGRESSION);
        this.player = this.core.player;
        this.stats = this.core.stats;
        this.enemies = this.core.enemies;
        this.projectiles = this.core.projectiles;
        this.effects = this.core.effects;
        this.walls = this.core.walls;
        this.projectileActiveSnapshot = new Array<boolean>(this.projectiles.length).fill(false);
        this.rewriteWallVisuals();
    }

    get currentBounds(): Readonly<CursorSpaceBounds> {
        return this.core.currentBounds;
    }

    get wallActive(): boolean {
        return this.core.wallActive;
    }

    setBounds(bounds: CursorSpaceBounds): void {
        this.core.setBounds(bounds);
        this.rewriteWallVisuals();
    }

    setTarget(x: number, y: number, throttle?: number): void {
        this.core.setTarget(x, y, throttle);
    }

    clearTarget(): void {
        this.core.clearTarget();
    }

    reset(): void {
        this.core.reset();
        this.assistFireRemaining = 0;
        this.lockedTargetIndex = -1;
        this.targetLockRemaining = 0;
        this.projectileActiveSnapshot.fill(false);
        this.rewriteWallVisuals();
    }

    step(deltaTime: number): void {
        const dt = Math.max(0, Math.min(0.05, deltaTime));
        if (dt === 0) {
            return;
        }

        this.assistFireRemaining = Math.max(0, this.assistFireRemaining - dt);
        this.targetLockRemaining = Math.max(0, this.targetLockRemaining - dt);
        this.captureProjectileActivity();

        this.core.step(dt);

        const coreProducedUsefulShot = this.rejectNewWallBoundShots();
        if (this.player.alive) {
            this.updateWallAwareFireControl(coreProducedUsefulShot);
        } else {
            this.lockedTargetIndex = -1;
            this.targetLockRemaining = 0;
        }
        this.rewriteWallVisuals();
    }

    private captureProjectileActivity(): void {
        for (let index = 0; index < this.projectiles.length; index += 1) {
            this.projectileActiveSnapshot[index] = this.projectiles[index].active;
        }
    }

    private rejectNewWallBoundShots(): boolean {
        let usefulShot = false;

        for (let index = 0; index < this.projectiles.length; index += 1) {
            const projectile = this.projectiles[index];
            if (
                !projectile.active
                || projectile.owner !== 'player'
                || this.projectileActiveSnapshot[index]
            ) {
                continue;
            }

            const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
            if (speed < MINIMUM_LENGTH) {
                projectile.active = false;
                continue;
            }

            const directionX = projectile.velocity.x / speed;
            const directionY = projectile.velocity.y / speed;
            const maximumDistance = speed * Math.max(0, projectile.life);
            const wallDistance = this.nearestWallDistanceAlongRay(
                projectile.position.x,
                projectile.position.y,
                directionX,
                directionY,
                maximumDistance,
                projectile.radius + WALL_FIRE_PADDING,
            );

            if (!Number.isFinite(wallDistance)) {
                usefulShot = true;
                continue;
            }

            const enemyDistance = this.nearestEnemyDistanceAlongRay(
                projectile.position.x,
                projectile.position.y,
                directionX,
                directionY,
                wallDistance,
                projectile.radius + TARGET_CORRIDOR_PADDING,
            );
            if (enemyDistance < wallDistance) {
                usefulShot = true;
                continue;
            }

            // The shot can only reach a wall, so remove it before the render frame.
            projectile.active = false;
        }

        if (usefulShot) {
            this.assistFireRemaining = Math.max(
                this.assistFireRemaining,
                this.currentFleetFireInterval(),
            );
        }
        return usefulShot;
    }

    private updateWallAwareFireControl(coreProducedUsefulShot: boolean): void {
        const target = this.selectVisibleTarget();
        if (!target || coreProducedUsefulShot || this.assistFireRemaining > 0) {
            return;
        }

        const aim = this.predictAimDirection(target);
        if (!aim) {
            return;
        }

        let fired = this.spawnAssistedProjectile(
            this.player.position.x,
            this.player.position.y,
            this.config.playerNoseOffset,
            aim.x,
            aim.y,
            target,
        );

        for (let index = 0; index < this.player.escortCount; index += 1) {
            const escort = cursorSpaceEscortWorldPosition(this.player, index);
            fired = this.spawnAssistedProjectile(
                escort.x,
                escort.y,
                9,
                aim.x,
                aim.y,
                target,
            ) || fired;
        }

        if (fired) {
            this.assistFireRemaining = this.currentFleetFireInterval();
        }
    }

    private selectVisibleTarget(): CursorSpaceEnemy | null {
        if (this.lockedTargetIndex >= 0) {
            const locked = this.enemies[this.lockedTargetIndex];
            if (
                locked?.active
                && this.targetLockRemaining > 0
                && this.enemyVisibleFromPlayer(locked)
            ) {
                return locked;
            }
        }

        let bestIndex = -1;
        let bestScore = Number.POSITIVE_INFINITY;
        for (let index = 0; index < this.enemies.length; index += 1) {
            const enemy = this.enemies[index];
            if (!enemy.active || !this.enemyVisibleFromPlayer(enemy)) {
                continue;
            }

            const dx = enemy.position.x - this.player.position.x;
            const dy = enemy.position.y - this.player.position.y;
            const distance = Math.hypot(dx, dy);
            if (distance > this.config.autoAimRange) {
                continue;
            }

            const angle = Math.atan2(dy, dx);
            const angularCost = Math.abs(this.wrapAngle(angle - this.player.rotation)) * 54;
            const score = distance + angularCost;
            if (score < bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        }

        this.lockedTargetIndex = bestIndex;
        this.targetLockRemaining = bestIndex >= 0 ? TARGET_LOCK_DURATION : 0;
        return bestIndex >= 0 ? this.enemies[bestIndex] : null;
    }

    private enemyVisibleFromPlayer(enemy: Readonly<CursorSpaceEnemy>): boolean {
        return this.segmentClearOfWalls(
            this.player.position.x,
            this.player.position.y,
            enemy.position.x,
            enemy.position.y,
            this.config.projectileRadius + WALL_FIRE_PADDING,
        );
    }

    private predictAimDirection(enemy: Readonly<CursorSpaceEnemy>): { x: number; y: number } | null {
        const inheritedX = this.player.velocity.x * this.config.inheritedVelocity;
        const inheritedY = this.player.velocity.y * this.config.inheritedVelocity;
        const relativeVelocityX = enemy.velocity.x - inheritedX;
        const relativeVelocityY = enemy.velocity.y - inheritedY;
        const relativeX = enemy.position.x - this.player.position.x;
        const relativeY = enemy.position.y - this.player.position.y;

        let time = Math.hypot(relativeX, relativeY) / this.config.projectileSpeed;
        for (let iteration = 0; iteration < 2; iteration += 1) {
            const predictedX = relativeX + relativeVelocityX * time;
            const predictedY = relativeY + relativeVelocityY * time;
            time = Math.min(
                this.config.projectileLife,
                Math.hypot(predictedX, predictedY) / this.config.projectileSpeed,
            );
        }

        const aimX = relativeX + relativeVelocityX * time;
        const aimY = relativeY + relativeVelocityY * time;
        const length = Math.hypot(aimX, aimY);
        if (length < MINIMUM_LENGTH) {
            return null;
        }
        return { x: aimX / length, y: aimY / length };
    }

    private spawnAssistedProjectile(
        originX: number,
        originY: number,
        noseOffset: number,
        directionX: number,
        directionY: number,
        target: Readonly<CursorSpaceEnemy>,
    ): boolean {
        const muzzleX = originX + directionX * noseOffset;
        const muzzleY = originY + directionY * noseOffset;
        if (!this.segmentClearOfWalls(
            muzzleX,
            muzzleY,
            target.position.x,
            target.position.y,
            this.config.projectileRadius + WALL_FIRE_PADDING,
        )) {
            return false;
        }

        const projectile = this.projectiles.find((candidate) => !candidate.active);
        if (!projectile) {
            return false;
        }

        projectile.active = true;
        projectile.owner = 'player';
        projectile.sourceEnemyIndex = -1;
        projectile.position.x = muzzleX;
        projectile.position.y = muzzleY;
        projectile.velocity.x = directionX * this.config.projectileSpeed
            + this.player.velocity.x * this.config.inheritedVelocity;
        projectile.velocity.y = directionY * this.config.projectileSpeed
            + this.player.velocity.y * this.config.inheritedVelocity;
        projectile.life = this.config.projectileLife;
        projectile.radius = this.config.projectileRadius;
        projectile.damage = this.config.playerProjectileDamage;
        projectile.travelled = 0;
        return true;
    }

    private currentFleetFireInterval(): number {
        return Math.max(
            this.config.minimumFleetFireInterval,
            this.config.fireInterval
                / (1 + this.player.fireSupportLevel * this.config.fireSupportDensityPerLevel),
        );
    }

    private nearestWallDistanceAlongRay(
        originX: number,
        originY: number,
        directionX: number,
        directionY: number,
        maximumDistance: number,
        padding: number,
    ): number {
        let nearest = Number.POSITIVE_INFINITY;
        for (const wall of this.walls) {
            const distance = this.rayWallEntryDistance(
                originX,
                originY,
                directionX,
                directionY,
                wall,
                padding,
            );
            if (distance >= 0 && distance <= maximumDistance) {
                nearest = Math.min(nearest, distance);
            }
        }
        return nearest;
    }

    private nearestEnemyDistanceAlongRay(
        originX: number,
        originY: number,
        directionX: number,
        directionY: number,
        maximumDistance: number,
        padding: number,
    ): number {
        let nearest = Number.POSITIVE_INFINITY;
        for (const enemy of this.enemies) {
            if (!enemy.active) {
                continue;
            }
            const relativeX = enemy.position.x - originX;
            const relativeY = enemy.position.y - originY;
            const projection = relativeX * directionX + relativeY * directionY;
            if (projection < 0 || projection > maximumDistance) {
                continue;
            }
            const perpendicularSquared = relativeX * relativeX + relativeY * relativeY
                - projection * projection;
            const radius = enemy.radius + padding;
            if (perpendicularSquared > radius * radius) {
                continue;
            }
            const halfChord = Math.sqrt(Math.max(0, radius * radius - perpendicularSquared));
            nearest = Math.min(nearest, Math.max(0, projection - halfChord));
        }
        return nearest;
    }

    private rayWallEntryDistance(
        originX: number,
        originY: number,
        directionX: number,
        directionY: number,
        wall: Readonly<CursorSpaceWall>,
        padding: number,
    ): number {
        const left = wall.x - padding;
        const right = wall.x + wall.width + padding;
        const bottom = wall.y - padding;
        const top = wall.y + wall.height + padding;
        let entry = 0;
        let exit = Number.POSITIVE_INFINITY;

        const clip = (origin: number, direction: number, minimum: number, maximum: number): boolean => {
            if (Math.abs(direction) < MINIMUM_LENGTH) {
                return origin >= minimum && origin <= maximum;
            }
            const first = (minimum - origin) / direction;
            const second = (maximum - origin) / direction;
            entry = Math.max(entry, Math.min(first, second));
            exit = Math.min(exit, Math.max(first, second));
            return entry <= exit;
        };

        if (
            !clip(originX, directionX, left, right)
            || !clip(originY, directionY, bottom, top)
            || exit < 0
        ) {
            return Number.POSITIVE_INFINITY;
        }
        return Math.max(0, entry);
    }

    private segmentClearOfWalls(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        padding: number,
    ): boolean {
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < MINIMUM_LENGTH) {
            return true;
        }
        const directionX = deltaX / distance;
        const directionY = deltaY / distance;
        return this.nearestWallDistanceAlongRay(
            startX,
            startY,
            directionX,
            directionY,
            distance,
            padding,
        ) === Number.POSITIVE_INFINITY;
    }

    private rewriteWallVisuals(): void {
        const reservedIndices: number[] = [];
        for (let index = 0; index < this.effects.length; index += 1) {
            const effect = this.effects[index];
            if (
                effect.initialLife >= WALL_EFFECT_MARKER
                || effect.life >= WALL_EFFECT_MARKER
            ) {
                reservedIndices.push(index);
                effect.active = false;
            }
        }

        if (!this.wallActive || reservedIndices.length === 0) {
            return;
        }

        const lines = this.buildClosedWallLines(reservedIndices.length);
        const visibleCount = Math.min(lines.length, reservedIndices.length);
        for (let index = 0; index < visibleCount; index += 1) {
            const effect = this.effects[reservedIndices[index]];
            const line = lines[index];
            effect.active = true;
            effect.kind = 'fragment';
            effect.position.x = line.x;
            effect.position.y = line.y;
            effect.velocity.x = line.directionX;
            effect.velocity.y = line.directionY;
            effect.life = WALL_EFFECT_LIFE;
            effect.initialLife = WALL_EFFECT_LIFE;
            effect.radius = line.radius;
        }
    }

    private buildClosedWallLines(capacity: number): WallLine[] {
        const outlines: WallLine[] = [];
        const interiors: WallLine[] = [];

        for (const wall of this.walls) {
            this.appendWallOutline(outlines, wall);
            this.appendWallInterior(interiors, wall);
        }

        if (outlines.length >= capacity) {
            return outlines.slice(0, capacity);
        }
        return outlines.concat(interiors.slice(0, capacity - outlines.length));
    }

    private appendWallOutline(lines: WallLine[], wall: Readonly<CursorSpaceWall>): void {
        const centerX = wall.x + wall.width * 0.5;
        const centerY = wall.y + wall.height * 0.5;
        const horizontalRadius = Math.max(MINIMUM_LENGTH, wall.width * 0.5);
        const verticalRadius = Math.max(MINIMUM_LENGTH, wall.height * 0.5);

        lines.push(
            {
                x: centerX,
                y: wall.y,
                directionX: 1,
                directionY: 0,
                radius: horizontalRadius,
            },
            {
                x: centerX,
                y: wall.y + wall.height,
                directionX: 1,
                directionY: 0,
                radius: horizontalRadius,
            },
            {
                x: wall.x,
                y: centerY,
                directionX: 0,
                directionY: 1,
                radius: verticalRadius,
            },
            {
                x: wall.x + wall.width,
                y: centerY,
                directionX: 0,
                directionY: 1,
                radius: verticalRadius,
            },
        );
    }

    private appendWallInterior(lines: WallLine[], wall: Readonly<CursorSpaceWall>): void {
        const horizontal = wall.width >= wall.height;
        const thickness = horizontal ? wall.height : wall.width;
        const requestedLines = Math.max(1, Math.ceil(thickness / 5) - 1);
        const count = Math.min(MAX_INTERIOR_LINES_PER_WALL, requestedLines);

        for (let index = 1; index <= count; index += 1) {
            const progress = index / (count + 1);
            if (horizontal) {
                lines.push({
                    x: wall.x + wall.width * 0.5,
                    y: wall.y + wall.height * progress,
                    directionX: 1,
                    directionY: 0,
                    radius: Math.max(MINIMUM_LENGTH, wall.width * 0.5),
                });
            } else {
                lines.push({
                    x: wall.x + wall.width * progress,
                    y: wall.y + wall.height * 0.5,
                    directionX: 0,
                    directionY: 1,
                    radius: Math.max(MINIMUM_LENGTH, wall.height * 0.5),
                });
            }
        }
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
}

export type { CursorSpaceWall };
