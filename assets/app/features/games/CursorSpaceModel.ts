import {
    cursorSpaceConfig,
    type CursorSpaceBounds,
    type CursorSpaceConfig,
    type CursorSpaceEffect,
    type CursorSpaceEnemy,
    type CursorSpacePlayer,
    type CursorSpaceProjectile,
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

export class CursorSpaceModel {
    readonly player: CursorSpacePlayer = {
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        rotation: 0,
        alive: true,
        respawnRemaining: 0,
        invulnerableRemaining: 0,
    };

    readonly enemies: CursorSpaceEnemy[];
    readonly projectiles: CursorSpaceProjectile[];
    readonly effects: CursorSpaceEffect[];

    private bounds: CursorSpaceBounds = { ...DEFAULT_BOUNDS };
    private readonly target = { x: 0, y: 0 };
    private targetActive = false;
    private aimTarget: CursorSpaceEnemy | null = null;
    private elapsed = 0;
    private enemySpawnRemaining = 0;
    private fireRemaining = 0;
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
        }));
        this.projectiles = Array.from({ length: config.projectileCapacity }, () => ({
            active: false,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            life: 0,
            radius: config.projectileRadius,
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
        this.elapsed = 0;
        this.enemySpawnRemaining = 0.45;
        this.fireRemaining = 0;
        this.targetActive = false;
        this.aimTarget = null;

        for (const enemy of this.enemies) {
            enemy.active = false;
            enemy.threat = 0;
        }
        for (const projectile of this.projectiles) {
            projectile.active = false;
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
        this.player.invulnerableRemaining = this.config.invulnerabilityDuration;
    }

    step(deltaTime: number): void {
        const dt = Math.max(0, Math.min(0.05, deltaTime));
        if (dt === 0) {
            return;
        }

        this.elapsed += dt;
        this.updateEffects(dt);
        this.updateRespawn(dt);

        if (this.player.alive) {
            this.updatePlayer(dt);
            this.updateAim(dt);
            this.updateAutomaticFire(dt);
        }

        this.updateProjectiles(dt);
        this.updateEnemies(dt);
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
            desiredRotation = this.interceptRotation(this.aimTarget);
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

        const desiredRotation = this.interceptRotation(target);
        const error = Math.abs(this.wrapAngle(desiredRotation - this.player.rotation));
        if (error > this.config.autoFireTolerance) {
            return;
        }

        if (this.spawnProjectile()) {
            this.fireRemaining = this.config.fireInterval;
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

    private interceptRotation(enemy: CursorSpaceEnemy): number {
        const relativeX = enemy.position.x - this.player.position.x;
        const relativeY = enemy.position.y - this.player.position.y;
        const inheritedX = this.player.velocity.x * this.config.inheritedVelocity;
        const inheritedY = this.player.velocity.y * this.config.inheritedVelocity;
        const velocityX = enemy.velocity.x - inheritedX;
        const velocityY = enemy.velocity.y - inheritedY;
        const speed = this.config.projectileSpeed;
        const a = velocityX * velocityX + velocityY * velocityY - speed * speed;
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

        time = Math.min(time, this.config.projectileLife);
        return Math.atan2(
            relativeY + velocityY * time,
            relativeX + velocityX * time,
        );
    }

    private spawnProjectile(): boolean {
        const projectile = this.projectiles.find((candidate) => !candidate.active);
        if (!projectile) {
            return false;
        }

        const directionX = Math.cos(this.player.rotation);
        const directionY = Math.sin(this.player.rotation);
        projectile.active = true;
        projectile.position.x = this.player.position.x
            + directionX * this.config.playerNoseOffset;
        projectile.position.y = this.player.position.y
            + directionY * this.config.playerNoseOffset;
        projectile.velocity.x = directionX * this.config.projectileSpeed
            + this.player.velocity.x * this.config.inheritedVelocity;
        projectile.velocity.y = directionY * this.config.projectileSpeed
            + this.player.velocity.y * this.config.inheritedVelocity;
        projectile.life = this.config.projectileLife;
        projectile.radius = this.config.projectileRadius;
        return true;
    }

    private updateProjectiles(dt: number): void {
        const margin = 48;
        for (const projectile of this.projectiles) {
            if (!projectile.active) {
                continue;
            }

            projectile.life -= dt;
            projectile.position.x += projectile.velocity.x * dt;
            projectile.position.y += projectile.velocity.y * dt;

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

        this.spawnEnemy();
        this.enemySpawnRemaining += Math.max(
            this.config.enemyMinimumSpawnInterval,
            this.config.enemySpawnInterval - this.elapsed * this.config.enemySpawnAcceleration,
        );
    }

    private spawnEnemy(): void {
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
        enemy.velocity.x = Math.cos(enemy.rotation) * this.config.enemySpeed;
        enemy.velocity.y = Math.sin(enemy.rotation) * this.config.enemySpeed;
        enemy.radius = this.config.enemyRadius;
        enemy.dodgeSide = this.stableSide(enemyIndex, Math.floor(this.elapsed * 10));
        this.enemyApproachAngle[enemyIndex] = this.wrapAngle(
            Math.atan2(
                enemy.position.y - this.player.position.y,
                enemy.position.x - this.player.position.x,
            ) + this.approachLaneOffset(enemyIndex),
        );
        enemy.threat = 0;
        enemy.active = true;
    }

    private updateEnemies(dt: number): void {
        const speed = Math.min(180, this.config.enemySpeed + this.elapsed * 1.8);

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
            const playerDirectionX = toPlayerX / playerDistance;
            const playerDirectionY = toPlayerY / playerDistance;
            const pursuit = this.evaluatePursuitDirection(
                enemyIndex,
                enemy,
                playerDirectionX,
                playerDirectionY,
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
                speed,
            );
            const friendlyAvoidanceX = this.avoidanceX;
            const friendlyAvoidanceY = this.avoidanceY;
            const friendlyThreat = this.avoidanceThreat;

            this.evaluateProjectileAvoidance(
                enemy,
                pursuitX * speed,
                pursuitY * speed,
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
            const turnRate = this.config.enemyTurnRate
                * (1 + combinedThreat * this.config.enemyAvoidanceTurnBoost);
            const maximumTurn = turnRate * dt;
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
            this.enemyDecisionSpeed[enemyIndex] = speed * (1 + projectileThreat * 0.12);
            this.enemyDecisionThreat[enemyIndex] = combinedThreat;
        }

        this.applyEnemyMovement(dt);
    }

    private evaluatePursuitDirection(
        enemyIndex: number,
        enemy: CursorSpaceEnemy,
        playerDirectionX: number,
        playerDirectionY: number,
        playerDistance: number,
    ): { x: number; y: number } {
        if (playerDistance <= ATTACK_CIRCLE_RADIUS) {
            return { x: playerDirectionX, y: playerDirectionY };
        }

        const approachAngle = this.enemyApproachAngle[enemyIndex];
        const approachX = this.player.position.x
            + Math.cos(approachAngle) * APPROACH_LANE_RADIUS;
        const approachY = this.player.position.y
            + Math.sin(approachAngle) * APPROACH_LANE_RADIUS;
        const toApproachX = approachX - enemy.position.x;
        const toApproachY = approachY - enemy.position.y;
        const approachRotation = this.constrainPursuitRotation(
            toApproachX,
            toApproachY,
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
        speed: number,
    ): void {
        this.avoidanceX = 0;
        this.avoidanceY = 0;
        this.avoidanceThreat = 0;
        const enemyVelocityX = this.enemyPursuitX[enemyIndex] * speed;
        const enemyVelocityY = this.enemyPursuitY[enemyIndex] * speed;

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
            const relativeVelocityX = this.enemyPursuitX[otherIndex] * speed - enemyVelocityX;
            const relativeVelocityY = this.enemyPursuitY[otherIndex] * speed - enemyVelocityY;
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
            if (!projectile.active) {
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

                this.destroyEnemyPair(first, second);
                break;
            }
        }
    }

    private destroyEnemyPair(first: CursorSpaceEnemy, second: CursorSpaceEnemy): void {
        const firstX = first.position.x;
        const firstY = first.position.y;
        const secondX = second.position.x;
        const secondY = second.position.y;
        first.active = false;
        second.active = false;
        first.threat = 0;
        second.threat = 0;
        if (this.aimTarget === first || this.aimTarget === second) {
            this.aimTarget = null;
        }
        this.spawnBurst(firstX, firstY, false);
        this.spawnBurst(secondX, secondY, false);
    }

    private resolveProjectileCollisions(): void {
        for (const projectile of this.projectiles) {
            if (!projectile.active) {
                continue;
            }

            for (const enemy of this.enemies) {
                if (!enemy.active) {
                    continue;
                }

                const dx = projectile.position.x - enemy.position.x;
                const dy = projectile.position.y - enemy.position.y;
                const radius = projectile.radius + enemy.radius;
                if (dx * dx + dy * dy > radius * radius) {
                    continue;
                }

                projectile.active = false;
                enemy.active = false;
                enemy.threat = 0;
                if (this.aimTarget === enemy) {
                    this.aimTarget = null;
                }
                this.spawnBurst(enemy.position.x, enemy.position.y, false);
                break;
            }
        }
    }

    private resolvePlayerCollisions(): void {
        if (!this.player.alive || this.player.invulnerableRemaining > 0) {
            return;
        }

        for (const enemy of this.enemies) {
            if (!enemy.active) {
                continue;
            }

            const dx = this.player.position.x - enemy.position.x;
            const dy = this.player.position.y - enemy.position.y;
            const radius = this.config.playerRadius + enemy.radius;
            if (dx * dx + dy * dy <= radius * radius) {
                this.killPlayer();
                return;
            }
        }
    }

    private killPlayer(): void {
        this.player.alive = false;
        this.player.respawnRemaining = this.config.respawnDelay;
        this.player.velocity.x = 0;
        this.player.velocity.y = 0;
        this.aimTarget = null;
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
                enemy.active = false;
                enemy.threat = 0;
                this.spawnBurst(enemy.position.x, enemy.position.y, false);
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
