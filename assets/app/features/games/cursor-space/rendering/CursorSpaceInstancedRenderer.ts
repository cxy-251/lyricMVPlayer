import type { Color, Node } from 'cc';
import type { ViewportSnapshot } from '../../../../services/ViewportService';
import {
    CURSOR_SPACE_QUEUE_ESCORT_ROTATION,
} from '../domain/CursorSpaceFormation';
import type {
    CursorSpaceBounds,
    CursorSpaceEffect,
    CursorSpaceEnemy,
    CursorSpacePlayer,
    CursorSpaceProjectile,
} from '../domain/CursorSpaceTypes';
import {
    CURSOR_SPACE_CURSOR_POINTS,
    CURSOR_SPACE_ENEMY_POINTS,
    CursorSpaceInstancedRenderer as LegacyCursorSpaceInstancedRenderer,
} from '../../CursorSpaceInstancedRenderer';
import type {
    CursorSpaceEscortRenderState,
    CursorSpaceViewState,
} from '../CursorSpaceViewTypes';

export {
    CURSOR_SPACE_CURSOR_POINTS,
    CURSOR_SPACE_ENEMY_POINTS,
};

export interface CursorSpaceInstancedColors {
    readonly enemy: Color;
    readonly playerProjectile: Color;
    readonly enemyProjectile: Color;
    readonly effect: Color;
    readonly player: Color;
    readonly playerOutline: Color;
}

export interface CursorSpaceInstancedRendererOptions {
    readonly parent: Node;
    readonly viewport: ViewportSnapshot;
    readonly bounds: Readonly<CursorSpaceBounds>;
    readonly enemyCapacity: number;
    readonly projectileCapacity: number;
    readonly effectCapacity: number;
    readonly colors: CursorSpaceInstancedColors;
}

/**
 * Compatibility adapter around the existing Cocos GPU backend. The public
 * renderer consumes only feature-owned render DTOs; legacy domain-shaped casts
 * and the escort rotation hook are isolated here until the backend is replaced.
 */
export class CursorSpaceInstancedRenderer {
    private readonly legacy: LegacyCursorSpaceInstancedRenderer;
    private readonly playerAdapter = new LegacyPlayerAdapter();

    constructor(options: CursorSpaceInstancedRendererOptions) {
        this.legacy = new LegacyCursorSpaceInstancedRenderer(options);
    }

    sync(state: CursorSpaceViewState): void {
        this.playerAdapter.sync(state);
        this.legacy.sync(
            this.playerAdapter as unknown as Readonly<CursorSpacePlayer>,
            state.enemies as unknown as readonly CursorSpaceEnemy[],
            state.projectiles as unknown as readonly CursorSpaceProjectile[],
            state.effects as unknown as readonly CursorSpaceEffect[],
        );
    }

    dispose(): void {
        this.legacy.dispose();
    }
}

class LegacyPlayerAdapter {
    readonly position = { x: 0, y: 0 };
    readonly velocity = { x: 0, y: 0 };
    alive = false;
    invulnerableRemaining = 0;
    escortCount = 0;
    escortSide: -1 | 1 = 1;

    private mainRotation = 0;
    private pendingEscortIndex: number | null = null;
    private escorts: readonly CursorSpaceEscortRenderState[] = [];

    get rotation(): number {
        const escortIndex = this.pendingEscortIndex;
        this.pendingEscortIndex = null;
        if (escortIndex === null) {
            return this.mainRotation;
        }
        return this.escorts[escortIndex]?.rotation ?? this.mainRotation;
    }

    sync(state: CursorSpaceViewState): void {
        const player = state.player;
        this.position.x = player.position.x;
        this.position.y = player.position.y;
        this.velocity.x = player.velocity.x;
        this.velocity.y = player.velocity.y;
        this.mainRotation = player.rotation;
        this.alive = player.alive;
        this.invulnerableRemaining = player.invulnerableRemaining;
        this.escortCount = player.escortCount;
        this.escortSide = player.escortSide;
        this.escorts = state.escorts;
        this.pendingEscortIndex = null;
    }

    [CURSOR_SPACE_QUEUE_ESCORT_ROTATION](index: number): void {
        this.pendingEscortIndex = Math.max(
            0,
            Math.min(this.escorts.length - 1, Math.floor(index)),
        );
    }
}
