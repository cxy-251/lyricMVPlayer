import { FixedStepClock } from '../../../animation/FixedStepClock';
import { CursorSpaceAutopilot } from '../CursorSpaceAutopilot';
import { CursorSpaceModel } from '../CursorSpaceModel';
import type { CursorSpaceBounds } from '../CursorSpaceTypes';
import type {
    CursorSpaceRenderCapacity,
    CursorSpaceViewState,
} from './CursorSpaceViewTypes';

const RENDER_STEP = 1 / 30;
const AI_TAKEOVER_DELAY = 2.5;
const ENEMY_HIT_EXPLOSION_DURATION = 0.24;
const MAX_VISIBLE_HIT_EXPLOSIONS = 32;

interface MutableHitExplosion {
    x: number;
    y: number;
    life: number;
    angle: number;
}

export class CursorSpaceViewModel {
    private readonly clock = new FixedStepClock(1 / 60, 6);
    private readonly model = new CursorSpaceModel();
    private readonly autopilot = new CursorSpaceAutopilot();
    private readonly enemyHealthSnapshot = new Array<number>(this.model.enemies.length).fill(0);
    private readonly hitExplosions: MutableHitExplosion[] = [];
    private renderAccumulator = 0;
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiActive = true;
    private paused = false;

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
        this.clock.reset();
        this.renderAccumulator = 0;
    }

    dispose(): void {
        this.model.clearTarget();
        this.autopilot.reset();
        this.hitExplosions.length = 0;
        this.clock.reset();
        this.renderAccumulator = 0;
    }

    createViewState(): CursorSpaceViewState {
        const stats = this.model.stats;
        const player = this.model.player;
        const controller = this.aiActive ? 'AI' : 'HUMAN';
        const speed = Math.round(Math.hypot(player.velocity.x, player.velocity.y));

        return {
            player,
            enemies: this.model.enemies,
            projectiles: this.model.projectiles,
            effects: this.model.effects,
            hitExplosions: this.hitExplosions,
            stats: `${controller} L${stats.level}`
                + `  HULL ${player.health}/${player.maximumHealth}`
                + `  WING ${player.escortCount}`
                + `  SPD ${speed}`
                + `  K ${stats.enemiesDestroyedByPlayer}`
                + `  ALL ${stats.enemiesDestroyed}`
                + `  D ${stats.playerDeaths}`,
        };
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
