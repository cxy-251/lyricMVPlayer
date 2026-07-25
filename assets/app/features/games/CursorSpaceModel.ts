import {
    CURSOR_SPACE_QUEUE_ESCORT_ROTATION,
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

const ESCORT_TURN_RATE = 8.5;
const MINIMUM_LENGTH = 0.0001;
const MAXIMUM_ESCORTS = 2;

interface WeaponSource {
    readonly escortIndex: number;
    readonly x: number;
    readonly y: number;
    readonly noseOffset: number;
}

/**
 * Public Cursor Space gameplay boundary.
 *
 * The combat core continues to own movement, progression, collisions and fire
 * cadence. This boundary gives every aircraft a physically consistent weapon
 * axis:
 * - the main gun fires only along the main aircraft nose;
 * - each escort independently tracks targets in its own 180-degree hemisphere;
 * - escort shots leave and travel along that escort's current nose direction;
 * - inherited carrier velocity cannot visually bend a projectile away from the
 *   aircraft that fired it.
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
    private readonly escortRotations: [number, number] = [0, 0];
    private pendingEscortRotation: number | null = null;

    constructor(config: CursorSpaceConfig = cursorSpaceConfig) {
        this.config = config;
        this.core = new CursorSpaceCoreModel(config);
        this.stats = this.core.stats;
        this.enemies = this.core.enemies;
        this.projectiles = this.core.projectiles;
        this.effects = this.core.effects;
        this.walls = this.core.walls;
        this.projectileActiveSnapshot = new Array<boolean>(this.projectiles.length).fill(false);
        this.player = this.createPlayerRenderView(this.core.player);
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
        this.pendingEscortRotation = null;
        this.resetEscortRotations();
    }

    step(deltaTime: number): void {
        const dt = Math.max(0, Math.min(0.05, deltaTime));
        this.captureProjectileActivity();
        this.core.step(deltaTime);
        this.updateEscortRotations(dt);
        this.alignNewPlayerProjectiles();
    }

    private createPlayerRenderView(player: CursorSpacePlayer): CursorSpacePlayer {
        return new Proxy(player, {
            get: (target, property, receiver) => {
                if (property === CURSOR_SPACE_QUEUE_ESCORT_ROTATION) {
                    return (index: number): void => {
                        this.pendingEscortRotation = this.clampEscortIndex(index);
                    };
                }

                if (property === 'rotation') {
                    const escortIndex = this.pendingEscortRotation;
                    this.pendingEscortRotation = null;
                    return escortIndex === null
                        ? target.rotation
                        : this.escortRotations[escortIndex];
                }

                return Reflect.get(target, property, receiver);
            },
            set: (target, property, value, receiver) => Reflect.set(
                target,
                property,
                value,
                receiver,
            ),
        });
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
                ? this.predictEscortAim(index, target)
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
            const difference = this.wrapAngle(sectorRotation - currentRotation);
            const maximumTurn = ESCORT_TURN_RATE * dt;
            const nextRotation = this.wrapAngle(
                currentRotation + this.clamp(difference, -maximumTurn, maximumTurn),
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
    ): number {
        const escort = cursorSpaceEscortWorldPosition(this.core.player, escortIndex);
        const relativeX = enemy.position.x - escort.x;
        const relativeY = enemy.position.y - escort.y;
        const distance = Math.hypot(relativeX, relativeY);
        const time = Math.min(
            this.config.projectileLife,
            distance / Math.max(MINIMUM_LENGTH, this.config.projectileSpeed),
        );
        return Math.atan2(
            relativeY + enemy.velocity.y * time,
            relativeX + enemy.velocity.x * time,
        );
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

    private alignNewPlayerProjectiles(): void {
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
        }
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

    private clampEscortIndex(index: number): number {
        return Math.max(0, Math.min(MAXIMUM_ESCORTS - 1, Math.floor(index)));
    }

    private wrapAngle(value: number): number {
        return Math.atan2(Math.sin(value), Math.cos(value));
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.max(minimum, Math.min(maximum, value));
    }
}

export type { CursorSpaceWall };
