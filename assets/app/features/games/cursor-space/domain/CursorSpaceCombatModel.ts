import { cursorSpaceEscortWorldPosition } from './CursorSpaceFormation';
import {
    cursorSpaceConfig,
    type CursorSpaceBounds,
    type CursorSpaceConfig,
    type CursorSpaceEffect,
    type CursorSpaceEnemy,
    type CursorSpacePlayer,
    type CursorSpaceProjectile,
    type CursorSpaceProjectileOwner,
    type CursorSpaceStats,
} from './CursorSpaceTypes';

const DEFAULT_BOUNDS: CursorSpaceBounds = {
    left: -320,
    right: 320,
    bottom: -180,
    top: 180,
};

const MINIMUM_VECTOR_LENGTH = 0.0001;
const ENEMY_REMOVAL_MARGIN = 180;
const PROJECTILE_REMOVAL_MARGIN = 56;
const FRIENDLY_CLEARANCE = 34;
const FIRE_LANE_PADDING = 8;
const RESPAWN_FIRE_GRACE = 1.25;
const RESPAWN_SPAWN_GRACE = 0.65;
const PLAYER_PROJECTILE_DODGE_HORIZON = 0.82;
const ENEMY_COLLISION_HORIZON = 0.72;
const BOUNDARY_AVOIDANCE_MARGIN = 76;
const PLAYER_ATTACK_DISTANCE = 170;
const PLAYER_ATTACK_TANGENT_WEIGHT = 0.55;
const PLAYER_ATTACK_RADIAL_WEIGHT = 0.8;

interface CursorSpaceLevelProfile {
    readonly level: number;
    readonly maxActiveEnemies: number;
    readonly spawnInterval: number;
    readonly maximumSpeedTier: 1 | 2 | 3;
    readonly fastTierChance: number;
    readonly turnMultiplier: number;
    readonly shootingChance: number;
    readonly maximumFireTier: 0 | 1 | 2 | 3;
    readonly continuousFireChance: number;
    readonly projectileSpeedMultiplier: number;
    readonly healthMultiplier: number;
    readonly maximumEnemyProjectiles: number;
    readonly globalFireInterval: number;
}

export interface CursorSpaceEnemyThreat {
    readonly x: number;
    readonly y: number;
    readonly threat: number;
}

type ThreatVector = CursorSpaceEnemyThreat;

export interface CursorSpaceEnemyBehaviorContext {
    readonly config: Readonly<CursorSpaceConfig>;
    readonly bounds: Readonly<CursorSpaceBounds>;
    readonly player: CursorSpacePlayer;
    readonly enemies: CursorSpaceEnemy[];
    readonly projectiles: CursorSpaceProjectile[];

    playerProjectileThreat(enemy: Readonly<CursorSpaceEnemy>): CursorSpaceEnemyThreat;
    enemyCollisionThreat(
        enemyIndex: number,
        enemy: Readonly<CursorSpaceEnemy>,
    ): CursorSpaceEnemyThreat;
    boundaryThreat(enemy: Readonly<CursorSpaceEnemy>): CursorSpaceEnemyThreat;
    friendlySeparationThreat(
        enemyIndex: number,
        enemy: Readonly<CursorSpaceEnemy>,
    ): CursorSpaceEnemyThreat;
    clearProjectilesFromEnemy(enemyIndex: number): void;
}

export interface CursorSpaceEnemyBehavior {
    updateEnemies(context: CursorSpaceEnemyBehaviorContext, dt: number): void;
    blocksFriendlyFireLane?(
        context: CursorSpaceEnemyBehaviorContext,
        enemyIndex: number,
        rotation: number,
    ): boolean;
}

interface EnemyFireCandidate {
    readonly enemyIndex: number;
    readonly distanceSquared: number;
}

type EnemyDestroyCause =
    | 'player-projectile'
    | 'player-collision'
    | 'enemy-collision'
    | 'respawn-clear';

type PlayerDamageCause = 'enemy-collision' | 'enemy-projectile';

const BASE_LEVELS: readonly CursorSpaceLevelProfile[] = [
    {
        level: 1,
        maxActiveEnemies: 7,
        spawnInterval: 1.02,
        maximumSpeedTier: 1,
        fastTierChance: 0,
        turnMultiplier: 0.92,
        shootingChance: 0,
        maximumFireTier: 0,
        continuousFireChance: 0,
        projectileSpeedMultiplier: 0.9,
        healthMultiplier: 1,
        maximumEnemyProjectiles: 0,
        globalFireInterval: 1,
    },
    {
        level: 2,
        maxActiveEnemies: 9,
        spawnInterval: 0.86,
        maximumSpeedTier: 1,
        fastTierChance: 0,
        turnMultiplier: 0.98,
        shootingChance: 0.18,
        maximumFireTier: 1,
        continuousFireChance: 0,
        projectileSpeedMultiplier: 0.96,
        healthMultiplier: 1,
        maximumEnemyProjectiles: 5,
        globalFireInterval: 0.52,
    },
    {
        level: 3,
        maxActiveEnemies: 11,
        spawnInterval: 0.72,
        maximumSpeedTier: 2,
        fastTierChance: 0.3,
        turnMultiplier: 1.04,
        shootingChance: 0.42,
        maximumFireTier: 1,
        continuousFireChance: 0,
        projectileSpeedMultiplier: 1.02,
        healthMultiplier: 1.08,
        maximumEnemyProjectiles: 9,
        globalFireInterval: 0.34,
    },
    {
        level: 4,
        maxActiveEnemies: 14,
        spawnInterval: 0.58,
        maximumSpeedTier: 2,
        fastTierChance: 0.62,
        turnMultiplier: 1.12,
        shootingChance: 0.66,
        maximumFireTier: 2,
        continuousFireChance: 0,
        projectileSpeedMultiplier: 1.1,
        healthMultiplier: 1.18,
        maximumEnemyProjectiles: 14,
        globalFireInterval: 0.24,
    },
    {
        level: 5,
        maxActiveEnemies: 17,
        spawnInterval: 0.48,
        maximumSpeedTier: 3,
        fastTierChance: 0.28,
        turnMultiplier: 1.2,
        shootingChance: 0.78,
        maximumFireTier: 2,
        continuousFireChance: 0,
        projectileSpeedMultiplier: 1.18,
        healthMultiplier: 1.28,
        maximumEnemyProjectiles: 18,
        globalFireInterval: 0.19,
    },
    {
        level: 6,
        maxActiveEnemies: 20,
        spawnInterval: 0.4,
        maximumSpeedTier: 3,
        fastTierChance: 0.48,
        turnMultiplier: 1.28,
        shootingChance: 0.86,
        maximumFireTier: 3,
        continuousFireChance: 0.22,
        projectileSpeedMultiplier: 1.26,
        healthMultiplier: 1.38,
        maximumEnemyProjectiles: 22,
        globalFireInterval: 0.15,
    },
    {
        level: 7,
        maxActiveEnemies: 23,
        spawnInterval: 0.35,
        maximumSpeedTier: 3,
        fastTierChance: 0.66,
        turnMultiplier: 1.35,
        shootingChance: 0.92,
        maximumFireTier: 3,
        continuousFireChance: 0.42,
        projectileSpeedMultiplier: 1.32,
        healthMultiplier: 1.48,
        maximumEnemyProjectiles: 26,
        globalFireInterval: 0.125,
    },
    {
        level: 8,
        maxActiveEnemies: 26,
        spawnInterval: 0.31,
        maximumSpeedTier: 3,
        fastTierChance: 0.8,
        turnMultiplier: 1.42,
        shootingChance: 0.96,
        maximumFireTier: 3,
        continuousFireChance: 0.62,
        projectileSpeedMultiplier: 1.38,
        healthMultiplier: 1.58,
        maximumEnemyProjectiles: 30,
        globalFireInterval: 0.105,
    },
];

export class CursorSpaceModel {
    readonly player: CursorSpacePlayer = {
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        rotation: 0,
        alive: true,
        respawnRemaining: 0,
        invulnerableRemaining: 0,
        health: cursorSpaceConfig.playerMaximumHealth,
        maximumHealth: cursorSpaceConfig.playerMaximumHealth,
        throttle: 0.45,
        escortCount: 0,
        escortSide: 1,
        fireSupportLevel: 0,
    };

    readonly stats: CursorSpaceStats = {
        level: 1,
        enemiesDestroyed: 0,
        enemiesDestroyedByPlayer: 0,
        playerDeaths: 0,
    };

    readonly enemies: CursorSpaceEnemy[];
    readonly projectiles: CursorSpaceProjectile[];
    readonly effects: CursorSpaceEffect[];

    private bounds: CursorSpaceBounds = { ...DEFAULT_BOUNDS };
    private readonly target = { x: 0, y: 0 };
    private readonly enemyBehaviorContext: CursorSpaceEnemyBehaviorContext;
    private enemyBehavior: CursorSpaceEnemyBehavior | null = null;
    private targetActive = false;
    private directControl = false;
    private aimTarget: CursorSpaceEnemy | null = null;
    private enemySpawnRemaining = 0;
    private playerFireRemaining = 0;
    private enemyGlobalFireRemaining = 0;
    private enemyCeaseFireRemaining = 0;
    private enemySpawnGraceRemaining = 0;
    private spawnSerial = 0;
    private enemyFireCursor = 0;

    constructor(private readonly config: CursorSpaceConfig = cursorSpaceConfig) {
        this.player.maximumHealth = config.playerMaximumHealth;
        this.player.health = config.playerMaximumHealth;
        this.enemies = Array.from({ length: config.enemyCapacity }, () => ({
            active: false,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            rotation: 0,
            radius: config.enemyRadius,
            dodgeSide: 1 as const,
            threat: 0,
            spawnLevel: 1,
            speedTier: 1 as const,
            fireTier: 0 as const,
            movementSpeed: config.enemySpeedTiers[0],
            turnRate: config.enemyTurnRate,
            health: config.enemyHealthTiers[0],
            maximumHealth: config.enemyHealthTiers[0],
            shootingEnabled: false,
            fireRemaining: 0,
            fireInterval: Number.POSITIVE_INFINITY,
            burstRemaining: 0,
            projectileSpeed: config.enemyProjectileSpeed,
        }));
        this.projectiles = Array.from({ length: config.projectileCapacity }, () => ({
            active: false,
            owner: 'player' as const,
            sourceEnemyIndex: -1,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            life: 0,
            radius: config.projectileRadius,
            damage: 1,
            travelled: 0,
        }));
        this.effects = Array.from({ length: config.effectCapacity }, () => ({
            active: false,
            kind: 'fragment' as const,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            life: 0,
            initialLife: 0,
            radius: 0,
        }));

        const model = this;
        this.enemyBehaviorContext = {
            config: this.config,
            get bounds(): Readonly<CursorSpaceBounds> {
                return model.bounds;
            },
            player: this.player,
            enemies: this.enemies,
            projectiles: this.projectiles,
            playerProjectileThreat: (enemy) => this.playerProjectileThreat(enemy),
            enemyCollisionThreat: (enemyIndex, enemy) => (
                this.enemyCollisionThreat(enemyIndex, enemy)
            ),
            boundaryThreat: (enemy) => this.boundaryThreat(enemy),
            friendlySeparationThreat: (enemyIndex, enemy) => (
                this.friendlySeparationThreat(enemyIndex, enemy)
            ),
            clearProjectilesFromEnemy: (enemyIndex) => {
                this.clearProjectilesFromEnemy(enemyIndex);
            },
        };
        this.enemyBehavior = config.enemyBehavior ?? null;
        this.reset();
    }

    get currentBounds(): Readonly<CursorSpaceBounds> {
        return this.bounds;
    }

    setBounds(bounds: CursorSpaceBounds): void {
        if (
            !Number.isFinite(bounds.left)
            || !Number.isFinite(bounds.right)
            || !Number.isFinite(bounds.bottom)
            || !Number.isFinite(bounds.top)
            || bounds.right <= bounds.left
            || bounds.top <= bounds.bottom
        ) {
            throw new Error('Cursor Space requires valid play bounds');
        }

        this.bounds = { ...bounds };
        this.clampPlayerToBounds();
        this.target.x = this.clamp(this.target.x, bounds.left, bounds.right);
        this.target.y = this.clamp(this.target.y, bounds.bottom, bounds.top);
    }

    setTarget(x: number, y: number, throttle?: number): void {
        if (
            !Number.isFinite(x)
            || !Number.isFinite(y)
            || (throttle !== undefined && !Number.isFinite(throttle))
        ) {
            return;
        }

        this.target.x = this.clamp(x, this.bounds.left, this.bounds.right);
        this.target.y = this.clamp(y, this.bounds.bottom, this.bounds.top);
        this.directControl = throttle === undefined;
        this.player.throttle = this.directControl
            ? 1
            : this.clamp(throttle ?? 1, 0.08, 1);
        this.targetActive = true;
    }

    clearTarget(): void {
        this.targetActive = false;
        this.directControl = false;
    }

    setEnemyBehavior(behavior: CursorSpaceEnemyBehavior | null): void {
        this.enemyBehavior = behavior;
    }

    reset(): void {
        this.enemySpawnRemaining = 0.45;
        this.playerFireRemaining = 0;
        this.enemyGlobalFireRemaining = 0;
        this.enemyCeaseFireRemaining = 0;
        this.enemySpawnGraceRemaining = 0;
        this.spawnSerial = 0;
        this.enemyFireCursor = 0;
        this.targetActive = false;
        this.directControl = false;
        this.aimTarget = null;
        this.stats.level = 1;
        this.stats.enemiesDestroyed = 0;
        this.stats.enemiesDestroyedByPlayer = 0;
        this.stats.playerDeaths = 0;

        for (const enemy of this.enemies) {
            enemy.active = false;
            enemy.health = 0;
            enemy.threat = 0;
            enemy.shootingEnabled = false;
            enemy.fireRemaining = 0;
            enemy.burstRemaining = 0;
        }
        for (const projectile of this.projectiles) {
            projectile.active = false;
            projectile.travelled = 0;
        }
        for (const effect of this.effects) {
            effect.active = false;
        }

        this.player.position.x = (this.bounds.left + this.bounds.right) / 2;
        this.player.position.y = (this.bounds.bottom + this.bounds.top) / 2;
        this.player.velocity.x = 0;
        this.player.velocity.y = 0;
        this.player.rotation = 0;
        this.player.alive = true;
        this.player.respawnRemaining = 0;
        this.player.invulnerableRemaining = 0;
        this.player.maximumHealth = this.config.playerMaximumHealth;
        this.player.health = this.player.maximumHealth;
        this.player.throttle = 0.45;
        this.player.escortCount = 0;
        this.player.escortSide = 1;
        this.player.fireSupportLevel = 0;
    }

    step(deltaTime: number): void {
        const dt = Math.max(0, Math.min(0.05, deltaTime));
        if (dt === 0) {
            return;
        }

        this.updateEffects(dt);
        this.updateRespawn(dt);
        this.enemyGlobalFireRemaining = Math.max(0, this.enemyGlobalFireRemaining - dt);
        this.enemyCeaseFireRemaining = Math.max(0, this.enemyCeaseFireRemaining - dt);
        this.enemySpawnGraceRemaining = Math.max(0, this.enemySpawnGraceRemaining - dt);

        if (this.player.alive) {
            this.updatePlayer(dt);
            this.updateAim(dt);
            this.updatePlayerAutomaticFire(dt);
        }

        if (this.enemyBehavior) {
            this.enemyBehavior.updateEnemies(this.enemyBehaviorContext, dt);
        } else {
            this.updateEnemies(dt);
        }
        this.updateEnemyAutomaticFire(dt);
        this.updateProjectiles(dt);
        this.resolveEnemyContacts();
        this.resolveProjectileCollisions();
        this.resolvePlayerCollisions();
        this.cleanupOrphanedEnemyProjectiles();
        this.updateEnemySpawning(dt);

        if (!this.player.alive || this.countActiveEnemies() === 0) {
            this.clearEnemyProjectiles();
        }
    }

    private updatePlayer(dt: number): void {
        const player = this.player;
        player.invulnerableRemaining = Math.max(0, player.invulnerableRemaining - dt);

        if (this.directControl) {
            const previousX = player.position.x;
            const previousY = player.position.y;
            if (this.targetActive) {
                const dx = this.target.x - player.position.x;
                const dy = this.target.y - player.position.y;
                const distance = Math.hypot(dx, dy);
                if (distance > 0.25) {
                    const movement = Math.min(this.config.playerMaximumSpeed * dt, distance);
                    player.position.x += dx / distance * movement;
                    player.position.y += dy / distance * movement;
                }
            }
            player.velocity.x = (player.position.x - previousX) / dt;
            player.velocity.y = (player.position.y - previousY) / dt;
            this.clampPlayerToBounds();
            return;
        }

        let desiredVelocityX = 0;
        let desiredVelocityY = 0;
        if (this.targetActive) {
            const dx = this.target.x - player.position.x;
            const dy = this.target.y - player.position.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 0.25) {
                const maximumSpeed = this.config.playerMaximumSpeed * player.throttle;
                const desiredSpeed = Math.min(maximumSpeed, distance * this.config.playerFollowResponse);
                desiredVelocityX = dx / distance * desiredSpeed;
                desiredVelocityY = dy / distance * desiredSpeed;
            }
        }

        const currentSpeed = Math.hypot(player.velocity.x, player.velocity.y);
        const desiredSpeed = Math.hypot(desiredVelocityX, desiredVelocityY);
        const acceleration = desiredSpeed >= currentSpeed
            ? this.config.playerAcceleration
            : this.config.playerDeceleration;
        const differenceX = desiredVelocityX - player.velocity.x;
        const differenceY = desiredVelocityY - player.velocity.y;
        const differenceLength = Math.hypot(differenceX, differenceY);
        const maximumChange = acceleration * dt;

        if (differenceLength <= maximumChange || differenceLength < MINIMUM_VECTOR_LENGTH) {
            player.velocity.x = desiredVelocityX;
            player.velocity.y = desiredVelocityY;
        } else {
            player.velocity.x += differenceX / differenceLength * maximumChange;
            player.velocity.y += differenceY / differenceLength * maximumChange;
        }

        player.position.x += player.velocity.x * dt;
        player.position.y += player.velocity.y * dt;
        this.clampPlayerToBounds();
    }

    private updateAim(dt: number): void {
        this.aimTarget = this.findNearestEnemy();
        let desiredRotation: number | null = null;

        if (this.aimTarget) {
            desiredRotation = this.interceptRotation(
                this.player.position.x,
                this.player.position.y,
                this.player.velocity.x * this.config.inheritedVelocity,
                this.player.velocity.y * this.config.inheritedVelocity,
                this.aimTarget.position.x,
                this.aimTarget.position.y,
                this.aimTarget.velocity.x,
                this.aimTarget.velocity.y,
                this.config.projectileSpeed,
                this.config.projectileLife,
            );
        } else if (Math.hypot(this.player.velocity.x, this.player.velocity.y) > 8) {
            desiredRotation = Math.atan2(this.player.velocity.y, this.player.velocity.x);
        }

        if (desiredRotation === null) {
            return;
        }

        const response = 1 - Math.exp(-this.config.playerAimResponse * dt);
        const difference = this.wrapAngle(desiredRotation - this.player.rotation);
        this.player.rotation = this.wrapAngle(this.player.rotation + difference * response);
    }

    private updatePlayerAutomaticFire(dt: number): void {
        this.playerFireRemaining = Math.max(0, this.playerFireRemaining - dt);
        const target = this.aimTarget;
        if (this.playerFireRemaining > 0 || !target?.active) {
            return;
        }

        const desiredRotation = this.interceptRotation(
            this.player.position.x,
            this.player.position.y,
            this.player.velocity.x * this.config.inheritedVelocity,
            this.player.velocity.y * this.config.inheritedVelocity,
            target.position.x,
            target.position.y,
            target.velocity.x,
            target.velocity.y,
            this.config.projectileSpeed,
            this.config.projectileLife,
        );
        const error = Math.abs(this.wrapAngle(desiredRotation - this.player.rotation));
        if (error > this.config.autoFireTolerance) {
            return;
        }

        let fired = this.spawnProjectile(
            'player',
            -1,
            this.player.position.x,
            this.player.position.y,
            this.player.rotation,
            this.player.velocity.x,
            this.player.velocity.y,
            this.config.projectileSpeed,
            this.config.projectileLife,
            this.config.projectileRadius,
            this.config.playerProjectileDamage,
            this.config.playerNoseOffset,
            this.config.inheritedVelocity,
        );

        for (let index = 0; index < this.player.escortCount; index += 1) {
            const escort = cursorSpaceEscortWorldPosition(this.player, index);
            fired = this.spawnProjectile(
                'player',
                -1,
                escort.x,
                escort.y,
                this.player.rotation,
                this.player.velocity.x,
                this.player.velocity.y,
                this.config.projectileSpeed,
                this.config.projectileLife,
                this.config.projectileRadius,
                this.config.playerProjectileDamage,
                9,
                this.config.inheritedVelocity,
            ) || fired;
        }

        if (fired) {
            this.playerFireRemaining = Math.max(
                this.config.minimumFleetFireInterval,
                this.config.fireInterval
                    / (1 + this.player.fireSupportLevel * this.config.fireSupportDensityPerLevel),
            );
        }
    }

    private updateEnemies(dt: number): void {
        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
            const enemy = this.enemies[enemyIndex];
            if (!enemy.active) {
                continue;
            }

            const projectileThreat = this.playerProjectileThreat(enemy);
            const collisionThreat = this.enemyCollisionThreat(enemyIndex, enemy);
            const boundaryThreat = this.boundaryThreat(enemy);
            const friendlyThreat = this.friendlySeparationThreat(enemyIndex, enemy);
            const pursuit = this.playerPursuitDirection(enemy);

            let desiredX: number;
            let desiredY: number;
            let priorityThreat: number;

            const survivalThreat = Math.max(
                projectileThreat.threat,
                collisionThreat.threat,
                boundaryThreat.threat,
            );
            if (survivalThreat > 0.045) {
                desiredX = projectileThreat.x * 4.8
                    + collisionThreat.x * 3.8
                    + boundaryThreat.x * 3.2;
                desiredY = projectileThreat.y * 4.8
                    + collisionThreat.y * 3.8
                    + boundaryThreat.y * 3.2;
                priorityThreat = survivalThreat;
            } else if (friendlyThreat.threat > 0.035) {
                desiredX = friendlyThreat.x * 4.2 + pursuit.x * 0.28;
                desiredY = friendlyThreat.y * 4.2 + pursuit.y * 0.28;
                priorityThreat = friendlyThreat.threat;
            } else {
                desiredX = pursuit.x;
                desiredY = pursuit.y;
                priorityThreat = 0;
            }

            const desired = this.normalizedVector(desiredX, desiredY, enemy.rotation);
            const desiredRotation = Math.atan2(desired.y, desired.x);
            const maximumTurn = enemy.turnRate * (1 + priorityThreat * 2.2) * dt;
            const difference = this.wrapAngle(desiredRotation - enemy.rotation);
            enemy.rotation = this.wrapAngle(
                enemy.rotation + this.clamp(difference, -maximumTurn, maximumTurn),
            );
            enemy.threat += (priorityThreat - enemy.threat) * (1 - Math.exp(-10 * dt));
            enemy.velocity.x = Math.cos(enemy.rotation) * enemy.movementSpeed;
            enemy.velocity.y = Math.sin(enemy.rotation) * enemy.movementSpeed;
            enemy.position.x += enemy.velocity.x * dt;
            enemy.position.y += enemy.velocity.y * dt;

            if (
                !Number.isFinite(enemy.position.x)
                || !Number.isFinite(enemy.position.y)
                || enemy.position.x < this.bounds.left - ENEMY_REMOVAL_MARGIN
                || enemy.position.x > this.bounds.right + ENEMY_REMOVAL_MARGIN
                || enemy.position.y < this.bounds.bottom - ENEMY_REMOVAL_MARGIN
                || enemy.position.y > this.bounds.top + ENEMY_REMOVAL_MARGIN
            ) {
                enemy.active = false;
                this.clearProjectilesFromEnemy(enemyIndex);
            }
        }
    }

    private playerProjectileThreat(enemy: Readonly<CursorSpaceEnemy>): ThreatVector {
        let avoidanceX = 0;
        let avoidanceY = 0;
        let threat = 0;

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

            const approach = relativeX * relativeVelocityX + relativeY * relativeVelocityY;
            if (approach >= 0) {
                continue;
            }

            const time = Math.min(PLAYER_PROJECTILE_DODGE_HORIZON, -approach / speedSquared);
            const closestX = relativeX + relativeVelocityX * time;
            const closestY = relativeY + relativeVelocityY * time;
            const distance = Math.hypot(closestX, closestY);
            const dangerRadius = enemy.radius + projectile.radius + 54;
            if (distance >= dangerRadius) {
                continue;
            }

            const pressure = 1 - distance / dangerRadius;
            const side = Math.sign(
                relativeVelocityX * relativeY - relativeVelocityY * relativeX,
            ) || enemy.dodgeSide;
            const velocityLength = Math.sqrt(speedSquared);
            avoidanceX += -relativeVelocityY / velocityLength * side * pressure;
            avoidanceY += relativeVelocityX / velocityLength * side * pressure;
            threat = Math.max(
                threat,
                pressure * (1 - time / PLAYER_PROJECTILE_DODGE_HORIZON * 0.45),
            );
        }

        const normalized = this.normalizedVector(avoidanceX, avoidanceY, enemy.rotation);
        return { x: normalized.x, y: normalized.y, threat };
    }

    private enemyCollisionThreat(
        enemyIndex: number,
        enemy: Readonly<CursorSpaceEnemy>,
    ): ThreatVector {
        let avoidanceX = 0;
        let avoidanceY = 0;
        let threat = 0;

        for (let otherIndex = 0; otherIndex < this.enemies.length; otherIndex += 1) {
            if (otherIndex === enemyIndex) {
                continue;
            }
            const other = this.enemies[otherIndex];
            if (!other.active) {
                continue;
            }

            const relativeX = other.position.x - enemy.position.x;
            const relativeY = other.position.y - enemy.position.y;
            const relativeVelocityX = other.velocity.x - enemy.velocity.x;
            const relativeVelocityY = other.velocity.y - enemy.velocity.y;
            const closest = this.closestApproach(
                relativeX,
                relativeY,
                relativeVelocityX,
                relativeVelocityY,
                ENEMY_COLLISION_HORIZON,
            );
            const dangerRadius = enemy.radius + other.radius + 20;
            if (closest.distance >= dangerRadius) {
                continue;
            }

            const pressure = 1 - closest.distance / dangerRadius;
            const distance = Math.max(MINIMUM_VECTOR_LENGTH, Math.hypot(relativeX, relativeY));
            avoidanceX -= relativeX / distance * pressure;
            avoidanceY -= relativeY / distance * pressure;
            threat = Math.max(threat, pressure * (1 - closest.time / ENEMY_COLLISION_HORIZON * 0.4));
        }

        const normalized = this.normalizedVector(avoidanceX, avoidanceY, enemy.rotation);
        return { x: normalized.x, y: normalized.y, threat };
    }

    private boundaryThreat(enemy: Readonly<CursorSpaceEnemy>): ThreatVector {
        let x = 0;
        let y = 0;
        let threat = 0;
        const left = enemy.position.x - this.bounds.left;
        const right = this.bounds.right - enemy.position.x;
        const bottom = enemy.position.y - this.bounds.bottom;
        const top = this.bounds.top - enemy.position.y;

        if (left < BOUNDARY_AVOIDANCE_MARGIN) {
            const pressure = 1 - left / BOUNDARY_AVOIDANCE_MARGIN;
            x += pressure;
            threat = Math.max(threat, pressure);
        }
        if (right < BOUNDARY_AVOIDANCE_MARGIN) {
            const pressure = 1 - right / BOUNDARY_AVOIDANCE_MARGIN;
            x -= pressure;
            threat = Math.max(threat, pressure);
        }
        if (bottom < BOUNDARY_AVOIDANCE_MARGIN) {
            const pressure = 1 - bottom / BOUNDARY_AVOIDANCE_MARGIN;
            y += pressure;
            threat = Math.max(threat, pressure);
        }
        if (top < BOUNDARY_AVOIDANCE_MARGIN) {
            const pressure = 1 - top / BOUNDARY_AVOIDANCE_MARGIN;
            y -= pressure;
            threat = Math.max(threat, pressure);
        }

        const normalized = this.normalizedVector(x, y, enemy.rotation);
        return { x: normalized.x, y: normalized.y, threat };
    }

    private friendlySeparationThreat(
        enemyIndex: number,
        enemy: Readonly<CursorSpaceEnemy>,
    ): ThreatVector {
        let x = 0;
        let y = 0;
        let threat = 0;

        for (let otherIndex = 0; otherIndex < this.enemies.length; otherIndex += 1) {
            if (otherIndex === enemyIndex) {
                continue;
            }
            const other = this.enemies[otherIndex];
            if (!other.active) {
                continue;
            }
            const dx = enemy.position.x - other.position.x;
            const dy = enemy.position.y - other.position.y;
            const distance = Math.hypot(dx, dy);
            const desiredDistance = enemy.radius + other.radius + FRIENDLY_CLEARANCE;
            if (distance >= desiredDistance || distance < MINIMUM_VECTOR_LENGTH) {
                continue;
            }
            const pressure = 1 - distance / desiredDistance;
            x += dx / distance * pressure;
            y += dy / distance * pressure;
            threat = Math.max(threat, pressure);
        }

        const normalized = this.normalizedVector(x, y, enemy.rotation);
        return { x: normalized.x, y: normalized.y, threat };
    }

    private playerPursuitDirection(enemy: Readonly<CursorSpaceEnemy>): ThreatVector {
        if (!this.player.alive) {
            return {
                x: Math.cos(enemy.rotation),
                y: Math.sin(enemy.rotation),
                threat: 0,
            };
        }

        const dx = this.player.position.x - enemy.position.x;
        const dy = this.player.position.y - enemy.position.y;
        const distance = Math.max(MINIMUM_VECTOR_LENGTH, Math.hypot(dx, dy));
        const radialX = dx / distance;
        const radialY = dy / distance;
        const tangentSide = enemy.dodgeSide;
        const tangentX = -radialY * tangentSide;
        const tangentY = radialX * tangentSide;
        const radialWeight = this.clamp(
            (distance - PLAYER_ATTACK_DISTANCE) / PLAYER_ATTACK_DISTANCE,
            -0.5,
            1.1,
        );
        const normalized = this.normalizedVector(
            radialX * radialWeight * PLAYER_ATTACK_RADIAL_WEIGHT
                + tangentX * PLAYER_ATTACK_TANGENT_WEIGHT,
            radialY * radialWeight * PLAYER_ATTACK_RADIAL_WEIGHT
                + tangentY * PLAYER_ATTACK_TANGENT_WEIGHT,
            enemy.rotation,
        );
        return { x: normalized.x, y: normalized.y, threat: 0 };
    }

    private updateEnemyAutomaticFire(dt: number): void {
        for (const enemy of this.enemies) {
            if (enemy.active) {
                enemy.fireRemaining = Math.max(0, enemy.fireRemaining - dt);
            }
        }

        if (
            !this.player.alive
            || this.enemyCeaseFireRemaining > 0
            || this.enemyGlobalFireRemaining > 0
        ) {
            return;
        }

        const profile = this.levelProfile(this.stats.level);
        if (profile.maximumEnemyProjectiles <= 0) {
            return;
        }
        if (this.countActiveEnemyProjectiles() >= profile.maximumEnemyProjectiles) {
            return;
        }

        const candidates: EnemyFireCandidate[] = [];
        for (let offset = 0; offset < this.enemies.length; offset += 1) {
            const enemyIndex = (this.enemyFireCursor + offset) % this.enemies.length;
            const enemy = this.enemies[enemyIndex];
            if (
                !enemy.active
                || !enemy.shootingEnabled
                || enemy.fireTier === 0
                || enemy.fireRemaining > 0
                || enemy.threat > 0.2
                || this.countEnemyProjectilesFrom(enemyIndex) >= this.projectileLimitForTier(enemy.fireTier)
            ) {
                continue;
            }

            const dx = this.player.position.x - enemy.position.x;
            const dy = this.player.position.y - enemy.position.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared > this.config.enemyFireRange * this.config.enemyFireRange) {
                continue;
            }
            candidates.push({ enemyIndex, distanceSquared });
        }

        candidates.sort((first, second) => first.distanceSquared - second.distanceSquared);
        for (const candidate of candidates) {
            const enemy = this.enemies[candidate.enemyIndex];
            const rotation = this.interceptRotation(
                enemy.position.x,
                enemy.position.y,
                enemy.velocity.x,
                enemy.velocity.y,
                this.player.position.x,
                this.player.position.y,
                this.player.velocity.x,
                this.player.velocity.y,
                enemy.projectileSpeed,
                Math.min(this.config.enemyProjectileLife, 2.05),
            );
            const error = Math.abs(this.wrapAngle(rotation - enemy.rotation));
            if (error > this.config.enemyFireTolerance) {
                continue;
            }
            if (this.hasFriendlyInFireLane(candidate.enemyIndex, rotation)) {
                enemy.fireRemaining = Math.max(enemy.fireRemaining, 0.16);
                continue;
            }

            const damage = enemy.fireTier === 3
                ? this.config.enemyTierThreeProjectileDamage
                : this.config.enemyProjectileDamage;
            const fired = this.spawnProjectile(
                'enemy',
                candidate.enemyIndex,
                enemy.position.x,
                enemy.position.y,
                rotation,
                enemy.velocity.x,
                enemy.velocity.y,
                enemy.projectileSpeed,
                Math.min(this.config.enemyProjectileLife, 2.05),
                this.config.enemyProjectileRadius,
                damage,
                this.config.enemyProjectileNoseOffset,
                0.1,
            );
            if (!fired) {
                return;
            }

            this.enemyFireCursor = (candidate.enemyIndex + 1) % this.enemies.length;
            this.enemyGlobalFireRemaining = profile.globalFireInterval;
            this.scheduleEnemyNextShot(enemy);
            return;
        }
    }

    private scheduleEnemyNextShot(enemy: CursorSpaceEnemy): void {
        if (enemy.fireTier === 1) {
            enemy.fireRemaining = this.config.enemyTierOneFireInterval
                * (0.9 + Math.random() * 0.25);
            enemy.burstRemaining = 0;
            return;
        }

        if (enemy.fireTier === 2) {
            const burstSize = Math.min(3, this.config.enemyTierTwoBurstSize);
            if (enemy.burstRemaining <= 0) {
                enemy.burstRemaining = burstSize - 1;
            } else {
                enemy.burstRemaining -= 1;
            }
            enemy.fireRemaining = enemy.burstRemaining > 0
                ? Math.max(0.16, this.config.enemyTierTwoBurstInterval)
                : Math.max(0.78, this.config.enemyTierTwoCooldown);
            return;
        }

        enemy.burstRemaining = 0;
        enemy.fireRemaining = Math.max(0.13, this.config.enemyTierThreeFireInterval);
    }

    private hasFriendlyInFireLane(enemyIndex: number, rotation: number): boolean {
        const override = this.enemyBehavior?.blocksFriendlyFireLane;
        if (override) {
            return override(this.enemyBehaviorContext, enemyIndex, rotation);
        }

        const shooter = this.enemies[enemyIndex];
        const directionX = Math.cos(rotation);
        const directionY = Math.sin(rotation);
        const playerDx = this.player.position.x - shooter.position.x;
        const playerDy = this.player.position.y - shooter.position.y;
        const playerDistance = Math.hypot(playerDx, playerDy);

        for (let otherIndex = 0; otherIndex < this.enemies.length; otherIndex += 1) {
            if (otherIndex === enemyIndex) {
                continue;
            }
            const other = this.enemies[otherIndex];
            if (!other.active) {
                continue;
            }

            const dx = other.position.x - shooter.position.x;
            const dy = other.position.y - shooter.position.y;
            const forward = dx * directionX + dy * directionY;
            if (forward <= 0 || forward >= playerDistance + other.radius) {
                continue;
            }
            const perpendicular = Math.abs(dx * directionY - dy * directionX);
            if (perpendicular <= other.radius + this.config.enemyProjectileRadius + FIRE_LANE_PADDING) {
                return true;
            }
        }
        return false;
    }

    private resolveEnemyContacts(): void {
        for (let firstIndex = 0; firstIndex < this.enemies.length; firstIndex += 1) {
            const first = this.enemies[firstIndex];
            if (!first.active) {
                continue;
            }
            for (let secondIndex = firstIndex + 1; secondIndex < this.enemies.length; secondIndex += 1) {
                const second = this.enemies[secondIndex];
                if (!second.active) {
                    continue;
                }

                const dx = second.position.x - first.position.x;
                const dy = second.position.y - first.position.y;
                const distance = Math.hypot(dx, dy);
                const minimumDistance = first.radius + second.radius;
                if (distance >= minimumDistance) {
                    continue;
                }

                const safeDistance = Math.max(MINIMUM_VECTOR_LENGTH, distance);
                const normalX = dx / safeDistance;
                const normalY = dy / safeDistance;
                const overlap = minimumDistance - safeDistance + 0.5;
                first.position.x -= normalX * overlap * 0.5;
                first.position.y -= normalY * overlap * 0.5;
                second.position.x += normalX * overlap * 0.5;
                second.position.y += normalY * overlap * 0.5;
                first.rotation = this.wrapAngle(first.rotation - first.dodgeSide * 0.18);
                second.rotation = this.wrapAngle(second.rotation - second.dodgeSide * 0.18);
            }
        }
    }

    private updateProjectiles(dt: number): void {
        for (const projectile of this.projectiles) {
            if (!projectile.active) {
                continue;
            }

            projectile.life -= dt;
            const movementX = projectile.velocity.x * dt;
            const movementY = projectile.velocity.y * dt;
            projectile.position.x += movementX;
            projectile.position.y += movementY;
            projectile.travelled += Math.hypot(movementX, movementY);

            if (
                projectile.life <= 0
                || projectile.position.x < this.bounds.left - PROJECTILE_REMOVAL_MARGIN
                || projectile.position.x > this.bounds.right + PROJECTILE_REMOVAL_MARGIN
                || projectile.position.y < this.bounds.bottom - PROJECTILE_REMOVAL_MARGIN
                || projectile.position.y > this.bounds.top + PROJECTILE_REMOVAL_MARGIN
            ) {
                projectile.active = false;
            }
        }
    }

    private resolveProjectileCollisions(): void {
        for (const projectile of this.projectiles) {
            if (!projectile.active) {
                continue;
            }
            if (projectile.owner === 'player') {
                this.resolvePlayerProjectile(projectile);
            } else {
                this.resolveEnemyProjectile(projectile);
            }
        }
    }

    private resolvePlayerProjectile(projectile: CursorSpaceProjectile): void {
        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
            const enemy = this.enemies[enemyIndex];
            if (!enemy.active || !this.projectileHitsEnemy(projectile, enemy)) {
                continue;
            }
            projectile.active = false;
            this.damageEnemy(enemyIndex, enemy, projectile.damage, 'player-projectile');
            return;
        }
    }

    private resolveEnemyProjectile(projectile: CursorSpaceProjectile): void {
        if (!this.player.alive) {
            projectile.active = false;
            return;
        }

        const escortIndex = this.findEscortHit(
            projectile.position.x,
            projectile.position.y,
            projectile.radius,
        );
        if (escortIndex >= 0) {
            projectile.active = false;
            this.destroyEscort(escortIndex);
            return;
        }

        const dx = projectile.position.x - this.player.position.x;
        const dy = projectile.position.y - this.player.position.y;
        const radius = projectile.radius + this.config.playerRadius;
        if (dx * dx + dy * dy <= radius * radius) {
            projectile.active = false;
            this.damagePlayer(
                projectile.damage,
                'enemy-projectile',
                projectile.position.x,
                projectile.position.y,
            );
        }
    }

    private resolvePlayerCollisions(): void {
        if (!this.player.alive) {
            return;
        }

        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
            const enemy = this.enemies[enemyIndex];
            if (!enemy.active) {
                continue;
            }

            let escortCollision = -1;
            for (let index = 0; index < this.player.escortCount; index += 1) {
                const escort = cursorSpaceEscortWorldPosition(this.player, index);
                const dx = escort.x - enemy.position.x;
                const dy = escort.y - enemy.position.y;
                const radius = this.config.escortRadius + enemy.radius;
                if (dx * dx + dy * dy <= radius * radius) {
                    escortCollision = index;
                    break;
                }
            }

            if (escortCollision >= 0) {
                this.destroyEscort(escortCollision);
                this.destroyEnemy(enemyIndex, enemy, 'player-collision');
                continue;
            }

            const dx = this.player.position.x - enemy.position.x;
            const dy = this.player.position.y - enemy.position.y;
            const radius = this.config.playerRadius + enemy.radius;
            if (dx * dx + dy * dy > radius * radius) {
                continue;
            }

            this.damagePlayer(
                this.config.playerCollisionDamage,
                'enemy-collision',
                enemy.position.x,
                enemy.position.y,
            );
            this.destroyEnemy(enemyIndex, enemy, 'player-collision');
            if (!this.player.alive) {
                return;
            }
        }
    }

    private projectileHitsEnemy(
        projectile: Readonly<CursorSpaceProjectile>,
        enemy: Readonly<CursorSpaceEnemy>,
    ): boolean {
        const dx = projectile.position.x - enemy.position.x;
        const dy = projectile.position.y - enemy.position.y;
        const radius = projectile.radius + enemy.radius;
        return dx * dx + dy * dy <= radius * radius;
    }

    private findEscortHit(x: number, y: number, radius: number): number {
        for (let index = 0; index < this.player.escortCount; index += 1) {
            const escort = cursorSpaceEscortWorldPosition(this.player, index);
            const dx = x - escort.x;
            const dy = y - escort.y;
            const contactRadius = radius + this.config.escortRadius;
            if (dx * dx + dy * dy <= contactRadius * contactRadius) {
                return index;
            }
        }
        return -1;
    }

    private destroyEscort(index: number): void {
        if (index < 0 || index >= this.player.escortCount) {
            return;
        }

        const position = cursorSpaceEscortWorldPosition(this.player, index);
        if (this.player.escortCount === 2) {
            this.player.escortSide = index === 0 ? 1 : -1;
            this.player.escortCount = 1;
        } else {
            this.player.escortCount = 0;
        }
        this.spawnBurst(position.x, position.y, false);
    }

    private damageEnemy(
        enemyIndex: number,
        enemy: CursorSpaceEnemy,
        damage: number,
        cause: EnemyDestroyCause,
    ): void {
        if (!enemy.active || damage <= 0) {
            return;
        }
        enemy.health = Math.max(0, enemy.health - damage);
        if (enemy.health === 0) {
            this.destroyEnemy(enemyIndex, enemy, cause);
        } else {
            this.spawnImpact(enemy.position.x, enemy.position.y, false);
        }
    }

    private damagePlayer(
        damage: number,
        cause: PlayerDamageCause,
        impactX: number,
        impactY: number,
    ): void {
        if (!this.player.alive || this.player.invulnerableRemaining > 0 || damage <= 0) {
            return;
        }

        this.player.health = Math.max(0, this.player.health - damage);
        if (this.player.health === 0) {
            this.killPlayer(cause);
            return;
        }

        this.player.invulnerableRemaining = this.config.playerHitInvulnerabilityDuration;
        this.spawnImpact(impactX, impactY, true);
    }

    private destroyEnemy(
        enemyIndex: number,
        enemy: CursorSpaceEnemy,
        cause: EnemyDestroyCause,
    ): boolean {
        if (!enemy.active) {
            return false;
        }

        const x = enemy.position.x;
        const y = enemy.position.y;
        enemy.active = false;
        enemy.health = 0;
        enemy.threat = 0;
        enemy.shootingEnabled = false;
        enemy.fireRemaining = 0;
        enemy.burstRemaining = 0;
        this.clearProjectilesFromEnemy(enemyIndex);
        if (this.aimTarget === enemy) {
            this.aimTarget = null;
        }

        this.stats.enemiesDestroyed += 1;
        const playerKill = cause === 'player-projectile' || cause === 'player-collision';
        if (playerKill) {
            this.stats.enemiesDestroyedByPlayer += 1;
            this.updateLevelFromProgress();
            this.rewardPlayerKill();
        }
        this.spawnBurst(x, y, false);
        return true;
    }

    private rewardPlayerKill(): void {
        if (!this.player.alive || this.stats.level < this.config.escortUnlockLevel) {
            return;
        }
        if (this.player.escortCount < this.config.escortCapacity) {
            if (this.player.escortCount === 0) {
                this.player.escortSide = this.stats.enemiesDestroyedByPlayer % 2 === 0 ? -1 : 1;
            }
            this.player.escortCount += 1;
            return;
        }
        this.player.fireSupportLevel = Math.min(
            this.config.fireSupportCapacity,
            this.player.fireSupportLevel + 1,
        );
    }

    private killPlayer(_cause: PlayerDamageCause): void {
        if (!this.player.alive) {
            return;
        }

        this.player.alive = false;
        this.player.respawnRemaining = this.config.respawnDelay;
        this.player.velocity.x = 0;
        this.player.velocity.y = 0;
        this.player.escortCount = 0;
        this.player.fireSupportLevel = 0;
        this.aimTarget = null;
        this.stats.playerDeaths += 1;
        this.updateLevelFromProgress();
        this.clearEnemyProjectiles();
        this.enemyCeaseFireRemaining = RESPAWN_FIRE_GRACE;
        this.enemySpawnGraceRemaining = RESPAWN_SPAWN_GRACE;
        this.enemySpawnRemaining = Math.max(this.enemySpawnRemaining, this.config.respawnDelay);
        this.spawnBurst(this.player.position.x, this.player.position.y, true);
    }

    private updateLevelFromProgress(): void {
        this.stats.level = Math.max(
            1,
            1
                + Math.floor(this.stats.enemiesDestroyedByPlayer / 10)
                + this.stats.playerDeaths,
        );
    }

    private updateRespawn(dt: number): void {
        if (this.player.alive) {
            return;
        }
        this.player.respawnRemaining = Math.max(0, this.player.respawnRemaining - dt);
        if (this.player.respawnRemaining === 0) {
            this.respawnPlayer();
        }
    }

    private respawnPlayer(): void {
        const spawn = this.findSafestSpawn();
        this.player.position.x = spawn.x;
        this.player.position.y = spawn.y;
        this.player.velocity.x = 0;
        this.player.velocity.y = 0;
        this.player.alive = true;
        this.player.health = this.player.maximumHealth;
        this.player.throttle = 0.45;
        this.player.escortCount = 0;
        this.player.escortSide = 1;
        this.player.fireSupportLevel = 0;
        this.player.invulnerableRemaining = this.config.invulnerabilityDuration;
        this.clearEnemiesNear(spawn.x, spawn.y, this.config.respawnClearRadius);
        this.clearEnemyProjectiles();
        this.enemyCeaseFireRemaining = RESPAWN_FIRE_GRACE;
        this.enemySpawnGraceRemaining = RESPAWN_SPAWN_GRACE;
        for (const enemy of this.enemies) {
            if (enemy.active) {
                enemy.fireRemaining = Math.max(
                    enemy.fireRemaining,
                    RESPAWN_FIRE_GRACE + Math.random() * 0.5,
                );
                enemy.burstRemaining = 0;
            }
        }
    }

    private findSafestSpawn(): { x: number; y: number } {
        const centerX = (this.bounds.left + this.bounds.right) / 2;
        const centerY = (this.bounds.bottom + this.bounds.top) / 2;
        const insetX = (this.bounds.right - this.bounds.left) * 0.26;
        const insetY = (this.bounds.top - this.bounds.bottom) * 0.26;
        let bestX = centerX;
        let bestY = centerY;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (let index = 0; index < 9; index += 1) {
            const column = index % 3 - 1;
            const row = Math.floor(index / 3) - 1;
            const x = centerX + column * insetX;
            const y = centerY + row * insetY;
            let nearestEnemy = Number.POSITIVE_INFINITY;
            let nearestProjectile = Number.POSITIVE_INFINITY;

            for (const enemy of this.enemies) {
                if (!enemy.active) {
                    continue;
                }
                nearestEnemy = Math.min(
                    nearestEnemy,
                    (x - enemy.position.x) ** 2 + (y - enemy.position.y) ** 2,
                );
            }
            for (const projectile of this.projectiles) {
                if (!projectile.active || projectile.owner !== 'enemy') {
                    continue;
                }
                nearestProjectile = Math.min(
                    nearestProjectile,
                    (x - projectile.position.x) ** 2 + (y - projectile.position.y) ** 2,
                );
            }

            const score = Math.min(nearestEnemy, nearestProjectile * 0.72);
            if (score > bestScore) {
                bestScore = score;
                bestX = x;
                bestY = y;
            }
        }
        return { x: bestX, y: bestY };
    }

    private clearEnemiesNear(x: number, y: number, radius: number): void {
        const radiusSquared = radius * radius;
        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
            const enemy = this.enemies[enemyIndex];
            if (!enemy.active) {
                continue;
            }
            const dx = x - enemy.position.x;
            const dy = y - enemy.position.y;
            if (dx * dx + dy * dy <= radiusSquared) {
                this.destroyEnemy(enemyIndex, enemy, 'respawn-clear');
            }
        }
    }

    private updateEnemySpawning(dt: number): void {
        if (!this.player.alive || this.enemySpawnGraceRemaining > 0) {
            return;
        }

        this.enemySpawnRemaining -= dt;
        if (this.enemySpawnRemaining > 0) {
            return;
        }

        const profile = this.levelProfile(this.stats.level);
        if (this.countActiveEnemies() >= profile.maxActiveEnemies) {
            this.enemySpawnRemaining = 0.12;
            return;
        }

        this.spawnEnemy(profile);
        this.enemySpawnRemaining = Math.max(
            this.config.enemyMinimumSpawnInterval,
            profile.spawnInterval,
        );
    }

    private spawnEnemy(profile: CursorSpaceLevelProfile): void {
        const enemyIndex = this.enemies.findIndex((enemy) => !enemy.active);
        if (enemyIndex < 0) {
            return;
        }

        const enemy = this.enemies[enemyIndex];
        const margin = 28;
        const edge = Math.floor(Math.random() * 4);
        const width = this.bounds.right - this.bounds.left;
        const height = this.bounds.top - this.bounds.bottom;

        if (edge === 0) {
            enemy.position.x = this.bounds.left - margin;
            enemy.position.y = this.bounds.bottom + Math.random() * height;
        } else if (edge === 1) {
            enemy.position.x = this.bounds.right + margin;
            enemy.position.y = this.bounds.bottom + Math.random() * height;
        } else if (edge === 2) {
            enemy.position.x = this.bounds.left + Math.random() * width;
            enemy.position.y = this.bounds.bottom - margin;
        } else {
            enemy.position.x = this.bounds.left + Math.random() * width;
            enemy.position.y = this.bounds.top + margin;
        }

        const dx = this.player.position.x - enemy.position.x;
        const dy = this.player.position.y - enemy.position.y;
        const speedTier = this.chooseSpeedTier(profile);
        const fireTier = this.chooseFireTier(profile);
        const baseHealth = this.config.enemyHealthTiers[speedTier - 1];

        enemy.rotation = Math.atan2(dy, dx);
        enemy.spawnLevel = profile.level;
        enemy.speedTier = speedTier;
        enemy.fireTier = fireTier;
        enemy.movementSpeed = this.config.enemySpeedTiers[speedTier - 1];
        enemy.turnRate = this.config.enemyTurnRate * profile.turnMultiplier;
        enemy.maximumHealth = Math.max(1, Math.round(baseHealth * profile.healthMultiplier));
        enemy.health = enemy.maximumHealth;
        enemy.velocity.x = Math.cos(enemy.rotation) * enemy.movementSpeed;
        enemy.velocity.y = Math.sin(enemy.rotation) * enemy.movementSpeed;
        enemy.radius = this.config.enemyRadius + (speedTier - 1) * 1.5;
        enemy.dodgeSide = ((enemyIndex + this.spawnSerial) & 1) === 0 ? -1 : 1;
        enemy.shootingEnabled = fireTier > 0;
        enemy.fireInterval = this.fireIntervalForTier(fireTier);
        enemy.fireRemaining = Number.isFinite(enemy.fireInterval)
            ? enemy.fireInterval * (0.7 + Math.random() * 0.8)
            : Number.POSITIVE_INFINITY;
        enemy.burstRemaining = 0;
        enemy.projectileSpeed = this.config.enemyProjectileSpeed
            * profile.projectileSpeedMultiplier;
        enemy.threat = 0;
        enemy.active = true;
        this.spawnSerial += 1;
    }

    private chooseSpeedTier(profile: CursorSpaceLevelProfile): 1 | 2 | 3 {
        if (profile.maximumSpeedTier === 1) {
            return 1;
        }
        if (profile.maximumSpeedTier === 2) {
            return Math.random() < profile.fastTierChance ? 2 : 1;
        }
        const roll = Math.random();
        if (roll < profile.fastTierChance) {
            return 3;
        }
        return roll < 0.82 ? 2 : 1;
    }

    private chooseFireTier(profile: CursorSpaceLevelProfile): 0 | 1 | 2 | 3 {
        if (profile.maximumFireTier === 0 || Math.random() > profile.shootingChance) {
            return 0;
        }
        if (profile.maximumFireTier === 1) {
            return 1;
        }
        if (profile.maximumFireTier === 2) {
            return Math.random() < 0.46 ? 2 : 1;
        }
        if (Math.random() < profile.continuousFireChance) {
            return 3;
        }
        return Math.random() < 0.58 ? 2 : 1;
    }

    private fireIntervalForTier(tier: 0 | 1 | 2 | 3): number {
        if (tier === 1) {
            return this.config.enemyTierOneFireInterval;
        }
        if (tier === 2) {
            return Math.max(0.78, this.config.enemyTierTwoCooldown);
        }
        if (tier === 3) {
            return Math.max(0.13, this.config.enemyTierThreeFireInterval);
        }
        return Number.POSITIVE_INFINITY;
    }

    private projectileLimitForTier(tier: 0 | 1 | 2 | 3): number {
        if (tier === 1) {
            return 1;
        }
        if (tier === 2) {
            return 2;
        }
        if (tier === 3) {
            return 3;
        }
        return 0;
    }

    private levelProfile(level: number): CursorSpaceLevelProfile {
        const safeLevel = Math.max(1, Math.floor(level));
        const base = BASE_LEVELS[Math.min(BASE_LEVELS.length, safeLevel) - 1];
        if (safeLevel <= BASE_LEVELS.length) {
            return base;
        }

        const excess = safeLevel - BASE_LEVELS.length;
        return {
            ...base,
            level: safeLevel,
            maxActiveEnemies: Math.min(
                this.config.enemyCapacity - 2,
                base.maxActiveEnemies + excess,
            ),
            spawnInterval: Math.max(
                this.config.enemyMinimumSpawnInterval,
                base.spawnInterval - excess * 0.008,
            ),
            turnMultiplier: Math.min(1.72, base.turnMultiplier + excess * 0.025),
            projectileSpeedMultiplier: Math.min(
                1.62,
                base.projectileSpeedMultiplier + excess * 0.018,
            ),
            healthMultiplier: Math.min(1.85, base.healthMultiplier + excess * 0.025),
            maximumEnemyProjectiles: Math.min(36, base.maximumEnemyProjectiles + excess),
            globalFireInterval: Math.max(0.085, base.globalFireInterval - excess * 0.003),
        };
    }

    private spawnProjectile(
        owner: CursorSpaceProjectileOwner,
        sourceEnemyIndex: number,
        sourceX: number,
        sourceY: number,
        rotation: number,
        sourceVelocityX: number,
        sourceVelocityY: number,
        speed: number,
        life: number,
        radius: number,
        damage: number,
        noseOffset: number,
        inheritedVelocity: number,
    ): boolean {
        const projectile = this.projectiles.find((candidate) => !candidate.active);
        if (!projectile) {
            return false;
        }

        const directionX = Math.cos(rotation);
        const directionY = Math.sin(rotation);
        projectile.active = true;
        projectile.owner = owner;
        projectile.sourceEnemyIndex = sourceEnemyIndex;
        projectile.position.x = sourceX + directionX * noseOffset;
        projectile.position.y = sourceY + directionY * noseOffset;
        projectile.velocity.x = directionX * speed + sourceVelocityX * inheritedVelocity;
        projectile.velocity.y = directionY * speed + sourceVelocityY * inheritedVelocity;
        projectile.life = life;
        projectile.radius = radius;
        projectile.damage = Math.max(0, damage);
        projectile.travelled = 0;
        return true;
    }

    private clearProjectilesFromEnemy(enemyIndex: number): void {
        for (const projectile of this.projectiles) {
            if (
                projectile.active
                && projectile.owner === 'enemy'
                && projectile.sourceEnemyIndex === enemyIndex
            ) {
                projectile.active = false;
            }
        }
    }

    private cleanupOrphanedEnemyProjectiles(): void {
        for (const projectile of this.projectiles) {
            if (!projectile.active || projectile.owner !== 'enemy') {
                continue;
            }
            const source = this.enemies[projectile.sourceEnemyIndex];
            if (!source?.active) {
                projectile.active = false;
            }
        }
    }

    private clearEnemyProjectiles(): void {
        for (const projectile of this.projectiles) {
            if (projectile.active && projectile.owner === 'enemy') {
                projectile.active = false;
            }
        }
    }

    private countActiveEnemies(): number {
        let count = 0;
        for (const enemy of this.enemies) {
            if (enemy.active) {
                count += 1;
            }
        }
        return count;
    }

    private countActiveEnemyProjectiles(): number {
        let count = 0;
        for (const projectile of this.projectiles) {
            if (projectile.active && projectile.owner === 'enemy') {
                count += 1;
            }
        }
        return count;
    }

    private countEnemyProjectilesFrom(enemyIndex: number): number {
        let count = 0;
        for (const projectile of this.projectiles) {
            if (
                projectile.active
                && projectile.owner === 'enemy'
                && projectile.sourceEnemyIndex === enemyIndex
            ) {
                count += 1;
            }
        }
        return count;
    }

    private findNearestEnemy(): CursorSpaceEnemy | null {
        let nearest: CursorSpaceEnemy | null = null;
        let nearestDistanceSquared = this.config.autoAimRange * this.config.autoAimRange;
        for (const enemy of this.enemies) {
            if (!enemy.active) {
                continue;
            }
            const dx = enemy.position.x - this.player.position.x;
            const dy = enemy.position.y - this.player.position.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared < nearestDistanceSquared) {
                nearest = enemy;
                nearestDistanceSquared = distanceSquared;
            }
        }
        return nearest;
    }

    private interceptRotation(
        sourceX: number,
        sourceY: number,
        sourceVelocityX: number,
        sourceVelocityY: number,
        targetX: number,
        targetY: number,
        targetVelocityX: number,
        targetVelocityY: number,
        projectileSpeed: number,
        projectileLife: number,
    ): number {
        const relativeX = targetX - sourceX;
        const relativeY = targetY - sourceY;
        const velocityX = targetVelocityX - sourceVelocityX;
        const velocityY = targetVelocityY - sourceVelocityY;
        const a = velocityX * velocityX + velocityY * velocityY
            - projectileSpeed * projectileSpeed;
        const b = 2 * (relativeX * velocityX + relativeY * velocityY);
        const c = relativeX * relativeX + relativeY * relativeY;
        let time = 0;

        if (Math.abs(a) < 0.0001) {
            if (Math.abs(b) > 0.0001) {
                time = Math.max(0, -c / b);
            }
        } else {
            const discriminant = b * b - 4 * a * c;
            if (discriminant >= 0) {
                const root = Math.sqrt(discriminant);
                const first = (-b - root) / (2 * a);
                const second = (-b + root) / (2 * a);
                if (first > 0 && second > 0) {
                    time = Math.min(first, second);
                } else {
                    time = Math.max(first, second, 0);
                }
            }
        }

        time = Math.min(time, projectileLife);
        return Math.atan2(
            relativeY + velocityY * time,
            relativeX + velocityX * time,
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
        const time = speedSquared > MINIMUM_VECTOR_LENGTH
            ? this.clamp(
                -(relativeX * relativeVelocityX + relativeY * relativeVelocityY)
                    / speedSquared,
                0,
                horizon,
            )
            : 0;
        return {
            distance: Math.hypot(
                relativeX + relativeVelocityX * time,
                relativeY + relativeVelocityY * time,
            ),
            time,
        };
    }

    private clampPlayerToBounds(): void {
        this.player.position.x = this.clamp(
            this.player.position.x,
            this.bounds.left + this.config.playerRadius,
            this.bounds.right - this.config.playerRadius,
        );
        this.player.position.y = this.clamp(
            this.player.position.y,
            this.bounds.bottom + this.config.playerRadius,
            this.bounds.top - this.config.playerRadius,
        );
    }

    private updateEffects(dt: number): void {
        for (const effect of this.effects) {
            if (!effect.active) {
                continue;
            }
            effect.life = Math.max(0, effect.life - dt);
            if (effect.life === 0) {
                effect.active = false;
                continue;
            }
            effect.position.x += effect.velocity.x * dt;
            effect.position.y += effect.velocity.y * dt;
            effect.velocity.x *= Math.exp(-4.5 * dt);
            effect.velocity.y *= Math.exp(-4.5 * dt);
            if (effect.kind === 'ring') {
                effect.radius += 42 * dt;
            }
        }
    }

    private spawnImpact(x: number, y: number, playerImpact: boolean): void {
        for (let fragment = 0; fragment < 3; fragment += 1) {
            const effect = this.effects.find((candidate) => !candidate.active);
            if (!effect) {
                return;
            }
            const angle = Math.random() * Math.PI * 2;
            effect.active = true;
            effect.kind = 'fragment';
            effect.position.x = x;
            effect.position.y = y;
            const speed = (playerImpact ? 130 : 105) * (0.75 + Math.random() * 0.5);
            effect.velocity.x = Math.cos(angle) * speed;
            effect.velocity.y = Math.sin(angle) * speed;
            effect.life = playerImpact ? 0.22 : 0.18;
            effect.initialLife = effect.life;
            effect.radius = playerImpact ? 4.5 : 3.5;
        }
    }

    private spawnBurst(x: number, y: number, playerBurst: boolean): void {
        const ring = this.effects.find((effect) => !effect.active);
        if (ring) {
            ring.active = true;
            ring.kind = 'ring';
            ring.position.x = x;
            ring.position.y = y;
            ring.velocity.x = 0;
            ring.velocity.y = 0;
            ring.life = playerBurst ? 0.5 : 0.36;
            ring.initialLife = ring.life;
            ring.radius = playerBurst ? 7 : 5;
        }

        const count = playerBurst ? 14 : 8;
        for (let index = 0; index < count; index += 1) {
            const fragment = this.effects.find((effect) => !effect.active);
            if (!fragment) {
                return;
            }
            const angle = Math.PI * 2 * index / count + Math.random() * 0.18;
            const speed = (playerBurst ? 180 : 135) * (0.72 + Math.random() * 0.56);
            fragment.active = true;
            fragment.kind = 'fragment';
            fragment.position.x = x;
            fragment.position.y = y;
            fragment.velocity.x = Math.cos(angle) * speed;
            fragment.velocity.y = Math.sin(angle) * speed;
            fragment.life = playerBurst ? 0.52 : 0.38;
            fragment.initialLife = fragment.life;
            fragment.radius = playerBurst ? 5 : 3.8;
        }
    }

    private normalizedVector(x: number, y: number, fallbackRotation: number): { x: number; y: number } {
        const length = Math.hypot(x, y);
        if (length < MINIMUM_VECTOR_LENGTH) {
            return { x: Math.cos(fallbackRotation), y: Math.sin(fallbackRotation) };
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
