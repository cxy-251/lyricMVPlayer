import type {
    CursorSpaceBounds,
    CursorSpaceEnemy,
    CursorSpacePlayer,
    CursorSpaceProjectile,
} from './CursorSpaceTypes';

export interface CursorSpaceEnemyThreat {
    readonly x: number;
    readonly y: number;
    readonly threat: number;
}

export interface CursorSpaceEnemyBehaviorContext {
    readonly bounds: Readonly<CursorSpaceBounds>;
    readonly player: CursorSpacePlayer;
    readonly enemies: CursorSpaceEnemy[];
    readonly projectiles: CursorSpaceProjectile[];

    playerProjectileThreat(enemy: Readonly<CursorSpaceEnemy>): CursorSpaceEnemyThreat;
    enemyCollisionThreat(
        enemyIndex: number,
        enemy: Readonly<CursorSpaceEnemy>,
    ): CursorSpaceEnemyThreat;
    boundaryThreat(enemy: Readonly<CursorSpaceEnemy>): CursorSpaceEnemyThreat;
    friendlySeparationThreat(
        enemyIndex: number,
        enemy: Readonly<CursorSpaceEnemy>,
    ): CursorSpaceEnemyThreat;
    clearProjectilesFromEnemy(enemyIndex: number): void;
}

export interface CursorSpaceEnemyBehavior {
    updateEnemies(context: CursorSpaceEnemyBehaviorContext, dt: number): void;
    blocksFriendlyFireLane?(
        context: CursorSpaceEnemyBehaviorContext,
        enemyIndex: number,
        rotation: number,
    ): boolean;
}
