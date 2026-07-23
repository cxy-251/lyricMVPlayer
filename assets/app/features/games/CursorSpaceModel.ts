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
    private elapsed = 0;
    private enemySpawnRemaining = 0;
    private fireRemaining = 0;

    constructor(private readonly config: CursorSpaceConfig = cursorSpaceConfig) {
        this.enemies = Array.from({ length: config.enemyCapacity }, () => ({
            active: false,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            rotation: 0,
            radius: config.enemyRadius,
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

        for (const enemy of this.enemies) {
            enemy.active = false;
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
            this.updateAutomaticFire(dt);
        }

        this.updateProjectiles(dt);
        this.updateEnemies(dt);
        this.updateEnemySpawning(dt);
        this.resolveProjectileCollisions();
        this.resolvePlayerCollisions();
    }

    private updatePlayer(dt: number): void {
        const player = this.player;

        if (player.invulnerableRemaining > 0) {
            player.invulnerableRemaining = Math.max(0, player.invulnerableRemaining - dt);
        }

        if (this.targetActive) {
            const dx = this.target.x - player.position.x;
            const dy = this.target.y - player.position.y;
            const distanceSquared = dx * dx + dy * dy;

            if (distanceSquared > 16) {
                const inverseLength = 1 / Math.sqrt(distanceSquared);
                player.velocity.x += dx * inverseLength * this.config.playerAcceleration * dt;
                player.velocity.y += dy * inverseLength * this.config.playerAcceleration * dt;
            }
        }

        const drag = Math.exp(-this.config.playerDrag * dt);
        player.velocity.x *= drag;
        player.velocity.y *= drag;

        const speedSquared = player.velocity.x * player.velocity.x
            + player.velocity.y * player.velocity.y;
        const maximumSpeed = this.config.playerMaximumSpeed;

        if (speedSquared > maximumSpeed * maximumSpeed) {
            const scale = maximumSpeed / Math.sqrt(speedSquared);
            player.velocity.x *= scale;
            player.velocity.y *= scale;
        }

        player.position.x += player.velocity.x * dt;
        player.position.y += player.velocity.y * dt;

        if (speedSquared > 9) {
            player.rotation = Math.atan2(player.velocity.y, player.velocity.x);
        } else if (this.targetActive) {
            player.rotation = Math.atan2(
                this.target.y - player.position.y,
                this.target.x - player.position.x,
            );
        }

        this.clampPlayerToBounds();
    }

    private updateAutomaticFire(dt: number): void {
        this.fireRemaining = Math.max(0, this.fireRemaining - dt);

        if (this.fireRemaining > 0) {
            return;
        }

        const target = this.findNearestEnemy();

        if (!target || !this.spawnProjectile(target)) {
            return;
        }

        this.fireRemaining = this.config.fireInterval;
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

    private spawnProjectile(target: CursorSpaceEnemy): boolean {
        const projectile = this.projectiles.find((candidate) => !candidate.active);

        if (!projectile) {
            return false;
        }

        const predictedX = target.position.x
            + target.velocity.x * this.config.targetLeadTime;
        const predictedY = target.position.y
            + target.velocity.y * this.config.targetLeadTime;
        let dx = predictedX - this.player.position.x;
        let dy = predictedY - this.player.position.y;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared <= 0.0001) {
            dx = Math.cos(this.player.rotation);
            dy = Math.sin(this.player.rotation);
        } else {
            const inverseLength = 1 / Math.sqrt(lengthSquared);
            dx *= inverseLength;
            dy *= inverseLength;
        }

        projectile.active = true;
        projectile.position.x = this.player.position.x + dx * 16;
        projectile.position.y = this.player.position.y + dy * 16;
        projectile.velocity.x = dx * this.config.projectileSpeed
            + this.player.velocity.x * this.config.inheritedVelocity;
        projectile.velocity.y = dy * this.config.projectileSpeed
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
        const enemy = this.enemies.find((candidate) => !candidate.active);

        if (!enemy) {
            return;
        }

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

        let dx = this.player.position.x - enemy.position.x;
        let dy = this.player.position.y - enemy.position.y;
        const inverseLength = 1 / Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
        dx *= inverseLength;
        dy *= inverseLength;
        enemy.velocity.x = dx * this.config.enemySpeed;
        enemy.velocity.y = dy * this.config.enemySpeed;
        enemy.rotation = Math.atan2(dy, dx);
        enemy.radius = this.config.enemyRadius;
        enemy.active = true;
    }

    private updateEnemies(dt: number): void {
        const removalMargin = 180;
        const targetX = this.player.position.x;
        const targetY = this.player.position.y;
        const speed = Math.min(180, this.config.enemySpeed + this.elapsed * 1.8);

        for (const enemy of this.enemies) {
            if (!enemy.active) {
                continue;
            }

            let desiredX = targetX - enemy.position.x;
            let desiredY = targetY - enemy.position.y;
            const desiredLength = Math.max(0.0001, Math.sqrt(
                desiredX * desiredX + desiredY * desiredY,
            ));
            desiredX /= desiredLength;
            desiredY /= desiredLength;

            let currentX = enemy.velocity.x;
            let currentY = enemy.velocity.y;
            const currentLength = Math.max(0.0001, Math.sqrt(
                currentX * currentX + currentY * currentY,
            ));
            currentX /= currentLength;
            currentY /= currentLength;

            const blend = Math.min(1, this.config.enemyTurnRate * dt);
            let directionX = currentX + (desiredX - currentX) * blend;
            let directionY = currentY + (desiredY - currentY) * blend;
            const directionLength = Math.max(0.0001, Math.sqrt(
                directionX * directionX + directionY * directionY,
            ));
            directionX /= directionLength;
            directionY /= directionLength;

            enemy.velocity.x = directionX * speed;
            enemy.velocity.y = directionY * speed;
            enemy.position.x += enemy.velocity.x * dt;
            enemy.position.y += enemy.velocity.y * dt;
            enemy.rotation = Math.atan2(enemy.velocity.y, enemy.velocity.x);

            if (
                enemy.position.x < this.bounds.left - removalMargin
                || enemy.position.x > this.bounds.right + removalMargin
                || enemy.position.y < this.bounds.bottom - removalMargin
                || enemy.position.y > this.bounds.top + removalMargin
            ) {
                enemy.active = false;
            }
        }
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
        this.spawnBurst(this.player.position.x, this.player.position.y, true);
    }

    private updateRespawn(dt: number): void {
        if (this.player.alive) {
            return;
        }

        this.player.respawnRemaining = Math.max(0, this.player.respawnRemaining - dt);

        if (this.player.respawnRemaining > 0) {
            return;
        }

        this.respawnPlayer();
    }

    private respawnPlayer(): void {
        const spawn = this.findSafestSpawn();
        this.player.position.x = spawn.x;
        this.player.position.y = spawn.y;
        this.player.velocity.x = 0;
        this.player.velocity.y = 0;
        this.player.rotation = 0;
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
            ring.life = playerBurst ? 0.52 : 0.34;
            ring.initialLife = ring.life;
            ring.radius = playerBurst ? 8 : 5;
        }

        const fragmentCount = playerBurst ? 14 : 7;

        for (let index = 0; index < fragmentCount; index += 1) {
            const fragment = this.effects.find((effect) => !effect.active);

            if (!fragment) {
                return;
            }

            const angle = Math.random() * Math.PI * 2;
            const speed = (playerBurst ? 110 : 75) + Math.random() * (playerBurst ? 95 : 65);
            fragment.active = true;
            fragment.kind = 'fragment';
            fragment.position.x = x;
            fragment.position.y = y;
            fragment.velocity.x = Math.cos(angle) * speed;
            fragment.velocity.y = Math.sin(angle) * speed;
            fragment.life = playerBurst ? 0.62 : 0.42;
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

    private clampPlayerToBounds(): void {
        const radius = this.config.playerRadius;
        const minimumX = this.bounds.left + radius;
        const maximumX = this.bounds.right - radius;
        const minimumY = this.bounds.bottom + radius;
        const maximumY = this.bounds.top - radius;
        const previousX = this.player.position.x;
        const previousY = this.player.position.y;

        this.player.position.x = this.clamp(previousX, minimumX, maximumX);
        this.player.position.y = this.clamp(previousY, minimumY, maximumY);

        if (this.player.position.x !== previousX) {
            this.player.velocity.x = 0;
        }

        if (this.player.position.y !== previousY) {
            this.player.velocity.y = 0;
        }
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
