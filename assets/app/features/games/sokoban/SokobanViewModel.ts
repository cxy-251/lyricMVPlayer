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
    private readonly bestSteps: Array<number | null> = Array.from(
        { length: this.model.levelCount },
        () => null,
    );
    private readonly bestPushes: Array<number | null> = Array.from(
        { length: this.model.levelCount },
        () => null,
    );
    private readonly stars: number[] = Array.from(
        { length: this.model.levelCount },
        () => 0,
    );
    private controller: SokobanControllerMode = 'autopilot';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiActionElapsed = AI_ACTION_INTERVAL;
    private resultElapsed = 0;
    private renderElapsed = RENDER_INTERVAL;
    private paused = false;
    private dirty = true;
    private undoCount = 0;
    private completionRecorded = false;

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
        this.recordCompletionIfNeeded();

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
        this.recordCompletionIfNeeded();
    }

    undoFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        if (this.model.undo()) {
            this.undoCount += 1;
            this.completionRecorded = false;
            this.dirty = true;
        }
    }

    restartFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        this.model.restartLevel();
        this.resetAttemptTracking();
        this.dirty = true;
    }

    previousLevelFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        this.model.previousLevel();
        this.resetAttemptTracking();
        this.dirty = true;
    }

    nextLevelFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        this.model.nextLevel();
        this.resetAttemptTracking();
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
        this.resetAttemptTracking();
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
        const level = this.model.levelIndex;
        const currentStars = this.stars[level] ?? 0;
        const bestSteps = this.bestSteps[level] ?? null;
        const bestPushes = this.bestPushes[level] ?? null;
        const status = phase === 'won'
            ? `LEVEL CLEARED · ${currentStars} STAR${currentStars === 1 ? '' : 'S'}`
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
            levelIndex: level,
            levelCount: this.model.levelCount,
            levelName: this.model.levelName,
            steps: this.model.steps,
            pushes: this.model.pushes,
            canUndo: this.model.canUndo,
            deadlocked: this.model.deadlocked,
            planning,
            stars: currentStars,
            totalStars: this.stars.reduce((sum, value) => sum + value, 0),
            bestSteps,
            bestPushes,
            undoCount: this.undoCount,
            status,
            stats: `LEVEL ${level + 1}/${this.model.levelCount}`
                + `  STEPS ${this.model.steps}`
                + `  PUSH ${this.model.pushes}`
                + `  BEST ${bestSteps ?? '-'}/${bestPushes ?? '-'}`
                + `  STARS ${this.stars.reduce((sum, value) => sum + value, 0)}`,
            hint: phase === 'won'
                ? this.controller === 'autopilot'
                    ? 'AI WILL LOAD THE NEXT LEVEL'
                    : currentStars < 3
                        ? 'REPLAY FOR 3 STARS OR LOAD NEXT LEVEL'
                        : 'THREE STARS · LOAD NEXT LEVEL'
                : this.controller === 'autopilot'
                    ? planning
                        ? 'SEARCHING PUSH STATES — MOVE TO TAKE OVER'
                        : 'AI ACTIVE — MOVE TO TAKE OVER'
                    : this.undoCount > 0
                        ? 'UNDO USED · 3-STAR RUN REQUIRES NO UNDO'
                        : 'ARROWS / WASD / SWIPE — Z TO UNDO',
        };
    }

    private updateAutopilot(dt: number): void {
        if (this.model.phase === 'won') {
            this.recordCompletionIfNeeded();
            this.resultElapsed += dt;
            if (this.resultElapsed >= AI_RESULT_HOLD) {
                this.model.nextLevel();
                this.autopilot.reset();
                this.aiActionElapsed = AI_ACTION_INTERVAL;
                this.resultElapsed = 0;
                this.resetAttemptTracking();
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
        this.recordCompletionIfNeeded();
        this.dirty = true;
    }

    private recoverAutopilot(): void {
        if (this.model.undo()) {
            this.undoCount += 1;
        } else {
            this.model.restartLevel();
            this.resetAttemptTracking();
        }
        this.autopilot.reset();
        this.aiActionElapsed = 0;
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private recordCompletionIfNeeded(): void {
        if (this.model.phase !== 'won' || this.completionRecorded) {
            return;
        }
        this.completionRecorded = true;
        const level = this.model.levelIndex;
        const boxCount = Math.max(1, this.model.createObservation().boxes.length);
        const threeStarPushes = boxCount * 3 + Math.floor(level / 3);
        const twoStarPushes = boxCount * 5 + level;
        const earned = this.undoCount === 0 && this.model.pushes <= threeStarPushes
            ? 3
            : this.model.pushes <= twoStarPushes
                ? 2
                : 1;
        this.stars[level] = Math.max(this.stars[level] ?? 0, earned);
        this.bestSteps[level] = this.minimumRecord(
            this.bestSteps[level] ?? null,
            this.model.steps,
        );
        this.bestPushes[level] = this.minimumRecord(
            this.bestPushes[level] ?? null,
            this.model.pushes,
        );
        this.dirty = true;
    }

    private minimumRecord(current: number | null, candidate: number): number {
        return current === null ? candidate : Math.min(current, candidate);
    }

    private resetAttemptTracking(): void {
        this.undoCount = 0;
        this.completionRecorded = false;
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
