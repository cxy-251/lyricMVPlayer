import {
    cursorSpaceEscortLateralSide,
    cursorSpaceEscortWorldPosition,
} from './CursorSpaceFormation';
import {
    CursorSpaceModel as CursorSpaceCoreModel,
    type CursorSpaceWall,
} from './CursorSpaceAggressiveEnemyModel';
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

const PLAYER_MAXIMUM_TURN_RATE = 2.2;
const ESCORT_MAXIMUM_TURN_RATE = 4.8;
const ENEMY_MAXIMUM_TURN_RATES: readonly [number, number, number] = [1.4, 1.7, 2.0];
const AGGRESSIVE_STEERING_MULTIPLIER_CEILING = 2.7;
const MINIMUM_LENGTH = 0.0001;
const MAXIMUM_ESCORTS = 2;
const WALL_FIRE_PADDING = 3;
const TARGET_CORRIDOR_PADDING = 5;

interface WeaponSource {
    readonly escortIndex: number;
    readonly x: number;
    readonly y: number;
    readonly noseOffset: number;
}

interface EscortAim {
    readonly rotation: number;
    readonly targetX: number;
    readonly targetY: number;
}

export interface CursorSpaceEscortPoseTarget {
    active: boolean;
    x: number;
    y: number;
    rotation: number;
}

/**
 * Public Cursor Space gameplay boundary.
 *
 * The combat core continues to own movement, progression, collisions and fire
 * cadence. This boundary owns fleet handling and weapon-axis consistency:
 * - the main aircraft has a strict angular-velocity limit;
 * - enemy angular velocity is limited by speed tier and remains below the escort;
 * - escorts turn faster than every other aircraft and cover separate hemispheres;
 * - every projectile leaves and travels along the aircraft nose that fired it;
 * - the final player-projectile axis is rejected when a wall precedes every target.
 */
export class CursorSpaceModel {
    readonly player: CursorSpacePlayer;
    readonly stats: CursorSpaceStats;
    readonly enemies: CursorSpaceEnemy[];
    readonly projectiles: CursorSpaceProjectile[];
    readonly effects: CursorSpaceEffect[];
    readonly walls: CursorSpaceWall[];

    private readonly core: CursorSpaceCoreModel;
    private readonly config: CursorSpaceConfig;
    private readonly projectileActiveSnapshot: boolean[];
    private readonly previousEnemyRotations: number[];
    private readonly previousEnemyActive: boolean[];
    private readonly escortRotations: [number, number] = [0, 0];

    constructor(config: CursorSpaceConfig = cursorSpaceConfig) {
        this.config = config;
        this.core = new CursorSpaceCoreModel(config);
        this.player = this.core.player;
        this.stats = this.core.stats;
        this.enemies = this.core.enemies;
        this.projectiles = this.core.projectiles;
        this.effects = this.core.effects;
        this.walls = this.core.walls;
        this.projectileActiveSnapshot = new Array<boolean>(this.projectiles.length).fill(false);
        this.previousEnemyRotations = new Array<number>(this.enemies.length).fill(0);
        this.previousEnemyActive = new Array<boolean>(this.enemies.length).fill(false);
        this.resetEscortRotations();
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
        this.projectileActiveSnapshot.fill(false);
        this.previousEnemyRotations.fill(0);
        this.previousEnemyActive.fill(false);
        this.resetEscortRotations();
    }

    step(deltaTime: number): void {
        const dt = Math.max(0, Math.min(0.05, deltaTime));
        if (dt === 0) {
            return;
        }

        this.captureProjectileActivity();
        this.prepareEnemyTurnRates();
        const previousPlayerRotation = this.core.player.rotation;
        this.captureEnemyRotations();

        this.core.step(dt);

        this.limitPlayerRotation(previousPlayerRotation, dt);
        this.limitEnemyRotations(dt);
        this.updateEscortRotations(dt);
        this.finalizeNewPlayerProjectiles();
    }

    writeEscortPose(index: number, target: CursorSpaceEscortPoseTarget): void {
        const escortIndex = Math.floor(index);
        const player = this.core.player;
        if (
            !player.alive
            || escortIndex < 0
            || escortIndex >= player.escortCount
            || escortIndex >= MAXIMUM_ESCORTS
        ) {
            target.active = false;
            target.x = player.position.x;
            target.y = player.position.y;
            target.rotation = player.rotation;
            return;
        }

        const position = cursorSpaceEscortWorldPosition(player, escortIndex);
        target.active = true;
        target.x = position.x;
        target.y = position.y;
        target.rotation = this.escortRotations[escortIndex];
    }

    private prepareEnemyTurnRates(): void {
        for (const enemy of this.enemies) {
            const maximumRate = this.enemyMaximumTurnRate(enemy.speedTier);
            enemy.turnRate = maximumRate / AGGRESSIVE_STEERING_MULTIPLIER_CEILING;
        }
    }

    private captureEnemyRotations(): void {
        for (let index = 0; index < this.enemies.length; index += 1) {
            const enemy = this.enemies[index];
            this.previousEnemyActive[index] = enemy.active;
            this.previousEnemyRotations[index] = enemy.rotation;
        }
    }

    private limitPlayerRotation(previousRotation: number, dt: number): void {
        this.core.player.rotation = this.limitAngularStep(
            previousRotation,
            this.core.player.rotation,
            PLAYER_MAXIMUM_TURN_RATE * dt,
        );
    }

    private limitEnemyRotations(dt: number): void {
        for (let index = 0; index < this.enemies.length; index += 1) {
            const enemy = this.enemies[index];
            if (!enemy.active || !this.previousEnemyActive[index]) {
                continue;
            }

            enemy.rotation = this.limitAngularStep(
                this.previousEnemyRotations[index],
                enemy.rotation,
                this.enemyMaximumTurnRate(enemy.speedTier) * dt,
            );
            enemy.velocity.x = Math.cos(enemy.rotation) * enemy.movementSpeed;
            enemy.velocity.y = Math.sin(enemy.rotation) * enemy.movementSpeed;
        }
    }

    private enemyMaximumTurnRate(speedTier: 1 | 2 | 3): number {
        return ENEMY_MAXIMUM_TURN_RATES[speedTier - 1];
    }

    private resetEscortRotations(): void {
        const rotation = this.core.player.rotation;
        this.escortRotations[0] = rotation;
        this.escortRotations[1] = rotation;
    }

    private updateEscortRotations(dt: number): void {
        const player = this.core.player;
        if (!player.alive) {
            this.resetEscortRotations();
            return;
        }

        for (let index = 0; index < MAXIMUM_ESCORTS; index += 1) {
            if (index >= player.escortCount) {
                this.escortRotations[index] = player.rotation;
                continue;
            }

            const side = cursorSpaceEscortLateralSide(player, index);
            const target = this.selectEscortTarget(index, side);
            const desiredRotation = target
                ? this.predictEscortAim(index, target).rotation
                : player.rotation;
            const sectorRotation = this.clampToEscortHemisphere(
                desiredRotation,
                player.rotation,
                side,
            );
            const currentRotation = this.clampToEscortHemisphere(
                this.escortRotations[index],
                player.rotation,
                side,
            );
            const nextRotation = this.limitAngularStep(
                currentRotation,
                sectorRotation,
                ESCORT_MAXIMUM_TURN_RATE * dt,
            );
            this.escortRotations[index] = this.clampToEscortHemisphere(
                nextRotation,
                player.rotation,
                side,
            );
        }
    }

    private selectEscortTarget(
        escortIndex: number,
        side: -1 | 1,
    ): CursorSpaceEnemy | null {
        const player = this.core.player;
        const escort = cursorSpaceEscortWorldPosition(player, escortIndex);
        let bestTarget: CursorSpaceEnemy | null = null;
        let bestScore = Number.POSITIVE_INFINITY;

        for (const enemy of this.enemies) {
            if (!enemy.active) {
                continue;
            }

            const dx = enemy.position.x - escort.x;
            const dy = enemy.position.y - escort.y;
            const distance = Math.hypot(dx, dy);
            if (distance > this.config.autoAimRange) {
                continue;
            }

            const relative = this.wrapAngle(Math.atan2(dy, dx) - player.rotation);
            if ((side < 0 && relative > 0) || (side > 0 && relative < 0)) {
                continue;
            }

            const aim = this.predictEscortAim(escortIndex, enemy);
            if (!this.segmentClearOfWalls(
                escort.x,
                escort.y,
                aim.targetX,
                aim.targetY,
                this.config.projectileRadius + WALL_FIRE_PADDING,
            )) {
                continue;
            }

            const score = distance + Math.abs(relative) * 28;
            if (score < bestScore) {
                bestScore = score;
                bestTarget = enemy;
            }
        }

        return bestTarget;
    }

    private predictEscortAim(
        escortIndex: number,
        enemy: Readonly<CursorSpaceEnemy>,
    ): EscortAim {
        const escort = cursorSpaceEscortWorldPosition(this.core.player, escortIndex);
        const relativeX = enemy.position.x - escort.x;
        const relativeY = enemy.position.y - escort.y;
        const distance = Math.hypot(relativeX, relativeY);
        const time = Math.min(
            this.config.projectileLife,
            distance / Math.max(MINIMUM_LENGTH, this.config.projectileSpeed),
        );
        const targetX = enemy.position.x + enemy.velocity.x * time;
        const targetY = enemy.position.y + enemy.velocity.y * time;
        return {
            rotation: Math.atan2(targetY - escort.y, targetX - escort.x),
            targetX,
            targetY,
        };
    }

    private clampToEscortHemisphere(
        rotation: number,
        mainRotation: number,
        side: -1 | 1,
    ): number {
        let relative = this.wrapAngle(rotation - mainRotation);
        if (side < 0) {
            relative = Math.min(0, relative);
        } else {
            relative = Math.max(0, relative);
        }
        return this.wrapAngle(mainRotation + relative);
    }

    private captureProjectileActivity(): void {
        for (let index = 0; index < this.projectiles.length; index += 1) {
            this.projectileActiveSnapshot[index] = this.projectiles[index].active;
        }
    }

    private finalizeNewPlayerProjectiles(): void {
        for (let index = 0; index < this.projectiles.length; index += 1) {
            const projectile = this.projectiles[index];
            if (
                !projectile.active
                || projectile.owner !== 'player'
                || this.projectileActiveSnapshot[index]
            ) {
                continue;
            }

            const source = this.identifyWeaponSource(projectile);
            const rotation = source.escortIndex < 0
                ? this.core.player.rotation
                : this.escortRotations[source.escortIndex];
            const directionX = Math.cos(rotation);
            const directionY = Math.sin(rotation);
            const travelled = Math.max(0, projectile.travelled);

            projectile.position.x = source.x
                + directionX * (source.noseOffset + travelled);
            projectile.position.y = source.y
                + directionY * (source.noseOffset + travelled);
            projectile.velocity.x = directionX * this.config.projectileSpeed;
            projectile.velocity.y = directionY * this.config.projectileSpeed;

            if (!this.projectileCanReachEnemyBeforeWall(
                projectile.position.x,
                projectile.position.y,
                directionX,
                directionY,
                this.config.projectileSpeed * Math.max(0, projectile.life),
                projectile.radius,
            )) {
                projectile.active = false;
            }
        }
    }

    private projectileCanReachEnemyBeforeWall(
        originX: number,
        originY: number,
        directionX: number,
        directionY: number,
        maximumDistance: number,
        projectileRadius: number,
    ): boolean {
        if (!this.wallActive || maximumDistance <= 0) {
            return true;
        }

        const wallDistance = this.nearestWallDistanceAlongRay(
            originX,
            originY,
            directionX,
            directionY,
            maximumDistance,
            projectileRadius + WALL_FIRE_PADDING,
        );
        if (!Number.isFinite(wallDistance)) {
            return true;
        }

        const enemyDistance = this.nearestEnemyDistanceAlongRay(
            originX,
            originY,
            directionX,
            directionY,
            wallDistance,
            projectileRadius + TARGET_CORRIDOR_PADDING,
        );
        return enemyDistance < wallDistance;
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
        if (!this.wallActive) {
            return true;
        }

        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < MINIMUM_LENGTH) {
            return true;
        }

        return !Number.isFinite(this.nearestWallDistanceAlongRay(
            startX,
            startY,
            deltaX / distance,
            deltaY / distance,
            distance,
            padding,
        ));
    }

    private identifyWeaponSource(
        projectile: Readonly<CursorSpaceProjectile>,
    ): WeaponSource {
        const player = this.core.player;
        const candidates: WeaponSource[] = [{
            escortIndex: -1,
            x: player.position.x,
            y: player.position.y,
            noseOffset: this.config.playerNoseOffset,
        }];

        for (let index = 0; index < player.escortCount; index += 1) {
            const escort = cursorSpaceEscortWorldPosition(player, index);
            candidates.push({
                escortIndex: index,
                x: escort.x,
                y: escort.y,
                noseOffset: 9,
            });
        }

        const velocityLength = Math.hypot(projectile.velocity.x, projectile.velocity.y);
        const inheritedX = player.velocity.x * this.config.inheritedVelocity;
        const inheritedY = player.velocity.y * this.config.inheritedVelocity;
        const launchX = projectile.velocity.x - inheritedX;
        const launchY = projectile.velocity.y - inheritedY;
        const launchLength = Math.hypot(launchX, launchY);
        const directionX = launchLength > MINIMUM_LENGTH
            ? launchX / launchLength
            : velocityLength > MINIMUM_LENGTH
                ? projectile.velocity.x / velocityLength
                : Math.cos(player.rotation);
        const directionY = launchLength > MINIMUM_LENGTH
            ? launchY / launchLength
            : velocityLength > MINIMUM_LENGTH
                ? projectile.velocity.y / velocityLength
                : Math.sin(player.rotation);
        const travelTime = velocityLength > MINIMUM_LENGTH
            ? Math.max(0, projectile.travelled) / velocityLength
            : 0;

        let best = candidates[0];
        let bestError = Number.POSITIVE_INFINITY;
        for (const candidate of candidates) {
            const expectedX = candidate.x
                + directionX * candidate.noseOffset
                + projectile.velocity.x * travelTime;
            const expectedY = candidate.y
                + directionY * candidate.noseOffset
                + projectile.velocity.y * travelTime;
            const errorX = projectile.position.x - expectedX;
            const errorY = projectile.position.y - expectedY;
            const error = errorX * errorX + errorY * errorY;
            if (error < bestError) {
                bestError = error;
                best = candidate;
            }
        }
        return best;
    }

    private limitAngularStep(
        currentRotation: number,
        desiredRotation: number,
        maximumStep: number,
    ): number {
        const difference = this.wrapAngle(desiredRotation - currentRotation);
        return this.wrapAngle(
            currentRotation + this.clamp(difference, -maximumStep, maximumStep),
        );
    }

    private wrapAngle(value: number): number {
        return Math.atan2(Math.sin(value), Math.cos(value));
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.max(minimum, Math.min(maximum, value));
    }
}

export type { CursorSpaceWall };
