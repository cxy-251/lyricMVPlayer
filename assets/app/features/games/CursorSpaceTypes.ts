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
    readonly playerAcceleration: number;
    readonly playerMaximumSpeed: number;
    readonly playerDrag: number;
    readonly projectileSpeed: number;
    readonly projectileLife: number;
    readonly projectileRadius: number;
    readonly fireInterval: number;
    readonly autoAimRange: number;
    readonly targetLeadTime: number;
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
    playerRadius: 11,
    playerAcceleration: 760,
    playerMaximumSpeed: 310,
    playerDrag: 3.8,
    projectileSpeed: 520,
    projectileLife: 1.65,
    projectileRadius: 3,
    fireInterval: 0.19,
    autoAimRange: 560,
    targetLeadTime: 0.22,
    inheritedVelocity: 0.28,
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
    effectCapacity: 64,
};
