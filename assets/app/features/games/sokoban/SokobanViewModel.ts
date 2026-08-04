import { SokobanAutopilot } from './SokobanAutopilot';
import { SokobanModel } from './SokobanModel';
import type {
    SokobanControllerMode,
    SokobanDirection,
    SokobanViewState,
} from './SokobanTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.11;
const AI_RESULT_HOLD = 1.1;
const SEARCH_BUDGET_PER_FRAME = 220;
const RENDER_INTERVAL = 1 / 20;

export class SokobanViewModel {
    private readonly model = new SokobanModel();
    private readonly autopilot = new SokobanAutopilot();
    private controller: SokobanControllerMode = 'autopilot';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiActionElapsed = AI_ACTION_INTERVAL;
    private resultElapsed = 0;
    private renderElapsed = RENDER_INTERVAL;
    private paused = false;
    private dirty = true;

    get width(): number {
        return this.model.width;
    }

    get height(): number {
        return this.model.height;
    }

    update(deltaTime: number): boolean {
        if (this.paused) {
            return false;
        }
        const dt = Math.max(0, Math.min(0.1, deltaTime));
        this.renderElapsed += dt;

        if (this.controller === 'human') {
            this.humanIdleElapsed += dt;
            if (this.humanIdleElapsed >= AI_TAKEOVER_DELAY) {
                this.activateAutopilot();
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

    moveFromHuman(direction: SokobanDirection): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        this.dirty = this.model.move(direction) || this.dirty;
    }

    undoFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        this.dirty = this.model.undo() || this.dirty;
    }

    restartFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        this.model.restartLevel();
        this.dirty = true;
    }

    previousLevelFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        this.model.previousLevel();
        this.dirty = true;
    }

    nextLevelFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        this.model.nextLevel();
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
        this.model.restartLevel();
        this.autopilot.reset();
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiActionElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.renderElapsed = RENDER_INTERVAL;
        this.paused = false;
        this.dirty = true;
    }

    dispose(): void {
        this.autopilot.reset();
    }

    createViewState(): SokobanViewState {
        const phase = this.paused ? 'paused' : this.model.phase;
        const planning = this.controller === 'autopilot'
            && this.model.phase === 'playing'
            && this.autopilot.planning;
        const status = phase === 'won'
            ? 'LEVEL CLEARED'
            : phase === 'paused'
                ? 'PAUSED'
                : this.model.deadlocked
                    ? 'DEADLOCK — UNDO'
                    : this.controller === 'autopilot'
                        ? planning ? 'AI PLANNING' : 'AI PLAYING'
                        : 'HUMAN';
        return {
            width: this.model.width,
            height: this.model.height,
            cells: this.model.createCellViewStates(),
            phase,
            controller: this.controller,
            levelIndex: this.model.levelIndex,
            levelCount: this.model.levelCount,
            levelName: this.model.levelName,
            steps: this.model.steps,
            pushes: this.model.pushes,
            canUndo: this.model.canUndo,
            deadlocked: this.model.deadlocked,
            planning,
            status,
            stats: `LEVEL ${this.model.levelIndex + 1}/${this.model.levelCount}`
                + `  STEPS ${this.model.steps}`
                + `  PUSHES ${this.model.pushes}`,
            hint: phase === 'won'
                ? this.controller === 'autopilot'
                    ? 'AI WILL LOAD THE NEXT LEVEL'
                    : 'NEXT LEVEL OR WAIT FOR AI'
                : this.controller === 'autopilot'
                    ? planning
                        ? 'SEARCHING PUSH STATES — MOVE TO TAKE OVER'
                        : 'AI ACTIVE — MOVE TO TAKE OVER'
                    : 'ARROWS / WASD / SWIPE — Z TO UNDO',
        };
    }

    private updateAutopilot(dt: number): void {
        if (this.model.phase === 'won') {
            this.resultElapsed += dt;
            if (this.resultElapsed >= AI_RESULT_HOLD) {
                this.model.nextLevel();
                this.autopilot.reset();
                this.aiActionElapsed = AI_ACTION_INTERVAL;
                this.resultElapsed = 0;
                this.dirty = true;
            }
            return;
        }

        this.resultElapsed = 0;
        if (this.model.deadlocked) {
            this.recoverAutopilot();
            return;
        }

        const wasPlanning = this.autopilot.planning;
        this.autopilot.update(
            this.model.createObservation(),
            SEARCH_BUDGET_PER_FRAME,
        );
        if (wasPlanning !== this.autopilot.planning) {
            this.dirty = true;
        }
        if (this.autopilot.consumeFailure()) {
            this.recoverAutopilot();
            return;
        }

        this.aiActionElapsed += dt;
        if (this.aiActionElapsed < AI_ACTION_INTERVAL) {
            return;
        }
        const direction = this.autopilot.takeAction();
        if (!direction) {
            return;
        }
        this.aiActionElapsed %= AI_ACTION_INTERVAL;
        if (!this.model.move(direction)) {
            this.autopilot.reset();
        }
        this.dirty = true;
    }

    private recoverAutopilot(): void {
        if (!this.model.undo()) {
            this.model.restartLevel();
        }
        this.autopilot.reset();
        this.aiActionElapsed = 0;
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private activateHumanControl(): void {
        this.controller = 'human';
        this.humanIdleElapsed = 0;
        this.aiActionElapsed = 0;
        this.resultElapsed = 0;
        this.autopilot.reset();
        this.dirty = true;
    }

    private activateAutopilot(): void {
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiActionElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.autopilot.reset();
        this.dirty = true;
    }
}
