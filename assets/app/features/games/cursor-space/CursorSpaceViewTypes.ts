export interface CursorSpaceVectorRenderState {
    readonly x: number;
    readonly y: number;
}

export interface CursorSpacePlayerRenderState {
    readonly position: CursorSpaceVectorRenderState;
    readonly velocity: CursorSpaceVectorRenderState;
    readonly rotation: number;
    readonly alive: boolean;
    readonly invulnerableRemaining: number;
    readonly health: number;
    readonly maximumHealth: number;
    readonly escortCount: number;
    readonly escortSide: -1 | 1;
}

export interface CursorSpaceEscortRenderState {
    readonly active: boolean;
    readonly x: number;
    readonly y: number;
    readonly rotation: number;
}

export interface CursorSpaceEnemyRenderState {
    readonly active: boolean;
    readonly position: CursorSpaceVectorRenderState;
    readonly rotation: number;
    readonly speedTier: 1 | 2 | 3;
    readonly health: number;
    readonly maximumHealth: number;
}

export type CursorSpaceProjectileOwner = 'player' | 'enemy';

export interface CursorSpaceProjectileRenderState {
    readonly active: boolean;
    readonly owner: CursorSpaceProjectileOwner;
    readonly position: CursorSpaceVectorRenderState;
    readonly velocity: CursorSpaceVectorRenderState;
}

export type CursorSpaceEffectKind = 'fragment' | 'ring';

export interface CursorSpaceEffectRenderState {
    readonly active: boolean;
    readonly kind: CursorSpaceEffectKind;
    readonly position: CursorSpaceVectorRenderState;
    readonly velocity: CursorSpaceVectorRenderState;
    readonly radius: number;
}

export interface CursorSpaceHitExplosion {
    readonly x: number;
    readonly y: number;
    readonly life: number;
    readonly angle: number;
}

export interface CursorSpaceRenderCapacity {
    readonly enemies: number;
    readonly projectiles: number;
    readonly effects: number;
}

export interface CursorSpaceViewState {
    readonly player: CursorSpacePlayerRenderState;
    readonly escorts: readonly CursorSpaceEscortRenderState[];
    readonly enemies: readonly CursorSpaceEnemyRenderState[];
    readonly projectiles: readonly CursorSpaceProjectileRenderState[];
    readonly effects: readonly CursorSpaceEffectRenderState[];
    readonly hitExplosions: readonly CursorSpaceHitExplosion[];
    readonly stats: string;
}
