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
}

export interface CursorSpaceProjectile {
    active: boolean;
    readonly position: CursorSpaceVector;
    readonly velocity: CursorSpaceVector;
    life: number;
    radius: number;
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
    readonly enemySpawnInterval: number;
    readonly enemyMinimumSpawnInterval: number;
    readonly enemySpawnAcceleration: number;
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
    playerAimResponse: 18,
    projectileSpeed: 590,
    projectileLife: 1.5,
    projectileRadius: 3,
    fireInterval: 0.18,
    autoAimRange: 620,
    autoFireTolerance: Math.PI * 0.055,
    inheritedVelocity: 0.18,
    enemyRadius: 11,
    enemySpeed: 86,
    enemyTurnRate: 2.8,
    enemySpawnInterval: 1.05,
    enemyMinimumSpawnInterval: 0.34,
    enemySpawnAcceleration: 0.012,
    respawnDelay: 0.8,
    invulnerabilityDuration: 1,
    respawnClearRadius: 150,
    projectileCapacity: 48,
    enemyCapacity: 28,
    effectCapacity: 48,
};