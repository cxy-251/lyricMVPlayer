import { MazeChaseAutopilot } from './MazeChaseAutopilot';
import { MazeChaseModel } from './MazeChaseModel';
import type {
    MazeChaseControllerMode,
    MazeChaseDirection,
    MazeChaseViewState,
} from './MazeChaseTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_DECISION_INTERVAL = 0.075;
const RESULT_HOLD = 1.25;

export class MazeChaseViewModel {
    private readonly model = new MazeChaseModel();
    private readonly autopilot = new MazeChaseAutopilot();
    private controller: MazeChaseControllerMode = 'autopilot';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiElapsed = AI_DECISION_INTERVAL;
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
            if (this.aiElapsed >= AI_DECISION_INTERVAL) {
                this.aiElapsed %= AI_DECISION_INTERVAL;
                const direction = this.autopilot.decide(this.model.createObservation());
                if (direction) {
                    this.model.setDesiredDirection(direction);
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
        return this.consumeDirty();
    }

    setDirectionFromHuman(direction: MazeChaseDirection): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        if (this.model.phase !== 'playing') {
            this.model.reset();
        }
        this.model.setDesiredDirection(direction);
        this.dirty = true;
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
        this.aiElapsed = AI_DECISION_INTERVAL;
        this.resultElapsed = 0;
        this.paused = false;
        this.dirty = true;
    }

    dispose(): void {}

    createViewState(): MazeChaseViewState {
        const observation = this.model.createObservation();
        const status = this.paused
            ? 'PAUSED'
            : observation.phase === 'won'
                ? 'MAZE CLEARED'
                : observation.phase === 'lost'
                    ? 'RUN ENDED'
                    : this.controller === 'autopilot'
                        ? 'AI NAVIGATING'
                        : 'HUMAN';
        return {
            ...observation,
            score: this.model.score,
            lives: this.model.lives,
            remainingPellets: this.model.remainingPellets,
            controller: this.controller,
            status,
            hint: observation.phase !== 'playing'
                ? this.controller === 'autopilot'
                    ? 'AI WILL START A NEW RUN'
                    : 'PRESS A DIRECTION OR NEW'
                : this.controller === 'autopilot'
                    ? 'AI ACTIVE — MOVE TO TAKE OVER'
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
            this.aiElapsed = AI_DECISION_INTERVAL;
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
        this.aiElapsed = AI_DECISION_INTERVAL;
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private consumeDirty(): boolean {
        const changed = this.dirty;
        this.dirty = false;
        return changed;
    }
}
