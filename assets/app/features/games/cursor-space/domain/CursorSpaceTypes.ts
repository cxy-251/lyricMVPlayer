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
    health: number;
    maximumHealth: number;
    throttle: number;
    escortCount: number;
    escortSide: -1 | 1;
    fireSupportLevel: number;
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
    speedTier: 1 | 2 | 3;
    fireTier: 0 | 1 | 2 | 3;
    movementSpeed: number;
    turnRate: number;
    health: number;
    maximumHealth: number;
    shootingEnabled: boolean;
    fireRemaining: number;
    fireInterval: number;
    burstRemaining: number;
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
    damage: number;
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

export {
    cursorSpaceConfig,
    type CursorSpaceConfig,
} from '../config/CursorSpaceConfig';
