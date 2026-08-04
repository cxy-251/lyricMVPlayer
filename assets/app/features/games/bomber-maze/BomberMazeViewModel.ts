import { BomberMazeAutopilot } from './BomberMazeAutopilot';
import { BomberMazeModel } from './BomberMazeModel';
import type {
    BomberMazeControllerMode,
    BomberMazeDirection,
    BomberMazeViewState,
} from './BomberMazeTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.15;
const RESULT_HOLD = 1.35;
const RENDER_INTERVAL = 1 / 30;

export class BomberMazeViewModel {
    private readonly model = new BomberMazeModel();
    private readonly autopilot = new BomberMazeAutopilot();
    private controller: BomberMazeControllerMode = 'autopilot';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiElapsed = AI_ACTION_INTERVAL;
    private resultElapsed = 0;
    private renderElapsed = RENDER_INTERVAL;
    private paused = false;
    private dirty = true;

    update(deltaTime: number): boolean {
        if (this.paused) {
            return false;
        }
        const dt = Math.max(0, Math.min(0.1, deltaTime));
        this.renderElapsed += dt;

        if (this.model.phase !== 'playing') {
            return this.updateTerminalState(dt);
        }

        if (this.controller === 'human') {
            this.humanIdleElapsed += dt;
            if (this.humanIdleElapsed >= AI_TAKEOVER_DELAY) {
                this.activateAutopilot();
            }
        }

        if (this.controller === 'autopilot') {
            this.aiElapsed += dt;
            if (this.aiElapsed >= AI_ACTION_INTERVAL) {
                this.aiElapsed %= AI_ACTION_INTERVAL;
                const action = this.autopilot.decide(this.model.createObservation());
                if (action && this.model.perform(action)) {
                    this.dirty = true;
                }
            }
        }

        if (this.model.step(dt)) {
            this.dirty = true;
        }
        if (this.model.phase !== 'playing') {
            this.resultElapsed = 0;
            this.dirty = true;
        }
        return this.consumeRender();
    }

    moveFromHuman(direction: BomberMazeDirection): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        this.dirty = this.model.movePlayer(direction) || this.dirty;
    }

    placeBombFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        this.dirty = this.model.placeBomb() || this.dirty;
    }

    restartFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.model.reset();
        this.dirty = true;
    }

    pause(): void {
        this.paused = true;
        this.dirty = true;
    }

    resume(): void {
        this.paused = false;
        this.renderElapsed = RENDER_INTERVAL;
        this.dirty = true;
    }

    reset(): void {
        this.model.reset();
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.renderElapsed = RENDER_INTERVAL;
        this.paused = false;
        this.dirty = true;
    }

    dispose(): void {}

    createViewState(): BomberMazeViewState {
        const observation = this.model.createObservation();
        const phase = this.paused ? 'paused' : observation.phase;
        const status = phase === 'won'
            ? 'MAZE CLEARED'
            : phase === 'lost'
                ? 'RUN ENDED'
                : phase === 'paused'
                    ? 'PAUSED'
                    : this.controller === 'autopilot'
                        ? 'AI PLANNING ESCAPES'
                        : 'HUMAN';
        return {
            ...observation,
            phase,
            controller: this.controller,
            score: this.model.score,
            lives: this.model.lives,
            status,
            stats: `SCORE ${this.model.score}`
                + `   LIVES ${this.model.lives}`
                + `   ENEMIES ${observation.enemies.length}`
                + `   BOMBS ${observation.activeBombs}/${observation.bombCapacity}`
                + `   RANGE ${observation.blastRange}`,
            hint: phase === 'won' || phase === 'lost'
                ? this.controller === 'autopilot'
                    ? 'AI WILL START A NEW MAZE'
                    : 'MOVE, BOMB OR PRESS NEW'
                : this.controller === 'autopilot'
                    ? 'AI ACTIVE — MOVE OR DROP A BOMB TO TAKE OVER'
                    : 'ARROWS / WASD / SWIPE   F OR B TO BOMB',
            invulnerable: this.model.invulnerable,
        };
    }

    private updateTerminalState(dt: number): boolean {
        if (this.controller === 'human') {
            this.humanIdleElapsed += dt;
            if (this.humanIdleElapsed >= AI_TAKEOVER_DELAY) {
                this.activateAutopilot();
            }
            return this.consumeRender();
        }

        this.resultElapsed += dt;
        if (this.resultElapsed >= RESULT_HOLD) {
            this.model.reset();
            this.resultElapsed = 0;
            this.aiElapsed = AI_ACTION_INTERVAL;
            this.dirty = true;
        }
        return this.consumeRender();
    }

    private restartTerminalIfNeeded(): void {
        if (this.model.phase === 'playing') {
            return;
        }
        this.model.reset();
        this.resultElapsed = 0;
        this.aiElapsed = 0;
        this.dirty = true;
    }

    private activateHuman(): void {
        this.controller = 'human';
        this.humanIdleElapsed = 0;
        this.aiElapsed = 0;
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private activateAutopilot(): void {
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private consumeRender(): boolean {
        if (!this.dirty && this.renderElapsed < RENDER_INTERVAL) {
            return false;
        }
        this.renderElapsed %= RENDER_INTERVAL;
        this.dirty = false;
        return true;
    }
}
