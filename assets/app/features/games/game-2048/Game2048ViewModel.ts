import { Game2048Autopilot } from './Game2048Autopilot';
import { Game2048Model } from './Game2048Model';
import type {
    Game2048ControllerMode,
    Game2048Direction,
    Game2048ViewState,
} from './Game2048Types';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.28;
const RESULT_HOLD = 1.4;
const RENDER_INTERVAL = 1 / 20;

export class Game2048ViewModel {
    private readonly model = new Game2048Model();
    private readonly autopilot = new Game2048Autopilot();
    private controller: Game2048ControllerMode = 'autopilot';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiActionElapsed = AI_ACTION_INTERVAL;
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
                this.aiActionElapsed = AI_ACTION_INTERVAL;
                this.dirty = true;
            }
        }
        if (this.controller === 'autopilot') {
            this.updateAutopilot(dt);
        }
        if (!this.dirty && this.renderElapsed < RENDER_INTERVAL) {
            return false;
        }
        this.renderElapsed %= RENDER_INTERVAL;
        this.dirty = false;
        return true;
    }

    moveFromHuman(direction: Game2048Direction): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        if (this.model.phase === 'lost') {
            this.model.reset();
        }
        this.dirty = this.model.move(direction) || this.dirty;
        this.bestScore = Math.max(this.bestScore, this.model.score);
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
        this.aiActionElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.paused = false;
        this.dirty = true;
    }

    dispose(): void {}

    createViewState(): Game2048ViewState {
        const observation = this.model.createObservation();
        const phase = this.paused ? 'paused' : observation.phase;
        const mode = this.model.ruleSet.toUpperCase();
        return {
            ...observation,
            phase,
            controller: this.controller,
            score: this.model.score,
            bestScore: this.bestScore,
            maximumTile: this.model.maximumTile,
            chain: this.model.chain,
            bestChain: this.model.bestChain,
            targetTile: this.model.targetTile,
            ruleSet: this.model.ruleSet,
            eventText: this.model.eventText,
            status: phase === 'lost'
                ? `NO MOVES · ${mode}`
                : phase === 'paused'
                    ? 'PAUSED'
                    : this.controller === 'autopilot'
                        ? `AI · ${mode}`
                        : `HUMAN · ${mode}`,
            hint: phase === 'lost'
                ? 'SWIPE OR PRESS NEW TO ROTATE THE RULE SET'
                : this.model.eventText.startsWith('TARGET')
                    ? this.model.eventText
                    : this.controller === 'autopilot'
                        ? 'AI ACTIVE — SWIPE OR PRESS A DIRECTION TO TAKE OVER'
                        : `${this.model.eventText} · ARROWS / WASD / SWIPE`,
        };
    }

    private updateAutopilot(dt: number): void {
        if (this.model.phase === 'lost') {
            this.resultElapsed += dt;
            if (this.resultElapsed >= RESULT_HOLD) {
                this.model.reset();
                this.aiActionElapsed = 0;
                this.resultElapsed = 0;
                this.dirty = true;
            }
            return;
        }
        this.resultElapsed = 0;
        this.aiActionElapsed += dt;
        if (this.aiActionElapsed < AI_ACTION_INTERVAL) {
            return;
        }
        this.aiActionElapsed %= AI_ACTION_INTERVAL;
        const direction = this.autopilot.decide(this.model.createObservation());
        if (direction) {
            this.model.move(direction);
            this.bestScore = Math.max(this.bestScore, this.model.score);
            this.dirty = true;
        }
    }

    private activateHuman(): void {
        this.controller = 'human';
        this.humanIdleElapsed = 0;
        this.aiActionElapsed = 0;
        this.resultElapsed = 0;
        this.dirty = true;
    }
}
