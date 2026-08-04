import { SnakeAutopilot } from './SnakeAutopilot';
import { SnakeModel } from './SnakeModel';
import type {
    SnakeControllerMode,
    SnakeDirection,
    SnakeViewState,
} from './SnakeTypes';

const AI_TAKEOVER_DELAY = 3;
const RESULT_HOLD = 1.25;
const RENDER_INTERVAL = 1 / 30;

export class SnakeViewModel {
    private readonly model = new SnakeModel();
    private readonly autopilot = new SnakeAutopilot();
    private controller: SnakeControllerMode = 'autopilot';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private resultElapsed = 0;
    private renderElapsed = RENDER_INTERVAL;
    private bestScore = 0;
    private paused = false;
    private dirty = true;

    update(deltaTime: number): boolean {
        if (this.paused) {
            return false;
        }
        const dt = Math.max(0, Math.min(0.1, deltaTime));
        this.renderElapsed += dt;

        if (this.controller === 'human') {
            this.humanIdleElapsed += dt;
            if (this.humanIdleElapsed >= AI_TAKEOVER_DELAY) {
                this.controller = 'autopilot';
                this.resultElapsed = 0;
                this.dirty = true;
            }
        }

        if (this.controller === 'autopilot' && this.model.phase === 'playing') {
            const direction = this.autopilot.decide(this.model.createObservation());
            if (direction) {
                this.model.setDirection(direction);
            }
        }

        const moved = this.model.step(dt);
        if (moved > 0) {
            this.bestScore = Math.max(this.bestScore, this.model.score);
            this.dirty = true;
        }

        if (this.model.phase === 'lost' && this.controller === 'autopilot') {
            this.resultElapsed += dt;
            if (this.resultElapsed >= RESULT_HOLD) {
                this.model.reset();
                this.resultElapsed = 0;
                this.dirty = true;
            }
        }

        if (!this.dirty && this.renderElapsed < RENDER_INTERVAL) {
            return false;
        }
        this.renderElapsed %= RENDER_INTERVAL;
        this.dirty = false;
        return true;
    }

    directionFromHuman(direction: SnakeDirection): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        if (this.model.phase === 'lost') {
            this.model.reset();
        }
        this.dirty = this.model.setDirection(direction) || this.dirty;
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
        this.resultElapsed = 0;
        this.paused = false;
        this.dirty = true;
    }

    dispose(): void {}

    createViewState(): SnakeViewState {
        const observation = this.model.createObservation();
        const phase = this.paused ? 'paused' : observation.phase;
        const status = phase === 'lost'
            ? 'CRASHED'
            : phase === 'paused'
                ? 'PAUSED'
                : this.controller === 'autopilot'
                    ? 'AI PLAYING'
                    : 'HUMAN';
        return {
            ...observation,
            phase,
            controller: this.controller,
            score: this.model.score,
            bestScore: this.bestScore,
            speed: this.model.speed,
            status,
            hint: phase === 'lost'
                ? 'PRESS A DIRECTION OR RESTART'
                : this.controller === 'autopilot'
                    ? 'AI ACTIVE — SWIPE OR PRESS A DIRECTION TO TAKE OVER'
                    : 'ARROWS / WASD / SWIPE',
        };
    }

    private activateHuman(): void {
        this.controller = 'human';
        this.humanIdleElapsed = 0;
        this.resultElapsed = 0;
        this.dirty = true;
    }
}
