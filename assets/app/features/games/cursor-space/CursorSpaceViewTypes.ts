import type {
    CursorSpaceEffect,
    CursorSpaceEnemy,
    CursorSpacePlayer,
    CursorSpaceProjectile,
} from '../CursorSpaceTypes';

type DeepReadonly<T> = T extends (...args: never[]) => unknown
    ? T
    : T extends readonly (infer Item)[]
        ? readonly DeepReadonly<Item>[]
        : T extends object
            ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
            : T;

export type CursorSpacePlayerRenderState = DeepReadonly<CursorSpacePlayer>;
export type CursorSpaceEnemyRenderState = DeepReadonly<CursorSpaceEnemy>;
export type CursorSpaceProjectileRenderState = DeepReadonly<CursorSpaceProjectile>;
export type CursorSpaceEffectRenderState = DeepReadonly<CursorSpaceEffect>;

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
    readonly enemies: readonly CursorSpaceEnemyRenderState[];
    readonly projectiles: readonly CursorSpaceProjectileRenderState[];
    readonly effects: readonly CursorSpaceEffectRenderState[];
    readonly hitExplosions: readonly CursorSpaceHitExplosion[];
    readonly stats: string;
}
