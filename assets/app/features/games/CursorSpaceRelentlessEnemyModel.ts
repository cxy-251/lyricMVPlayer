import { CursorSpaceModel as CursorSpaceAggressiveEnemyModel } from './CursorSpaceAggressiveEnemyModel';
import type { CursorSpaceWall } from './CursorSpaceAggressiveEnemyModel';
import {
    cursorSpaceConfig,
    type CursorSpaceBounds,
    type CursorSpaceConfig,
    type CursorSpaceEffect,
    type CursorSpaceEnemy,
    type CursorSpacePlayer,
    type CursorSpaceProjectile,
    type CursorSpaceStats,
} from './CursorSpaceTypes';

const ENEMY_FIRE_THREAT_CEILING = 0.18;

interface AggressiveInternals {
    readonly core: ClosedWallInternals;
}

interface ClosedWallInternals {
    readonly core: DynamicWallInternals;
}

interface DynamicWallInternals {
    readonly core: CombatInternals;
}

interface CombatInternals {
    readonly enemies: CursorSpaceEnemy[];
    updateEnemies(dt: number): void;
}

/**
 * Ensures that survival steering never becomes a fire-suppression state.
 * The aggressive model already applies kill > survival > friendly steering;
 * this final facade enforces the same order in the combat fire gate.
 */
export class CursorSpaceModel {
    readonly player: CursorSpacePlayer;
    readonly stats: CursorSpaceStats;
    readonly enemies: CursorSpaceEnemy[];
    readonly projectiles: CursorSpaceProjectile[];
    readonly effects: CursorSpaceEffect[];
    readonly walls: CursorSpaceWall[];

    private readonly core: CursorSpaceAggressiveEnemyModel;

    constructor(config: CursorSpaceConfig = cursorSpaceConfig) {
        this.core = new CursorSpaceAggressiveEnemyModel(config);
        this.player = this.core.player;
        this.stats = this.core.stats;
        this.enemies = this.core.enemies;
        this.projectiles = this.core.projectiles;
        this.effects = this.core.effects;
        this.walls = this.core.walls;
        this.removeSurvivalFireSuppression();
    }

    get currentBounds(): Readonly<CursorSpaceBounds> {
        return this.core.currentBounds;
    }

    get wallActive(): boolean {
        return this.core.wallActive;
    }

    setBounds(bounds: CursorSpaceBounds): void {
        this.core.setBounds(bounds);
    }

    setTarget(x: number, y: number, throttle?: number): void {
        this.core.setTarget(x, y, throttle);
    }

    clearTarget(): void {
        this.core.clearTarget();
    }

    reset(): void {
        this.core.reset();
    }

    step(deltaTime: number): void {
        this.core.step(deltaTime);
    }

    private removeSurvivalFireSuppression(): void {
        const closed = (this.core as unknown as AggressiveInternals).core;
        const dynamic = closed.core;
        const combat = dynamic.core;
        const updateEnemies = combat.updateEnemies.bind(combat);

        combat.updateEnemies = (dt: number): void => {
            updateEnemies(dt);
            for (const enemy of combat.enemies) {
                if (enemy.active) {
                    enemy.threat = Math.min(ENEMY_FIRE_THREAT_CEILING, enemy.threat);
                }
            }
        };
    }
}

export type { CursorSpaceWall };
