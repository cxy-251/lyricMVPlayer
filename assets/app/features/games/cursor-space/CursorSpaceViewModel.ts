import { FixedStepClock } from '../../../animation/FixedStepClock';
import {
    CursorSpaceAutopilot,
    CursorSpaceModel,
    type CursorSpaceBounds,
} from './CursorSpaceModel';
import type {
    CursorSpaceEffectKind,
    CursorSpaceEffectRenderState,
    CursorSpaceEnemyRenderState,
    CursorSpaceEscortRenderState,
    CursorSpacePlayerRenderState,
    CursorSpaceProjectileOwner,
    CursorSpaceProjectileRenderState,
    CursorSpaceRenderCapacity,
    CursorSpaceVectorRenderState,
    CursorSpaceViewState,
} from './CursorSpaceViewTypes';

const RENDER_STEP = 1 / 30;
const AI_TAKEOVER_DELAY = 2.5;
const ENEMY_HIT_EXPLOSION_DURATION = 0.24;
const MAX_VISIBLE_HIT_EXPLOSIONS = 32;
const MAXIMUM_ESCORTS = 2;

type CursorSpaceMission = 'hunter' | 'survivor' | 'ace';
const MISSIONS: readonly CursorSpaceMission[] = ['hunter', 'survivor', 'ace'];

interface MutableVectorRenderState {
    x: number;
    y: number;
}

interface MutablePlayerRenderState {
    position: MutableVectorRenderState;
    velocity: MutableVectorRenderState;
    rotation: number;
    alive: boolean;
    invulnerableRemaining: number;
    health: number;
    maximumHealth: number;
    escortCount: number;
    escortSide: -1 | 1;
}

interface MutableEscortRenderState {
    active: boolean;
    x: number;
    y: number;
    rotation: number;
}

interface MutableEnemyRenderState {
    active: boolean;
    position: MutableVectorRenderState;
    rotation: number;
    speedTier: 1 | 2 | 3;
    health: number;
    maximumHealth: number;
}

interface MutableProjectileRenderState {
    active: boolean;
    owner: CursorSpaceProjectileOwner;
    position: MutableVectorRenderState;
    velocity: MutableVectorRenderState;
}

interface MutableEffectRenderState {
    active: boolean;
    kind: CursorSpaceEffectKind;
    position: MutableVectorRenderState;
    velocity: MutableVectorRenderState;
    radius: number;
}

interface MutableHitExplosion {
    x: number;
    y: number;
    life: number;
    angle: number;
}

interface MutableViewState {
    player: CursorSpacePlayerRenderState;
    escorts: readonly CursorSpaceEscortRenderState[];
    enemies: readonly CursorSpaceEnemyRenderState[];
    projectiles: readonly CursorSpaceProjectileRenderState[];
    effects: readonly CursorSpaceEffectRenderState[];
    hitExplosions: readonly MutableHitExplosion[];
    stats: string;
}

export class CursorSpaceViewModel {
    private readonly clock = new FixedStepClock(1 / 60, 6);
    private readonly model = new CursorSpaceModel();
    private readonly autopilot = new CursorSpaceAutopilot();
    private readonly enemyHealthSnapshot = new Array<number>(this.model.enemies.length).fill(0);
    private readonly hitExplosions: MutableHitExplosion[] = [];
    private readonly renderPlayer = createPlayerRenderState();
    private readonly renderEscorts = Array.from(
        { length: MAXIMUM_ESCORTS },
        createEscortRenderState,
    );
    private readonly renderEnemies = this.model.enemies.map(createEnemyRenderState);
    private readonly renderProjectiles = this.model.projectiles.map(createProjectileRenderState);
    private readonly renderEffects = this.model.effects.map(createEffectRenderState);
    private readonly renderState: MutableViewState = {
        player: this.renderPlayer,
        escorts: this.renderEscorts,
        enemies: this.renderEnemies,
        projectiles: this.renderProjectiles,
        effects: this.renderEffects,
        hitExplosions: this.hitExplosions,
        stats: '',
    };
    private renderAccumulator = 0;
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiActive = true;
    private paused = false;
    private missionIndex = 0;
    private missionNumber = 1;
    private missionStartLevel = 1;
    private missionStartKills = 0;
    private missionStartDeaths = 0;
    private completedMissions = 0;
    private missionMessage = '';
    private missionMessageElapsed = 0;

    constructor() {
        this.reset();
    }

    get renderCapacity(): CursorSpaceRenderCapacity {
        return {
            enemies: this.model.enemies.length,
            projectiles: this.model.projectiles.length,
            effects: this.model.effects.length,
        };
    }

    setBounds(bounds: CursorSpaceBounds): void {
        this.model.setBounds(bounds);
    }

    activateHumanControl(x: number, y: number): void {
        if (this.paused) {
            return;
        }
        if (this.aiActive) {
            this.autopilot.reset();
        }
        this.aiActive = false;
        this.humanIdleElapsed = 0;
        this.model.setTarget(x, y);
    }

    activateAutopilot(): void {
        if (this.paused || this.aiActive) {
            return;
        }
        this.aiActive = true;
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.model.clearTarget();
        this.autopilot.reset();
    }

    update(dt: number): boolean {
        if (this.paused) {
            return false;
        }

        const frameDelta = Math.max(0, Math.min(0.1, dt));
        const steps = this.clock.advance(frameDelta, 1, (step) => {
            if (!this.aiActive) {
                this.humanIdleElapsed += step;
                if (this.humanIdleElapsed >= AI_TAKEOVER_DELAY) {
                    this.activateAutopilot();
                }
            }
            if (this.aiActive) {
                this.autopilot.update(this.model, step);
            }
            this.model.step(step);
            this.updateHitFeedback(step);
            this.updateMission(step);
        });
        this.renderAccumulator += frameDelta;

        if (steps <= 0 || this.renderAccumulator < RENDER_STEP) {
            return false;
        }
        this.renderAccumulator %= RENDER_STEP;
        return true;
    }

    pause(): void {
        this.paused = true;
        this.model.clearTarget();
    }

    resume(): void {
        this.paused = false;
        this.renderAccumulator = RENDER_STEP;
    }

    reset(): void {
        this.model.reset();
        this.resetHitFeedback();
        this.resetControlState();
        this.resetMissionState();
        this.clock.reset();
        this.renderAccumulator = 0;
        this.syncRenderState();
    }

    dispose(): void {
        this.model.clearTarget();
        this.autopilot.reset();
        this.hitExplosions.length = 0;
        this.clock.reset();
        this.renderAccumulator = 0;
    }

    createViewState(): CursorSpaceViewState {
        this.syncRenderState();
        return this.renderState;
    }

    private syncRenderState(): void {
        const player = this.model.player;
        copyVector(this.renderPlayer.position, player.position);
        copyVector(this.renderPlayer.velocity, player.velocity);
        this.renderPlayer.rotation = player.rotation;
        this.renderPlayer.alive = player.alive;
        this.renderPlayer.invulnerableRemaining = player.invulnerableRemaining;
        this.renderPlayer.health = player.health;
        this.renderPlayer.maximumHealth = player.maximumHealth;
        this.renderPlayer.escortCount = player.escortCount;
        this.renderPlayer.escortSide = player.escortSide;

        for (let index = 0; index < this.renderEscorts.length; index += 1) {
            this.model.writeEscortPose(index, this.renderEscorts[index]);
        }

        for (let index = 0; index < this.renderEnemies.length; index += 1) {
            const source = this.model.enemies[index];
            const target = this.renderEnemies[index];
            target.active = source.active;
            copyVector(target.position, source.position);
            target.rotation = source.rotation;
            target.speedTier = source.speedTier;
            target.health = source.health;
            target.maximumHealth = source.maximumHealth;
        }

        for (let index = 0; index < this.renderProjectiles.length; index += 1) {
            const source = this.model.projectiles[index];
            const target = this.renderProjectiles[index];
            target.active = source.active;
            target.owner = source.owner;
            copyVector(target.position, source.position);
            copyVector(target.velocity, source.velocity);
        }

        for (let index = 0; index < this.renderEffects.length; index += 1) {
            const source = this.model.effects[index];
            const target = this.renderEffects[index];
            target.active = source.active;
            target.kind = source.kind;
            copyVector(target.position, source.position);
            copyVector(target.velocity, source.velocity);
            target.radius = source.radius;
        }

        const stats = this.model.stats;
        const controller = this.aiActive ? 'AI' : 'HUMAN';
        const speed = Math.round(Math.hypot(player.velocity.x, player.velocity.y));
        const mission = this.currentMission().toUpperCase();
        const message = this.missionMessageElapsed > 0 ? `  ${this.missionMessage}` : '';
        this.renderState.stats = `${controller} L${stats.level}`
            + `  H${player.health}/${player.maximumHealth}`
            + `  W${player.escortCount}`
            + `  F${player.fireSupportLevel}`
            + `  S${speed}`
            + `  K${stats.enemiesDestroyedByPlayer}`
            + `  D${stats.playerDeaths}`
            + `  M${this.missionNumber} ${mission} ${this.missionProgress()}/${this.missionTarget()}`
            + `  C${this.completedMissions}`
            + message;
    }

    private updateMission(dt: number): void {
        this.missionMessageElapsed = Math.max(0, this.missionMessageElapsed - dt);
        const stats = this.model.stats;
        if (
            this.currentMission() === 'ace'
            && stats.playerDeaths > this.missionStartDeaths
        ) {
            this.missionStartKills = stats.enemiesDestroyedByPlayer;
            this.missionStartDeaths = stats.playerDeaths;
            this.missionMessage = 'ACE RESET';
            this.missionMessageElapsed = 1.5;
            return;
        }
        if (this.missionProgress() >= this.missionTarget()) {
            this.completeMission();
        }
    }

    private completeMission(): void {
        const player = this.model.player;
        const mission = this.currentMission();
        if (mission === 'hunter') {
            player.fireSupportLevel = Math.min(6, player.fireSupportLevel + 1);
            this.missionMessage = 'FIRE +1';
        } else if (mission === 'survivor') {
            player.maximumHealth += 1;
            player.health = player.maximumHealth;
            this.missionMessage = 'HULL +1';
        } else if (player.escortCount < MAXIMUM_ESCORTS) {
            player.escortCount += 1;
            this.missionMessage = 'WING +1';
        } else {
            player.maximumHealth += 1;
            player.health = player.maximumHealth;
            this.missionMessage = 'WING MAX · HULL +1';
        }
        this.completedMissions += 1;
        this.missionNumber += 1;
        this.missionIndex = (this.missionIndex + 1) % MISSIONS.length;
        this.missionMessageElapsed = 3;
        this.captureMissionStart();
    }

    private resetMissionState(): void {
        this.missionIndex = 0;
        this.missionNumber = 1;
        this.completedMissions = 0;
        this.missionMessage = '';
        this.missionMessageElapsed = 0;
        this.captureMissionStart();
    }

    private captureMissionStart(): void {
        const stats = this.model.stats;
        this.missionStartLevel = stats.level;
        this.missionStartKills = stats.enemiesDestroyedByPlayer;
        this.missionStartDeaths = stats.playerDeaths;
    }

    private currentMission(): CursorSpaceMission {
        return MISSIONS[this.missionIndex] ?? 'hunter';
    }

    private missionProgress(): number {
        const stats = this.model.stats;
        if (this.currentMission() === 'survivor') {
            return Math.max(0, stats.level - this.missionStartLevel);
        }
        return Math.max(0, stats.enemiesDestroyedByPlayer - this.missionStartKills);
    }

    private missionTarget(): number {
        if (this.currentMission() === 'survivor') {
            return 2;
        }
        const tier = Math.floor((this.missionNumber - 1) / MISSIONS.length);
        return this.currentMission() === 'hunter'
            ? 8 + tier * 3
            : 6 + tier * 2;
    }

    private resetControlState(): void {
        this.aiActive = true;
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.model.clearTarget();
        this.autopilot.reset();
    }

    private resetHitFeedback(): void {
        this.hitExplosions.length = 0;
        for (let index = 0; index < this.enemyHealthSnapshot.length; index += 1) {
            const enemy = this.model.enemies[index];
            this.enemyHealthSnapshot[index] = enemy?.active ? enemy.health : 0;
        }
    }

    private updateHitFeedback(dt: number): void {
        for (let index = this.hitExplosions.length - 1; index >= 0; index -= 1) {
            const explosion = this.hitExplosions[index];
            explosion.life -= dt;
            if (explosion.life <= 0) {
                this.hitExplosions.splice(index, 1);
            }
        }

        for (let index = 0; index < this.model.enemies.length; index += 1) {
            const enemy = this.model.enemies[index];
            const previousHealth = this.enemyHealthSnapshot[index] ?? 0;
            if (enemy.active && enemy.health > 0 && previousHealth > enemy.health) {
                if (this.hitExplosions.length >= MAX_VISIBLE_HIT_EXPLOSIONS) {
                    this.hitExplosions.shift();
                }
                this.hitExplosions.push({
                    x: enemy.position.x,
                    y: enemy.position.y,
                    life: ENEMY_HIT_EXPLOSION_DURATION,
                    angle: (index * 2.399963229728653) % (Math.PI * 2),
                });
            }
            this.enemyHealthSnapshot[index] = enemy.active ? enemy.health : 0;
        }
    }
}

function createVectorRenderState(): MutableVectorRenderState {
    return { x: 0, y: 0 };
}

function createPlayerRenderState(): MutablePlayerRenderState {
    return {
        position: createVectorRenderState(),
        velocity: createVectorRenderState(),
        rotation: 0,
        alive: false,
        invulnerableRemaining: 0,
        health: 0,
        maximumHealth: 0,
        escortCount: 0,
        escortSide: 1,
    };
}

function createEscortRenderState(): MutableEscortRenderState {
    return { active: false, x: 0, y: 0, rotation: 0 };
}

function createEnemyRenderState(): MutableEnemyRenderState {
    return {
        active: false,
        position: createVectorRenderState(),
        rotation: 0,
        speedTier: 1,
        health: 0,
        maximumHealth: 0,
    };
}

function createProjectileRenderState(): MutableProjectileRenderState {
    return {
        active: false,
        owner: 'player',
        position: createVectorRenderState(),
        velocity: createVectorRenderState(),
    };
}

function createEffectRenderState(): MutableEffectRenderState {
    return {
        active: false,
        kind: 'fragment',
        position: createVectorRenderState(),
        velocity: createVectorRenderState(),
        radius: 0,
    };
}

function copyVector(
    target: MutableVectorRenderState,
    source: CursorSpaceVectorRenderState,
): void {
    target.x = source.x;
    target.y = source.y;
}
