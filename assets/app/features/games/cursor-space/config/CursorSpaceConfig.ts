import type { CursorSpaceEnemyBehavior } from '../domain/CursorSpaceEnemyBehavior';
import type { CursorSpaceFireControlPolicy } from '../domain/CursorSpaceFireControl';

export interface CursorSpaceConfig {
    readonly enemyBehavior?: CursorSpaceEnemyBehavior;
    readonly fireControlPolicy?: CursorSpaceFireControlPolicy;
    readonly playerRadius: number;
    readonly playerFollowResponse: number;
    readonly playerMaximumSpeed: number;
    readonly playerAcceleration: number;
    readonly playerDeceleration: number;
    readonly playerMaximumHealth: number;
    readonly playerCollisionDamage: number;
    readonly playerHitInvulnerabilityDuration: number;
    readonly playerNoseOffset: number;
    readonly playerAimResponse: number;
    readonly projectileSpeed: number;
    readonly projectileLife: number;
    readonly projectileRadius: number;
    readonly playerProjectileDamage: number;
    readonly fireInterval: number;
    readonly minimumFleetFireInterval: number;
    readonly fireSupportDensityPerLevel: number;
    readonly escortUnlockLevel: number;
    readonly escortCapacity: number;
    readonly escortRadius: number;
    readonly fireSupportCapacity: number;
    readonly autoAimRange: number;
    readonly autoFireTolerance: number;
    readonly inheritedVelocity: number;
    readonly enemyRadius: number;
    readonly enemySpeedTiers: readonly [number, number, number];
    readonly enemyHealthTiers: readonly [number, number, number];
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
    readonly enemyProjectileDamage: number;
    readonly enemyTierThreeProjectileDamage: number;
    readonly enemyProjectileNoseOffset: number;
    readonly enemyProjectileArmDistance: number;
    readonly enemyFireRange: number;
    readonly enemyFireTolerance: number;
    readonly enemyTierOneFireInterval: number;
    readonly enemyTierTwoBurstInterval: number;
    readonly enemyTierTwoBurstSize: number;
    readonly enemyTierTwoCooldown: number;
    readonly enemyTierThreeFireInterval: number;
    readonly respawnDelay: number;
    readonly invulnerabilityDuration: number;
    readonly respawnClearRadius: number;
    readonly projectileCapacity: number;
    readonly enemyCapacity: number;
    readonly effectCapacity: number;
}

export const cursorSpaceConfig: CursorSpaceConfig = {
    playerRadius: 10,
    playerFollowResponse: 8.5,
    playerMaximumSpeed: 540,
    playerAcceleration: 1_050,
    playerDeceleration: 1_360,
    playerMaximumHealth: 1,
    playerCollisionDamage: 1,
    playerHitInvulnerabilityDuration: 0,
    playerNoseOffset: 19,
    playerAimResponse: 24,
    projectileSpeed: 610,
    projectileLife: 1.7,
    projectileRadius: 2.6,
    playerProjectileDamage: 1,
    fireInterval: 0.2,
    minimumFleetFireInterval: 0.085,
    fireSupportDensityPerLevel: 0.055,
    escortUnlockLevel: 4,
    escortCapacity: 2,
    escortRadius: 7,
    fireSupportCapacity: 14,
    autoAimRange: 680,
    autoFireTolerance: Math.PI * 0.012,
    inheritedVelocity: 0.16,
    enemyRadius: 11,
    enemySpeedTiers: [108, 142, 188],
    enemyHealthTiers: [1, 1, 1],
    enemyTurnRate: 3.05,
    enemyAvoidanceHorizon: 0.72,
    enemyAvoidanceRadius: 58,
    enemyAvoidanceWeight: 3.2,
    enemyAvoidanceTurnBoost: 2.8,
    enemySpawnInterval: 1.05,
    enemyMinimumSpawnInterval: 0.26,
    enemyProjectileSpeed: 370,
    enemyProjectileLife: 2.8,
    enemyProjectileRadius: 3.4,
    enemyProjectileDamage: 1,
    enemyTierThreeProjectileDamage: 1,
    enemyProjectileNoseOffset: 15,
    enemyProjectileArmDistance: 30,
    enemyFireRange: 620,
    enemyFireTolerance: Math.PI * 0.14,
    enemyTierOneFireInterval: 1.05,
    enemyTierTwoBurstInterval: 0.13,
    enemyTierTwoBurstSize: 5,
    enemyTierTwoCooldown: 0.68,
    enemyTierThreeFireInterval: 0.09,
    respawnDelay: 0.8,
    invulnerabilityDuration: 0.65,
    respawnClearRadius: 96,
    projectileCapacity: 512,
    enemyCapacity: 48,
    effectCapacity: 240,
};
