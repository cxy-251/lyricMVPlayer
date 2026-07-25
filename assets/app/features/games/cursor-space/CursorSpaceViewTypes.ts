import type {
    CursorSpaceEffect,
    CursorSpaceEnemy,
    CursorSpacePlayer,
    CursorSpaceProjectile,
} from '../CursorSpaceTypes';

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
    readonly player: CursorSpacePlayer;
    readonly enemies: readonly CursorSpaceEnemy[];
    readonly projectiles: readonly CursorSpaceProjectile[];
    readonly effects: readonly CursorSpaceEffect[];
    readonly hitExplosions: readonly CursorSpaceHitExplosion[];
    readonly stats: string;
}
