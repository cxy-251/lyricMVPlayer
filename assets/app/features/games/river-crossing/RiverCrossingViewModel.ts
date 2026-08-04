import { RiverCrossingAutopilot } from './RiverCrossingAutopilot';
import { RiverCrossingModel } from './RiverCrossingModel';
import type {
    RiverCrossingControllerMode,
    RiverCrossingDirection,
    RiverCrossingViewState,
} from './RiverCrossingTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.22;
const RESULT_HOLD = 1.25;

export class RiverCrossingViewModel {
    private readonly model = new RiverCrossingModel();
    private readonly autopilot = new RiverCrossingAutopilot();
    private controller: RiverCrossingControllerMode = 'autopilot';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiElapsed = AI_ACTION_INTERVAL;
    private resultElapsed = 0;
    private paused = false;
    private dirty = true;

    update(deltaTime: number): boolean {
        if (this.paused) {
            return false;
        }
        const dt = Math.max(0, Math.min(0.1, deltaTime));

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
                if (action && this.model.move(action)) {
                    this.dirty = true;
                }
            }
        }

        if (this.model.phase === 'playing' && this.model.step(dt)) {
            this.dirty = true;
        }
        if (this.model.phase !== 'playing') {
            this.resultElapsed = 0;
            this.dirty = true;
        }
        return this.consumeDirty();
    }

    moveFromHuman(direction: RiverCrossingDirection): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        if (this.model.phase !== 'playing') {
            this.model.reset();
        }
        this.dirty = this.model.move(direction) || this.dirty;
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
        this.dirty = true;
    }

    reset(): void {
        this.model.reset();
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.paused = false;
        this.dirty = true;
    }

    dispose(): void {}

    createViewState(): RiverCrossingViewState {
        const observation = this.model.createObservation();
        const status = this.paused
            ? 'PAUSED'
            : observation.phase === 'won'
                ? 'CROSSING COMPLETE'
                : observation.phase === 'lost'
                    ? 'NO LIVES LEFT'
                    : this.controller === 'autopilot'
                        ? 'AI TIMING HOPS'
                        : 'HUMAN';
        return {
            ...observation,
            score: this.model.score,
            lives: this.model.lives,
            crossings: this.model.crossings,
            targetCrossings: this.model.targetCrossings,
            controller: this.controller,
            status,
            hint: observation.phase !== 'playing'
                ? this.controller === 'autopilot'
                    ? 'AI WILL START A NEW RUN'
                    : 'PRESS A DIRECTION OR NEW'
                : this.controller === 'autopilot'
                    ? 'AI ACTIVE — HOP TO TAKE OVER'
                    : 'ARROWS / WASD / SWIPE',
        };
    }

    private updateTerminalState(dt: number): boolean {
        if (this.controller === 'human') {
            this.humanIdleElapsed += dt;
            if (this.humanIdleElapsed >= AI_TAKEOVER_DELAY) {
                this.activateAutopilot();
            }
            return this.consumeDirty();
        }

        this.resultElapsed += dt;
        if (this.resultElapsed >= RESULT_HOLD) {
            this.model.reset();
            this.resultElapsed = 0;
            this.aiElapsed = AI_ACTION_INTERVAL;
            this.dirty = true;
        }
        return this.consumeDirty();
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

    private consumeDirty(): boolean {
        const changed = this.dirty;
        this.dirty = false;
        return changed;
    }
}
