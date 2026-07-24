export interface CursorSpaceVector {
    x: number;
    y: number;
}

export interface CursorSpaceBounds {
    left: number;
    right: number;
    bottom: number;
    top: number;
}

export interface CursorSpacePlayer {
    readonly position: CursorSpaceVector;
    readonly velocity: CursorSpaceVector;
    rotation: number;
    alive: boolean;
    respawnRemaining: number;
    invulnerableRemaining: number;
}

export interface CursorSpaceEnemy {
    active: boolean;
    readonly position: CursorSpaceVector;
    readonly velocity: CursorSpaceVector;
    rotation: number;
    radius: number;
    dodgeSide: -1 | 1;
    threat: number;
    spawnLevel: number;
    movementSpeed: number;
    turnRate: number;
    shootingEnabled: boolean;
    fireRemaining: number;
    fireInterval: number;
    projectileSpeed: number;
}

export type CursorSpaceProjectileOwner = 'player' | 'enemy';

export interface CursorSpaceProjectile {
    active: boolean;
    owner: CursorSpaceProjectileOwner;
    sourceEnemyIndex: number;
    readonly position: CursorSpaceVector;
    readonly velocity: CursorSpaceVector;
    life: number;
    radius: number;
    travelled: number;
}

export type CursorSpaceEffectKind = 'fragment' | 'ring';

export interface CursorSpaceEffect {
    active: boolean;
    kind: CursorSpaceEffectKind;
    readonly position: CursorSpaceVector;
    readonly velocity: CursorSpaceVector;
    life: number;
    initialLife: number;
    radius: number;
}

export interface CursorSpaceStats {
    level: number;
    enemiesDestroyed: number;
    enemiesDestroyedByPlayer: number;
    playerDeaths: number;
}

export interface CursorSpaceConfig {
    readonly playerRadius: number;
    readonly playerFollowResponse: number;
    readonly playerMaximumSpeed: number;
    readonly playerNoseOffset: number;
    readonly playerAimResponse: number;
    readonly projectileSpeed: number;
    readonly projectileLife: number;
    readonly projectileRadius: number;
    readonly fireInterval: number;
    readonly autoAimRange: number;
    readonly autoFireTolerance: number;
    readonly inheritedVelocity: number;
    readonly enemyRadius: number;
    readonly enemySpeed: number;
    readonly enemyTurnRate: number;
    readonly enemyAvoidanceHorizon: number;
    readonly enemyAvoidanceRadius: number;
    readonly enemyAvoidanceWeight: number;
    readonly enemyAvoidanceTurnBoost: number;
    readonly enemySpawnInterval: number;
    readonly enemyMinimumSpawnInterval: number;
    readonly enemyProjectileSpeed: number;
    readonly enemyProjectileLife: number;
    readonly enemyProjectileRadius: number;
    readonly enemyProjectileNoseOffset: number;
    readonly enemyProjectileArmDistance: number;
    readonly enemyFireRange: number;
    readonly enemyFireTolerance: number;
    readonly respawnDelay: number;
    readonly invulnerabilityDuration: number;
    readonly respawnClearRadius: number;
    readonly projectileCapacity: number;
    readonly enemyCapacity: number;
    readonly effectCapacity: number;
}

export const cursorSpaceConfig: CursorSpaceConfig = {
    playerRadius: 10,
    playerFollowResponse: 13,
    playerMaximumSpeed: 460,
    playerNoseOffset: 19,
    playerAimResponse: 24,
    projectileSpeed: 590,
    projectileLife: 1.5,
    projectileRadius: 3,
    fireInterval: 0.18,
    autoAimRange: 620,
    autoFireTolerance: Math.PI * 0.008,
    inheritedVelocity: 0.18,
    enemyRadius: 11,
    enemySpeed: 86,
    enemyTurnRate: 2.8,
    enemyAvoidanceHorizon: 0.72,
    enemyAvoidanceRadius: 58,
    enemyAvoidanceWeight: 3.4,
    enemyAvoidanceTurnBoost: 2.6,
    enemySpawnInterval: 1.05,
    enemyMinimumSpawnInterval: 0.42,
    enemyProjectileSpeed: 330,
    enemyProjectileLife: 2.4,
    enemyProjectileRadius: 3.5,
    enemyProjectileNoseOffset: 15,
    enemyProjectileArmDistance: 30,
    enemyFireRange: 520,
    enemyFireTolerance: Math.PI * 0.08,
    respawnDelay: 0.8,
    invulnerabilityDuration: 1,
    respawnClearRadius: 150,
    projectileCapacity: 192,
    enemyCapacity: 48,
    effectCapacity: 160,
};
