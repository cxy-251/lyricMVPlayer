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

const ATTACK_CIRCLE_RADIUS = 100;
const APPROACH_LANE_RADIUS = 76;
const APPROACH_LANE_HALF_ANGLE = Math.PI * 0.2;
const NORMAL_PURSUIT_HALF_ANGLE = Math.PI * 0.16;
const FRIENDLY_AVOIDANCE_HALF_ANGLE = Math.PI * 0.23;
const PROJECTILE_AVOIDANCE_HALF_ANGLE = Math.PI * 0.34;
const FRIENDLY_AVOIDANCE_HORIZON = 0.55;
const FRIENDLY_PREDICTION_PADDING = 8;
const FRIENDLY_AVOIDANCE_WEIGHT = 1.65;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MINIMUM_VECTOR_LENGTH = 0.0001;

interface CursorSpaceLevelProfile {
    readonly level: number;
    readonly maxActiveEnemies: number;
    readonly spawnInterval: number;
    readonly speedMultiplier: number;
    readonly turnMultiplier: number;
    readonly shootingChance: number;
    readonly fireInterval: number;
    readonly projectileSpeedMultiplier: number;
}

type EnemyDestroyCause =
    | 'player-projectile'
    | 'player-collision'
    | 'enemy-collision'
    | 'enemy-projectile'
    | 'respawn-clear';

type PlayerDestroyCause = 'enemy-collision' | 'enemy-projectile';

const BASE_LEVELS: readonly CursorSpaceLevelProfile[] = [
    {
        level: 1,
        maxActiveEnemies: 8,
        spawnInterval: 1.05,
        speedMultiplier: 0.9,
        turnMultiplier: 0.9,
        shootingChance: 0,
        fireInterval: 2.8,
        projectileSpeedMultiplier: 0.9,
    },
    {
        level: 2,
        maxActiveEnemies: 10,
        spawnInterval: 0.95,
        speedMultiplier: 0.95,
        turnMultiplier: 0.95,
        shootingChance: 0,
        fireInterval: 2.7,
        projectileSpeedMultiplier: 0.94,
    },
    {
        level: 3,
        maxActiveEnemies: 12,
        spawnInterval: 0.88,
        speedMultiplier: 1,
        turnMultiplier: 1,
        shootingChance: 0.2,
        fireInterval: 2.4,
        projectileSpeedMultiplier: 1,
    },
    {
        level: 4,
        maxActiveEnemies: 14,
        spawnInterval: 0.82,
        speedMultiplier: 1.02,
        turnMultiplier: 1.03,
        shootingChance: 0.35,
        fireInterval: 2.1,
        projectileSpeedMultiplier: 1.03,
    },
    {
        level: 5,
        maxActiveEnemies: 16,
        spawnInterval: 0.76,
        speedMultiplier: 1.05,
        turnMultiplier: 1.06,
        shootingChance: 0.5,
        fireInterval: 1.9,
        projectileSpeedMultiplier: 1.06,
    },
    {
        level: 6,
        maxActiveEnemies: 18,
        spawnInterval: 0.7,
        speedMultiplier: 1.08,
        turnMultiplier: 1.1,
        shootingChance: 0.65,
        fireInterval: 1.7,
        projectileSpeedMultiplier: 1.1,
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
    private avoidanceX = 0;
    private avoidanceY = 0;
    private avoidanceThreat = 0;
    private readonly enemyApproachAngle: number[];
    private readonly enemyPursuitX: number[];
    private readonly enemyPursuitY: number[];
    private readonly enemyDecisionRotation: number[];
    private readonly enemyDecisionSpeed: number[];
    private readonly enemyDecisionThreat: number[];

    constructor(private readonly config: CursorSpaceConfig = cursorSpaceConfig) {
        this.enemies = Array.from({ length: config.enemyCapacity }, () => ({
            active: false,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            rotation: 0,
            radius: config.enemyRadius,
            dodgeSide: 1 as const,
            threat: 0,
            spawnLevel: 1,
            movementSpeed: config.enemySpeed,
            turnRate: config.enemyTurnRate,
            shootingEnabled: false,
            fireRemaining: 0,
            fireInterval: 0,
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
        this.enemyPursuitX = new Array(config.enemyCapacity).fill(0);
        this.enemyPursuitY = new Array(config.enemyCapacity).fill(0);
        this.enemyDecisionRotation = new Array(config.enemyCapacity).fill(0);
        this.enemyDecisionSpeed = new Array(config.enemyCapacity).fill(0);
        this.enemyDecisionThreat = new Array(config.enemyCapacity).fill(0);
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

    setTarget(x: number, y: number): void {
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return;
        }

        this.target.x = this.clamp(x, this.bounds.left, this.bounds.right);
        this.target.y = this.clamp(y, this.bounds.bottom, this.bounds.top);
        this.targetActive = true;
    }

    clearTarget(): void {
        this.targetActive = false;
    }

    reset(): void {
        this.enemySpawnRemaining = 0.45;
        this.fireRemaining = 0;
        this.spawnSerial = 0;
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
        const previousX = player.position.x;
        const previousY = player.position.y;

        if (this.targetActive) {
            const dx = this.target.x - player.position.x;
            const dy = this.target.y - player.position.y;
            const distanceSquared = dx * dx + dy * dy;

            if (distanceSquared > 0.25) {
                const distance = Math.sqrt(distanceSquared);
                const response = 1 - Math.exp(-this.config.playerFollowResponse * dt);
                const movement = Math.min(
                    this.config.playerMaximumSpeed * dt,
                    distance * response,
                );
                player.position.x += dx / distance * movement;
                player.position.y += dy / distance * movement;
            }
        } else {
            const retention = Math.exp(-this.config.playerFollowResponse * dt);
            player.velocity.x *= retention;
            player.velocity.y *= retention;
            player.position.x += player.velocity.x * dt;
            player.position.y += player.velocity.y * dt;
        }

        if (this.targetActive) {
            player.velocity.x = (player.position.x - previousX) / dt;
            player.velocity.y = (player.position.y - previousY) / dt;
        }

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
        } else {
            const speedSquared = this.player.velocity.x * this.player.velocity.x
                + this.player.velocity.y * this.player.velocity.y;
            if (speedSquared > 64) {
                desiredRotation = Math.atan2(this.player.velocity.y, this.player.velocity.x);
            }
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

        if (this.spawnProjectile(
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
            this.config.playerNoseOffset,
            this.config.inheritedVelocity,
        )) {
            this.fireRemaining = this.config.fireInterval;
        }
    }

    private updateEnemyAutomaticFire(dt: number): void {
        if (!this.player.alive) {
            return;
        }

        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
            const enemy = this.enemies[enemyIndex];
            if (!enemy.active || !enemy.shootingEnabled) {
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

            if (this.spawnProjectile(
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
                this.config.enemyProjectileNoseOffset,
                0.12,
            )) {
                enemy.fireRemaining = enemy.fireInterval * (0.85 + Math.random() * 0.3);
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
        enemy.rotation = Math.atan2(dy, dx);
        enemy.spawnLevel = profile.level;
        enemy.movementSpeed = this.config.enemySpeed * profile.speedMultiplier;
        enemy.turnRate = this.config.enemyTurnRate * profile.turnMultiplier;
        enemy.velocity.x = Math.cos(enemy.rotation) * enemy.movementSpeed;
        enemy.velocity.y = Math.sin(enemy.rotation) * enemy.movementSpeed;
        enemy.radius = this.config.enemyRadius;
        enemy.dodgeSide = this.stableSide(enemyIndex, this.spawnSerial);
        enemy.shootingEnabled = Math.random() < profile.shootingChance;
        enemy.fireInterval = profile.fireInterval;
        enemy.fireRemaining = profile.fireInterval * (0.65 + Math.random() * 0.75);
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

    private updateEnemies(dt: number): void {
        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
            const enemy = this.enemies[enemyIndex];
            if (!enemy.active) {
                this.enemyPursuitX[enemyIndex] = 0;
                this.enemyPursuitY[enemyIndex] = 0;
                this.enemyDecisionSpeed[enemyIndex] = 0;
                this.enemyDecisionThreat[enemyIndex] = 0;
                continue;
            }

            const toPlayerX = this.player.position.x - enemy.position.x;
            const toPlayerY = this.player.position.y - enemy.position.y;
            const playerDistance = Math.max(
                MINIMUM_VECTOR_LENGTH,
                Math.hypot(toPlayerX, toPlayerY),
            );
            const pursuit = this.evaluatePursuitDirection(
                enemyIndex,
                toPlayerX / playerDistance,
                toPlayerY / playerDistance,
                playerDistance,
            );
            this.enemyPursuitX[enemyIndex] = pursuit.x;
            this.enemyPursuitY[enemyIndex] = pursuit.y;
        }

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
            const pursuitX = this.enemyPursuitX[enemyIndex];
            const pursuitY = this.enemyPursuitY[enemyIndex];

            this.evaluateFriendlyAvoidance(
                enemyIndex,
                enemy,
                playerDirectionX,
                playerDirectionY,
            );
            const friendlyAvoidanceX = this.avoidanceX;
            const friendlyAvoidanceY = this.avoidanceY;
            const friendlyThreat = this.avoidanceThreat;

            this.evaluateProjectileAvoidance(
                enemy,
                pursuitX * enemy.movementSpeed,
                pursuitY * enemy.movementSpeed,
            );
            const projectileAvoidanceX = this.avoidanceX;
            const projectileAvoidanceY = this.avoidanceY;
            const projectileThreat = this.avoidanceThreat;

            const desiredX = pursuitX
                + friendlyAvoidanceX * FRIENDLY_AVOIDANCE_WEIGHT
                + projectileAvoidanceX * this.config.enemyAvoidanceWeight;
            const desiredY = pursuitY
                + friendlyAvoidanceY * FRIENDLY_AVOIDANCE_WEIGHT
                + projectileAvoidanceY * this.config.enemyAvoidanceWeight;
            const maximumDeviation = projectileThreat > 0.05
                ? PROJECTILE_AVOIDANCE_HALF_ANGLE
                : friendlyThreat > 0.05
                    ? FRIENDLY_AVOIDANCE_HALF_ANGLE
                    : NORMAL_PURSUIT_HALF_ANGLE;
            const desiredRotation = this.constrainPursuitRotation(
                desiredX,
                desiredY,
                playerDirectionX,
                playerDirectionY,
                maximumDeviation,
            );
            const combinedThreat = Math.max(projectileThreat, friendlyThreat * 0.72);
            const maximumTurn = enemy.turnRate
                * (1 + combinedThreat * this.config.enemyAvoidanceTurnBoost)
                * dt;
            const difference = this.wrapAngle(desiredRotation - enemy.rotation);
            let rotation = this.wrapAngle(
                enemy.rotation + this.clamp(difference, -maximumTurn, maximumTurn),
            );

            if (!Number.isFinite(rotation)) {
                rotation = Math.atan2(playerDirectionY, playerDirectionX);
            }
            rotation = this.constrainPursuitRotation(
                Math.cos(rotation),
                Math.sin(rotation),
                playerDirectionX,
                playerDirectionY,
                maximumDeviation,
            );

            this.enemyDecisionRotation[enemyIndex] = rotation;
            this.enemyDecisionSpeed[enemyIndex] = enemy.movementSpeed
                * (1 + projectileThreat * 0.12);
            this.enemyDecisionThreat[enemyIndex] = combinedThreat;
        }

        this.applyEnemyMovement(dt);
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
        const approachRotation = this.constrainPursuitRotation(
            approachX - enemy.position.x,
            approachY - enemy.position.y,
            playerDirectionX,
            playerDirectionY,
            APPROACH_LANE_HALF_ANGLE,
        );
        return { x: Math.cos(approachRotation), y: Math.sin(approachRotation) };
    }

    private evaluateFriendlyAvoidance(
        enemyIndex: number,
        enemy: CursorSpaceEnemy,
        playerDirectionX: number,
        playerDirectionY: number,
    ): void {
        this.avoidanceX = 0;
        this.avoidanceY = 0;
        this.avoidanceThreat = 0;
        const enemyVelocityX = this.enemyPursuitX[enemyIndex] * enemy.movementSpeed;
        const enemyVelocityY = this.enemyPursuitY[enemyIndex] * enemy.movementSpeed;

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
            const relativeVelocityX = this.enemyPursuitX[otherIndex] * other.movementSpeed
                - enemyVelocityX;
            const relativeVelocityY = this.enemyPursuitY[otherIndex] * other.movementSpeed
                - enemyVelocityY;
            const relativeSpeedSquared = relativeVelocityX * relativeVelocityX
                + relativeVelocityY * relativeVelocityY;
            if (relativeSpeedSquared < 1) {
                continue;
            }

            const approach = relativeX * relativeVelocityX + relativeY * relativeVelocityY;
            if (approach >= 0) {
                continue;
            }

            const time = this.clamp(
                -approach / relativeSpeedSquared,
                0,
                FRIENDLY_AVOIDANCE_HORIZON,
            );
            const closestX = relativeX + relativeVelocityX * time;
            const closestY = relativeY + relativeVelocityY * time;
            const closestDistanceSquared = closestX * closestX + closestY * closestY;
            const dangerDistance = enemy.radius + other.radius + FRIENDLY_PREDICTION_PADDING;
            if (closestDistanceSquared >= dangerDistance * dangerDistance) {
                continue;
            }

            const closestDistance = Math.sqrt(Math.max(0, closestDistanceSquared));
            const spatialThreat = this.clamp(
                1 - closestDistance / dangerDistance,
                0,
                1,
            );
            const temporalThreat = 1 - time / FRIENDLY_AVOIDANCE_HORIZON;
            const threat = this.clamp(
                spatialThreat * 0.76 + temporalThreat * 0.24,
                0,
                1,
            );
            if (threat <= this.avoidanceThreat) {
                continue;
            }

            if (closestDistance > MINIMUM_VECTOR_LENGTH) {
                this.avoidanceX = -closestX / closestDistance;
                this.avoidanceY = -closestY / closestDistance;
            } else {
                const side = this.pairAvoidanceSide(enemyIndex, otherIndex);
                this.avoidanceX = -playerDirectionY * side;
                this.avoidanceY = playerDirectionX * side;
            }
            this.avoidanceThreat = threat;
        }

        this.normalizeAvoidance();
    }

    private evaluateProjectileAvoidance(
        enemy: CursorSpaceEnemy,
        enemyVelocityX: number,
        enemyVelocityY: number,
    ): void {
        this.avoidanceX = 0;
        this.avoidanceY = 0;
        this.avoidanceThreat = 0;
        const horizon = this.config.enemyAvoidanceHorizon;

        for (const projectile of this.projectiles) {
            if (!projectile.active || projectile.owner !== 'player') {
                continue;
            }

            const relativeX = projectile.position.x - enemy.position.x;
            const relativeY = projectile.position.y - enemy.position.y;
            const relativeVelocityX = projectile.velocity.x - enemyVelocityX;
            const relativeVelocityY = projectile.velocity.y - enemyVelocityY;
            const relativeSpeedSquared = relativeVelocityX * relativeVelocityX
                + relativeVelocityY * relativeVelocityY;
            if (relativeSpeedSquared < 1) {
                continue;
            }

            const approach = relativeX * relativeVelocityX + relativeY * relativeVelocityY;
            if (approach >= 0) {
                continue;
            }

            const time = Math.min(horizon, -approach / relativeSpeedSquared);
            const closestX = relativeX + relativeVelocityX * time;
            const closestY = relativeY + relativeVelocityY * time;
            const dangerRadius = this.config.enemyAvoidanceRadius
                + enemy.radius + projectile.radius;
            const distanceSquared = closestX * closestX + closestY * closestY;
            if (distanceSquared >= dangerRadius * dangerRadius) {
                continue;
            }

            const distance = Math.sqrt(distanceSquared);
            const spatialThreat = 1 - distance / dangerRadius;
            const temporalThreat = 1 - time / horizon;
            const threat = this.clamp(
                spatialThreat * 0.72 + temporalThreat * 0.28,
                0,
                1,
            );
            let dodgeX = -closestX;
            let dodgeY = -closestY;
            const dodgeLengthSquared = dodgeX * dodgeX + dodgeY * dodgeY;

            if (dodgeLengthSquared < 1) {
                const projectileSpeed = Math.max(
                    MINIMUM_VECTOR_LENGTH,
                    Math.hypot(projectile.velocity.x, projectile.velocity.y),
                );
                dodgeX = -projectile.velocity.y / projectileSpeed * enemy.dodgeSide;
                dodgeY = projectile.velocity.x / projectileSpeed * enemy.dodgeSide;
            } else {
                const inverseLength = 1 / Math.sqrt(dodgeLengthSquared);
                dodgeX *= inverseLength;
                dodgeY *= inverseLength;
            }

            this.avoidanceX += dodgeX * threat;
            this.avoidanceY += dodgeY * threat;
            this.avoidanceThreat = Math.max(this.avoidanceThreat, threat);
        }

        this.normalizeAvoidance();
    }

    private applyEnemyMovement(dt: number): void {
        const removalMargin = 180;

        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
            const enemy = this.enemies[enemyIndex];
            if (!enemy.active) {
                continue;
            }

            const rotation = this.enemyDecisionRotation[enemyIndex];
            const movementSpeed = this.enemyDecisionSpeed[enemyIndex];
            enemy.rotation = rotation;
            enemy.threat += (this.enemyDecisionThreat[enemyIndex] - enemy.threat)
                * (1 - Math.exp(-12 * dt));
            enemy.velocity.x = Math.cos(rotation) * movementSpeed;
            enemy.velocity.y = Math.sin(rotation) * movementSpeed;
            enemy.position.x += enemy.velocity.x * dt;
            enemy.position.y += enemy.velocity.y * dt;

            if (
                !Number.isFinite(enemy.position.x)
                || !Number.isFinite(enemy.position.y)
                || !Number.isFinite(enemy.velocity.x)
                || !Number.isFinite(enemy.velocity.y)
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
                if (dx * dx + dy * dy > contactDistance * contactDistance) {
                    continue;
                }

                this.destroyEnemy(first, 'enemy-collision');
                this.destroyEnemy(second, 'enemy-collision');
                break;
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
            if (!enemy.active) {
                continue;
            }

            if (this.projectileHitsEnemy(projectile, enemy)) {
                projectile.active = false;
                this.destroyEnemy(enemy, 'player-projectile');
                return;
            }
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
                this.destroyEnemy(enemy, 'enemy-projectile');
                return;
            }
        }

        if (!projectile.active || !this.player.alive) {
            return;
        }

        const dx = projectile.position.x - this.player.position.x;
        const dy = projectile.position.y - this.player.position.y;
        const radius = projectile.radius + this.config.playerRadius;
        if (dx * dx + dy * dy > radius * radius) {
            return;
        }

        projectile.active = false;
        if (this.player.invulnerableRemaining <= 0) {
            this.killPlayer('enemy-projectile');
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

            this.destroyEnemy(enemy, 'player-collision');
            if (this.player.invulnerableRemaining <= 0) {
                this.killPlayer('enemy-collision');
                return;
            }
        }
    }

    private destroyEnemy(enemy: CursorSpaceEnemy, cause: EnemyDestroyCause): boolean {
        if (!enemy.active) {
            return false;
        }

        const x = enemy.position.x;
        const y = enemy.position.y;
        enemy.active = false;
        enemy.threat = 0;
        enemy.shootingEnabled = false;
        enemy.fireRemaining = 0;
        if (this.aimTarget === enemy) {
            this.aimTarget = null;
        }

        this.stats.enemiesDestroyed += 1;
        if (cause === 'player-projectile' || cause === 'player-collision') {
            this.stats.enemiesDestroyedByPlayer += 1;
        }
        this.spawnBurst(x, y, false);
        return true;
    }

    private killPlayer(_cause: PlayerDestroyCause): void {
        if (!this.player.alive) {
            return;
        }

        this.player.alive = false;
        this.player.respawnRemaining = this.config.respawnDelay;
        this.player.velocity.x = 0;
        this.player.velocity.y = 0;
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
                last.spawnInterval - extra * 0.035,
            ),
            speedMultiplier: Math.min(1.35, last.speedMultiplier + extra * 0.025),
            turnMultiplier: Math.min(1.4, last.turnMultiplier + extra * 0.03),
            shootingChance: Math.min(0.92, last.shootingChance + extra * 0.04),
            fireInterval: Math.max(0.95, last.fireInterval - extra * 0.06),
            projectileSpeedMultiplier: Math.min(
                1.35,
                last.projectileSpeedMultiplier + extra * 0.025,
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

    private pairAvoidanceSide(enemyIndex: number, otherIndex: number): -1 | 1 {
        const lower = Math.min(enemyIndex, otherIndex);
        const higher = Math.max(enemyIndex, otherIndex);
        const pairSide = this.stableSide(lower, higher);
        return enemyIndex === lower ? pairSide : pairSide === 1 ? -1 : 1;
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

    private normalizeAvoidance(): void {
        const totalLengthSquared = this.avoidanceX * this.avoidanceX
            + this.avoidanceY * this.avoidanceY;
        if (totalLengthSquared > 1) {
            const inverseLength = 1 / Math.sqrt(totalLengthSquared);
            this.avoidanceX *= inverseLength;
            this.avoidanceY *= inverseLength;
        }
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
