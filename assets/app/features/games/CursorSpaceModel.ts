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

const ATTACK_CIRCLE_RADIUS = 112;
const APPROACH_LANE_RADIUS = 92;
const APPROACH_LANE_HALF_ANGLE = Math.PI * 0.22;
const NORMAL_PURSUIT_HALF_ANGLE = Math.PI * 0.18;
const AVOIDANCE_HALF_ANGLE = Math.PI * 0.38;
const FRIENDLY_AVOIDANCE_DISTANCE = 42;
const FRIENDLY_AVOIDANCE_WEIGHT = 1.8;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MINIMUM_VECTOR_LENGTH = 0.0001;

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
}

type EnemyDestroyCause =
    | 'player-projectile'
    | 'player-collision'
    | 'enemy-collision'
    | 'enemy-projectile'
    | 'respawn-clear';

type PlayerDamageCause = 'enemy-collision' | 'enemy-projectile';

const BASE_LEVELS: readonly CursorSpaceLevelProfile[] = [
    {
        level: 1,
        maxActiveEnemies: 8,
        spawnInterval: 1.05,
        maximumSpeedTier: 1,
        fastTierChance: 0,
        turnMultiplier: 0.9,
        shootingChance: 0,
        maximumFireTier: 0,
        continuousFireChance: 0,
        projectileSpeedMultiplier: 0.9,
    },
    {
        level: 2,
        maxActiveEnemies: 10,
        spawnInterval: 0.96,
        maximumSpeedTier: 1,
        fastTierChance: 0,
        turnMultiplier: 0.95,
        shootingChance: 0,
        maximumFireTier: 0,
        continuousFireChance: 0,
        projectileSpeedMultiplier: 0.94,
    },
    {
        level: 3,
        maxActiveEnemies: 12,
        spawnInterval: 0.88,
        maximumSpeedTier: 2,
        fastTierChance: 0.24,
        turnMultiplier: 1,
        shootingChance: 0.38,
        maximumFireTier: 1,
        continuousFireChance: 0,
        projectileSpeedMultiplier: 1,
    },
    {
        level: 4,
        maxActiveEnemies: 14,
        spawnInterval: 0.82,
        maximumSpeedTier: 2,
        fastTierChance: 0.46,
        turnMultiplier: 1.04,
        shootingChance: 0.52,
        maximumFireTier: 1,
        continuousFireChance: 0,
        projectileSpeedMultiplier: 1.04,
    },
    {
        level: 5,
        maxActiveEnemies: 16,
        spawnInterval: 0.76,
        maximumSpeedTier: 2,
        fastTierChance: 0.68,
        turnMultiplier: 1.08,
        shootingChance: 0.7,
        maximumFireTier: 2,
        continuousFireChance: 0,
        projectileSpeedMultiplier: 1.08,
    },
    {
        level: 6,
        maxActiveEnemies: 18,
        spawnInterval: 0.7,
        maximumSpeedTier: 3,
        fastTierChance: 0.26,
        turnMultiplier: 1.12,
        shootingChance: 0.8,
        maximumFireTier: 2,
        continuousFireChance: 0,
        projectileSpeedMultiplier: 1.12,
    },
    {
        level: 7,
        maxActiveEnemies: 20,
        spawnInterval: 0.64,
        maximumSpeedTier: 3,
        fastTierChance: 0.5,
        turnMultiplier: 1.16,
        shootingChance: 0.9,
        maximumFireTier: 3,
        continuousFireChance: 0.25,
        projectileSpeedMultiplier: 1.16,
    },
    {
        level: 8,
        maxActiveEnemies: 22,
        spawnInterval: 0.58,
        maximumSpeedTier: 3,
        fastTierChance: 0.72,
        turnMultiplier: 1.2,
        shootingChance: 0.96,
        maximumFireTier: 3,
        continuousFireChance: 0.56,
        projectileSpeedMultiplier: 1.2,
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
    private targetActive = false;
    private aimTarget: CursorSpaceEnemy | null = null;
    private enemySpawnRemaining = 0;
    private fireRemaining = 0;
    private spawnSerial = 0;
    private escortFireCursor = 0;
    private readonly enemyApproachAngle: number[];

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
            fireInterval: 0,
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
        this.enemyApproachAngle = new Array(config.enemyCapacity).fill(0);
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

    setTarget(x: number, y: number, throttle = 1): void {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(throttle)) {
            return;
        }

        this.target.x = this.clamp(x, this.bounds.left, this.bounds.right);
        this.target.y = this.clamp(y, this.bounds.bottom, this.bounds.top);
        this.player.throttle = this.clamp(throttle, 0.08, 1);
        this.targetActive = true;
    }

    clearTarget(): void {
        this.targetActive = false;
    }

    reset(): void {
        this.enemySpawnRemaining = 0.45;
        this.fireRemaining = 0;
        this.spawnSerial = 0;
        this.escortFireCursor = 0;
        this.targetActive = false;
        this.aimTarget = null;
        this.stats.level = 1;
        this.stats.enemiesDestroyed = 0;
        this.stats.enemiesDestroyedByPlayer = 0;
        this.stats.playerDeaths = 0;

        for (const enemy of this.enemies) {
            enemy.active = false;
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
    }

    step(deltaTime: number): void {
        const dt = Math.max(0, Math.min(0.05, deltaTime));
        if (dt === 0) {
            return;
        }

        this.updateEffects(dt);
        this.updateRespawn(dt);

        if (this.player.alive) {
            this.updatePlayer(dt);
            this.updateAim(dt);
            this.updateAutomaticFire(dt);
        }

        this.updateEnemies(dt);
        this.updateEnemyAutomaticFire(dt);
        this.updateProjectiles(dt);
        this.resolveEnemyContacts();
        this.updateEnemySpawning(dt);
        this.resolveProjectileCollisions();
        this.resolvePlayerCollisions();
    }

    private updatePlayer(dt: number): void {
        const player = this.player;
        player.invulnerableRemaining = Math.max(0, player.invulnerableRemaining - dt);
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

    private updateAutomaticFire(dt: number): void {
        this.fireRemaining = Math.max(0, this.fireRemaining - dt);
        const target = this.aimTarget;
        if (this.fireRemaining > 0 || !target?.active) {
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

        const escortCount = this.player.escortCount;
        const laneCount = escortCount >= this.config.escortThreeLaneCount
            ? 3
            : escortCount > 0
                ? 2
                : 1;
        let fired = false;

        fired = this.spawnProjectile(
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
        ) || fired;

        for (let lane = 1; lane < laneCount; lane += 1) {
            const escortIndex = (this.escortFireCursor + lane - 1) % escortCount;
            const source = cursorSpaceEscortWorldPosition(this.player, escortIndex);
            fired = this.spawnProjectile(
                'player',
                -1,
                source.x,
                source.y,
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
            this.escortFireCursor = escortCount > 0
                ? (this.escortFireCursor + Math.max(1, laneCount - 1)) % escortCount
                : 0;
            this.fireRemaining = Math.max(
                this.config.minimumFleetFireInterval,
                this.config.fireInterval
                    / (1 + escortCount * this.config.escortFireDensityPerFighter),
            );
        }
    }

    private updateEnemyAutomaticFire(dt: number): void {
        if (!this.player.alive) {
            return;
        }

        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
            const enemy = this.enemies[enemyIndex];
            if (!enemy.active || !enemy.shootingEnabled || enemy.fireTier === 0) {
                continue;
            }

            enemy.fireRemaining = Math.max(0, enemy.fireRemaining - dt);
            if (enemy.fireRemaining > 0) {
                continue;
            }

            const dx = this.player.position.x - enemy.position.x;
            const dy = this.player.position.y - enemy.position.y;
            if (dx * dx + dy * dy > this.config.enemyFireRange * this.config.enemyFireRange) {
                continue;
            }

            const desiredRotation = this.interceptRotation(
                enemy.position.x,
                enemy.position.y,
                enemy.velocity.x,
                enemy.velocity.y,
                this.player.position.x,
                this.player.position.y,
                this.player.velocity.x,
                this.player.velocity.y,
                enemy.projectileSpeed,
                this.config.enemyProjectileLife,
            );
            const error = Math.abs(this.wrapAngle(desiredRotation - enemy.rotation));
            if (error > this.config.enemyFireTolerance) {
                continue;
            }

            if (!this.spawnProjectile(
                'enemy',
                enemyIndex,
                enemy.position.x,
                enemy.position.y,
                desiredRotation,
                enemy.velocity.x,
                enemy.velocity.y,
                enemy.projectileSpeed,
                this.config.enemyProjectileLife,
                this.config.enemyProjectileRadius,
                this.config.enemyProjectileDamage,
                this.config.enemyProjectileNoseOffset,
                0.12,
            )) {
                continue;
            }

            if (enemy.fireTier === 1) {
                enemy.fireRemaining = this.config.enemyTierOneFireInterval
                    * (0.85 + Math.random() * 0.3);
            } else if (enemy.fireTier === 2) {
                if (enemy.burstRemaining <= 0) {
                    enemy.burstRemaining = this.config.enemyTierTwoBurstSize;
                }
                enemy.burstRemaining -= 1;
                if (enemy.burstRemaining > 0) {
                    enemy.fireRemaining = this.config.enemyTierTwoBurstInterval;
                } else {
                    enemy.fireRemaining = this.config.enemyTierTwoCooldown
                        * (0.85 + Math.random() * 0.3);
                }
            } else {
                enemy.fireRemaining = this.config.enemyTierThreeFireInterval
                    * (0.9 + Math.random() * 0.2);
            }
        }
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

    private updateProjectiles(dt: number): void {
        const margin = 64;
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
                || projectile.position.x < this.bounds.left - margin
                || projectile.position.x > this.bounds.right + margin
                || projectile.position.y < this.bounds.bottom - margin
                || projectile.position.y > this.bounds.top + margin
            ) {
                projectile.active = false;
            }
        }
    }

    private updateEnemySpawning(dt: number): void {
        this.enemySpawnRemaining -= dt;
        if (this.enemySpawnRemaining > 0) {
            return;
        }

        const profile = this.levelProfile(this.stats.level);
        if (this.countActiveEnemies() >= profile.maxActiveEnemies) {
            this.enemySpawnRemaining = 0.15;
            return;
        }

        this.spawnEnemy(profile);
        this.enemySpawnRemaining = Math.max(
            this.config.enemyMinimumSpawnInterval,
            profile.spawnInterval,
        );
    }

    private spawnEnemy(profile: CursorSpaceLevelProfile): void {
        const enemyIndex = this.enemies.findIndex((candidate) => !candidate.active);
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
        enemy.rotation = Math.atan2(dy, dx);
        enemy.spawnLevel = profile.level;
        enemy.speedTier = speedTier;
        enemy.fireTier = fireTier;
        enemy.movementSpeed = this.config.enemySpeedTiers[speedTier - 1];
        enemy.turnRate = this.config.enemyTurnRate * profile.turnMultiplier;
        enemy.maximumHealth = this.config.enemyHealthTiers[speedTier - 1];
        enemy.health = enemy.maximumHealth;
        enemy.velocity.x = Math.cos(enemy.rotation) * enemy.movementSpeed;
        enemy.velocity.y = Math.sin(enemy.rotation) * enemy.movementSpeed;
        enemy.radius = this.config.enemyRadius + (speedTier - 1) * 1.4;
        enemy.dodgeSide = this.stableSide(enemyIndex, this.spawnSerial);
        enemy.shootingEnabled = fireTier > 0;
        enemy.fireInterval = this.fireIntervalForTier(fireTier);
        enemy.fireRemaining = enemy.fireInterval * (0.65 + Math.random() * 0.75);
        enemy.burstRemaining = 0;
        enemy.projectileSpeed = this.config.enemyProjectileSpeed
            * profile.projectileSpeedMultiplier;
        this.enemyApproachAngle[enemyIndex] = this.wrapAngle(
            Math.atan2(
                enemy.position.y - this.player.position.y,
                enemy.position.x - this.player.position.x,
            ) + this.approachLaneOffset(enemyIndex),
        );
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
        return Math.random() < profile.fastTierChance ? 3 : 2;
    }

    private chooseFireTier(profile: CursorSpaceLevelProfile): 0 | 1 | 2 | 3 {
        if (profile.maximumFireTier === 0 || Math.random() > profile.shootingChance) {
            return 0;
        }
        if (profile.maximumFireTier === 1) {
            return 1;
        }
        if (profile.maximumFireTier === 2) {
            return Math.random() < 0.58 ? 2 : 1;
        }
        if (Math.random() < profile.continuousFireChance) {
            return 3;
        }
        return Math.random() < 0.72 ? 2 : 1;
    }

    private fireIntervalForTier(tier: 0 | 1 | 2 | 3): number {
        if (tier === 1) {
            return this.config.enemyTierOneFireInterval;
        }
        if (tier === 2) {
            return this.config.enemyTierTwoCooldown;
        }
        if (tier === 3) {
            return this.config.enemyTierThreeFireInterval;
        }
        return Number.POSITIVE_INFINITY;
    }

    private updateEnemies(dt: number): void {
        const removalMargin = 180;

        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
            const enemy = this.enemies[enemyIndex];
            if (!enemy.active) {
                continue;
            }

            const toPlayerX = this.player.position.x - enemy.position.x;
            const toPlayerY = this.player.position.y - enemy.position.y;
            const playerDistance = Math.max(
                MINIMUM_VECTOR_LENGTH,
                Math.hypot(toPlayerX, toPlayerY),
            );
            const playerDirectionX = toPlayerX / playerDistance;
            const playerDirectionY = toPlayerY / playerDistance;
            const pursuit = this.evaluatePursuitDirection(
                enemyIndex,
                playerDirectionX,
                playerDirectionY,
                playerDistance,
            );
            const friendly = this.evaluateFriendlyAvoidance(enemyIndex, enemy);
            const projectile = this.evaluateProjectileAvoidance(enemy);
            const desiredX = pursuit.x
                + friendly.x * FRIENDLY_AVOIDANCE_WEIGHT
                + projectile.x * this.config.enemyAvoidanceWeight;
            const desiredY = pursuit.y
                + friendly.y * FRIENDLY_AVOIDANCE_WEIGHT
                + projectile.y * this.config.enemyAvoidanceWeight;
            const maximumDeviation = projectile.threat > 0.05 || friendly.threat > 0.05
                ? AVOIDANCE_HALF_ANGLE
                : NORMAL_PURSUIT_HALF_ANGLE;
            const desiredRotation = this.constrainPursuitRotation(
                desiredX,
                desiredY,
                playerDirectionX,
                playerDirectionY,
                maximumDeviation,
            );
            const combinedThreat = Math.max(projectile.threat, friendly.threat * 0.75);
            const maximumTurn = enemy.turnRate
                * (1 + combinedThreat * this.config.enemyAvoidanceTurnBoost)
                * dt;
            const difference = this.wrapAngle(desiredRotation - enemy.rotation);
            enemy.rotation = this.wrapAngle(
                enemy.rotation + this.clamp(difference, -maximumTurn, maximumTurn),
            );
            enemy.threat += (combinedThreat - enemy.threat) * (1 - Math.exp(-12 * dt));
            enemy.velocity.x = Math.cos(enemy.rotation) * enemy.movementSpeed;
            enemy.velocity.y = Math.sin(enemy.rotation) * enemy.movementSpeed;
            enemy.position.x += enemy.velocity.x * dt;
            enemy.position.y += enemy.velocity.y * dt;

            if (
                !Number.isFinite(enemy.position.x)
                || !Number.isFinite(enemy.position.y)
                || enemy.position.x < this.bounds.left - removalMargin
                || enemy.position.x > this.bounds.right + removalMargin
                || enemy.position.y < this.bounds.bottom - removalMargin
                || enemy.position.y > this.bounds.top + removalMargin
            ) {
                enemy.active = false;
                enemy.threat = 0;
            }
        }
    }

    private evaluatePursuitDirection(
        enemyIndex: number,
        playerDirectionX: number,
        playerDirectionY: number,
        playerDistance: number,
    ): { x: number; y: number } {
        if (playerDistance <= ATTACK_CIRCLE_RADIUS) {
            return { x: playerDirectionX, y: playerDirectionY };
        }

        const enemy = this.enemies[enemyIndex];
        const approachAngle = this.enemyApproachAngle[enemyIndex];
        const approachX = this.player.position.x
            + Math.cos(approachAngle) * APPROACH_LANE_RADIUS;
        const approachY = this.player.position.y
            + Math.sin(approachAngle) * APPROACH_LANE_RADIUS;
        const rotation = this.constrainPursuitRotation(
            approachX - enemy.position.x,
            approachY - enemy.position.y,
            playerDirectionX,
            playerDirectionY,
            APPROACH_LANE_HALF_ANGLE,
        );
        return { x: Math.cos(rotation), y: Math.sin(rotation) };
    }

    private evaluateFriendlyAvoidance(
        enemyIndex: number,
        enemy: Readonly<CursorSpaceEnemy>,
    ): { x: number; y: number; threat: number } {
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
            const dx = enemy.position.x - other.position.x;
            const dy = enemy.position.y - other.position.y;
            const distance = Math.hypot(dx, dy);
            const dangerDistance = enemy.radius + other.radius + FRIENDLY_AVOIDANCE_DISTANCE;
            if (distance >= dangerDistance || distance < MINIMUM_VECTOR_LENGTH) {
                continue;
            }
            const pressure = 1 - distance / dangerDistance;
            avoidanceX += dx / distance * pressure;
            avoidanceY += dy / distance * pressure;
            threat = Math.max(threat, pressure);
        }

        const normalized = this.normalizedVector(avoidanceX, avoidanceY);
        return { x: normalized.x, y: normalized.y, threat };
    }

    private evaluateProjectileAvoidance(
        enemy: Readonly<CursorSpaceEnemy>,
    ): { x: number; y: number; threat: number } {
        let avoidanceX = 0;
        let avoidanceY = 0;
        let threat = 0;
        const horizon = this.config.enemyAvoidanceHorizon;

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
            const time = Math.min(horizon, -approach / speedSquared);
            const closestX = relativeX + relativeVelocityX * time;
            const closestY = relativeY + relativeVelocityY * time;
            const distance = Math.hypot(closestX, closestY);
            const dangerRadius = this.config.enemyAvoidanceRadius
                + enemy.radius + projectile.radius;
            if (distance >= dangerRadius) {
                continue;
            }
            const pressure = 1 - distance / dangerRadius;
            const dodgeLength = Math.max(MINIMUM_VECTOR_LENGTH, distance);
            avoidanceX -= closestX / dodgeLength * pressure;
            avoidanceY -= closestY / dodgeLength * pressure;
            threat = Math.max(threat, pressure * (1 - time / horizon * 0.35));
        }

        const normalized = this.normalizedVector(avoidanceX, avoidanceY);
        return { x: normalized.x, y: normalized.y, threat };
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
                const contactDistance = first.radius + second.radius;
                if (dx * dx + dy * dy <= contactDistance * contactDistance) {
                    this.destroyEnemy(first, 'enemy-collision');
                    this.destroyEnemy(second, 'enemy-collision');
                    break;
                }
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
        for (const enemy of this.enemies) {
            if (!enemy.active || !this.projectileHitsEnemy(projectile, enemy)) {
                continue;
            }
            projectile.active = false;
            this.damageEnemy(enemy, projectile.damage, 'player-projectile');
            return;
        }
    }

    private resolveEnemyProjectile(projectile: CursorSpaceProjectile): void {
        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
            const enemy = this.enemies[enemyIndex];
            if (!enemy.active) {
                continue;
            }
            if (
                enemyIndex === projectile.sourceEnemyIndex
                && projectile.travelled < this.config.enemyProjectileArmDistance
            ) {
                continue;
            }
            if (this.projectileHitsEnemy(projectile, enemy)) {
                projectile.active = false;
                this.damageEnemy(enemy, projectile.damage, 'enemy-projectile');
                return;
            }
        }

        if (!projectile.active || !this.player.alive) {
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

    private projectileHitsEnemy(
        projectile: Readonly<CursorSpaceProjectile>,
        enemy: Readonly<CursorSpaceEnemy>,
    ): boolean {
        const dx = projectile.position.x - enemy.position.x;
        const dy = projectile.position.y - enemy.position.y;
        const radius = projectile.radius + enemy.radius;
        return dx * dx + dy * dy <= radius * radius;
    }

    private resolvePlayerCollisions(): void {
        if (!this.player.alive) {
            return;
        }

        for (const enemy of this.enemies) {
            if (!enemy.active) {
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
            this.destroyEnemy(enemy, 'player-collision');
            if (!this.player.alive) {
                return;
            }
        }
    }

    private damageEnemy(
        enemy: CursorSpaceEnemy,
        damage: number,
        cause: EnemyDestroyCause,
    ): void {
        if (!enemy.active || damage <= 0) {
            return;
        }
        enemy.health = Math.max(0, enemy.health - damage);
        if (enemy.health === 0) {
            this.destroyEnemy(enemy, cause);
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

        if (this.player.escortCount > 0) {
            const escortIndex = this.player.escortCount - 1;
            const escort = cursorSpaceEscortWorldPosition(this.player, escortIndex);
            this.player.escortCount -= 1;
            this.spawnBurst(escort.x, escort.y, false);
            return;
        }

        this.player.health = Math.max(0, this.player.health - damage);
        if (this.player.health === 0) {
            this.killPlayer(cause);
        } else {
            this.spawnImpact(impactX, impactY, true);
        }
    }

    private destroyEnemy(enemy: CursorSpaceEnemy, cause: EnemyDestroyCause): boolean {
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
        if (this.aimTarget === enemy) {
            this.aimTarget = null;
        }

        this.stats.enemiesDestroyed += 1;
        const playerKill = cause === 'player-projectile' || cause === 'player-collision';
        if (playerKill) {
            this.stats.enemiesDestroyedByPlayer += 1;
            if (
                this.player.alive
                && this.stats.level >= this.config.escortUnlockLevel
                && this.player.escortCount < this.config.escortCapacity
            ) {
                this.player.escortCount += 1;
            }
        }
        this.spawnBurst(x, y, false);
        return true;
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
        this.aimTarget = null;
        this.stats.playerDeaths += 1;
        this.stats.level = this.stats.playerDeaths + 1;
        this.enemySpawnRemaining = Math.max(
            this.enemySpawnRemaining,
            this.config.respawnDelay * 0.75,
        );
        this.spawnBurst(this.player.position.x, this.player.position.y, true);
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
        this.player.invulnerableRemaining = this.config.invulnerabilityDuration;
        this.clearEnemiesNear(spawn.x, spawn.y, this.config.respawnClearRadius);
    }

    private findSafestSpawn(): { x: number; y: number } {
        const centerX = (this.bounds.left + this.bounds.right) / 2;
        const centerY = (this.bounds.bottom + this.bounds.top) / 2;
        const insetX = (this.bounds.right - this.bounds.left) * 0.26;
        const insetY = (this.bounds.top - this.bounds.bottom) * 0.26;
        let bestX = centerX;
        let bestY = centerY;
        let bestDistanceSquared = -1;

        for (let index = 0; index < 9; index += 1) {
            const column = index % 3 - 1;
            const row = Math.floor(index / 3) - 1;
            const x = centerX + column * insetX;
            const y = centerY + row * insetY;
            let nearestDistanceSquared = Number.POSITIVE_INFINITY;
            for (const enemy of this.enemies) {
                if (!enemy.active) {
                    continue;
                }
                const dx = x - enemy.position.x;
                const dy = y - enemy.position.y;
                nearestDistanceSquared = Math.min(
                    nearestDistanceSquared,
                    dx * dx + dy * dy,
                );
            }
            if (nearestDistanceSquared > bestDistanceSquared) {
                bestDistanceSquared = nearestDistanceSquared;
                bestX = x;
                bestY = y;
            }
        }
        return { x: bestX, y: bestY };
    }

    private clearEnemiesNear(x: number, y: number, radius: number): void {
        const radiusSquared = radius * radius;
        for (const enemy of this.enemies) {
            if (!enemy.active) {
                continue;
            }
            const dx = x - enemy.position.x;
            const dy = y - enemy.position.y;
            if (dx * dx + dy * dy <= radiusSquared) {
                this.destroyEnemy(enemy, 'respawn-clear');
            }
        }
    }

    private spawnImpact(x: number, y: number, playerImpact: boolean): void {
        const ring = this.effects.find((effect) => !effect.active);
        if (!ring) {
            return;
        }
        ring.active = true;
        ring.kind = 'ring';
        ring.position.x = x;
        ring.position.y = y;
        ring.velocity.x = 0;
        ring.velocity.y = 0;
        ring.life = playerImpact ? 0.18 : 0.12;
        ring.initialLife = ring.life;
        ring.radius = playerImpact ? 4 : 2.5;
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
            ring.life = playerBurst ? 0.42 : 0.28;
            ring.initialLife = ring.life;
            ring.radius = playerBurst ? 8 : 5;
        }

        const fragmentCount = playerBurst ? 6 : 3;
        for (let index = 0; index < fragmentCount; index += 1) {
            const fragment = this.effects.find((effect) => !effect.active);
            if (!fragment) {
                return;
            }
            const angle = Math.random() * Math.PI * 2;
            const speed = (playerBurst ? 110 : 75)
                + Math.random() * (playerBurst ? 95 : 65);
            fragment.active = true;
            fragment.kind = 'fragment';
            fragment.position.x = x;
            fragment.position.y = y;
            fragment.velocity.x = Math.cos(angle) * speed;
            fragment.velocity.y = Math.sin(angle) * speed;
            fragment.life = playerBurst ? 0.52 : 0.34;
            fragment.initialLife = fragment.life;
            fragment.radius = playerBurst ? 6 : 4;
        }
    }

    private updateEffects(dt: number): void {
        const drag = Math.exp(-3.2 * dt);
        for (const effect of this.effects) {
            if (!effect.active) {
                continue;
            }
            effect.life -= dt;
            if (effect.life <= 0) {
                effect.active = false;
                continue;
            }
            if (effect.kind === 'ring') {
                effect.radius += 125 * dt;
                continue;
            }
            effect.position.x += effect.velocity.x * dt;
            effect.position.y += effect.velocity.y * dt;
            effect.velocity.x *= drag;
            effect.velocity.y *= drag;
        }
    }

    private levelProfile(level: number): CursorSpaceLevelProfile {
        const base = BASE_LEVELS[level - 1];
        if (base) {
            return base;
        }

        const extra = Math.max(0, level - BASE_LEVELS.length);
        const last = BASE_LEVELS[BASE_LEVELS.length - 1];
        return {
            level,
            maxActiveEnemies: Math.min(
                this.config.enemyCapacity,
                last.maxActiveEnemies + extra * 2,
            ),
            spawnInterval: Math.max(
                this.config.enemyMinimumSpawnInterval,
                last.spawnInterval - extra * 0.025,
            ),
            maximumSpeedTier: 3,
            fastTierChance: Math.min(0.96, last.fastTierChance + extra * 0.035),
            turnMultiplier: Math.min(1.48, last.turnMultiplier + extra * 0.025),
            shootingChance: Math.min(1, last.shootingChance + extra * 0.012),
            maximumFireTier: 3,
            continuousFireChance: Math.min(
                0.96,
                last.continuousFireChance + extra * 0.045,
            ),
            projectileSpeedMultiplier: Math.min(
                1.42,
                last.projectileSpeedMultiplier + extra * 0.02,
            ),
        };
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

    private approachLaneOffset(enemyIndex: number): number {
        const lane = enemyIndex % 7 - 3;
        return lane * GOLDEN_ANGLE * 0.005;
    }

    private stableSide(first: number, second: number): -1 | 1 {
        const hash = ((first + 1) * 73856093) ^ ((second + 1) * 19349663);
        return (hash & 1) === 0 ? -1 : 1;
    }

    private constrainPursuitRotation(
        desiredX: number,
        desiredY: number,
        pursuitX: number,
        pursuitY: number,
        maximumDeviation: number,
    ): number {
        const pursuitRotation = Math.atan2(pursuitY, pursuitX);
        const desiredLengthSquared = desiredX * desiredX + desiredY * desiredY;
        if (!Number.isFinite(desiredLengthSquared) || desiredLengthSquared < MINIMUM_VECTOR_LENGTH) {
            return pursuitRotation;
        }
        const desiredRotation = Math.atan2(desiredY, desiredX);
        const deviation = this.wrapAngle(desiredRotation - pursuitRotation);
        return this.wrapAngle(
            pursuitRotation + this.clamp(deviation, -maximumDeviation, maximumDeviation),
        );
    }

    private normalizedVector(x: number, y: number): { x: number; y: number } {
        const length = Math.hypot(x, y);
        if (length < MINIMUM_VECTOR_LENGTH) {
            return { x: 0, y: 0 };
        }
        return { x: x / length, y: y / length };
    }

    private clampPlayerToBounds(): void {
        const radius = this.config.playerRadius;
        const minimumX = this.bounds.left + radius;
        const maximumX = this.bounds.right - radius;
        const minimumY = this.bounds.bottom + radius;
        const maximumY = this.bounds.top - radius;
        const previousX = this.player.position.x;
        const previousY = this.player.position.y;

        this.player.position.x = minimumX <= maximumX
            ? this.clamp(previousX, minimumX, maximumX)
            : (this.bounds.left + this.bounds.right) / 2;
        this.player.position.y = minimumY <= maximumY
            ? this.clamp(previousY, minimumY, maximumY)
            : (this.bounds.bottom + this.bounds.top) / 2;

        if (this.player.position.x !== previousX) {
            this.player.velocity.x = 0;
        }
        if (this.player.position.y !== previousY) {
            this.player.velocity.y = 0;
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

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
