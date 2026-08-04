import { FixedStepClock } from '../../../animation/FixedStepClock';
import { BrickBreakerAutopilot } from './BrickBreakerAutopilot';
import { BrickBreakerModel } from './BrickBreakerModel';
import type {
    BrickBreakerControllerMode,
    BrickBreakerViewState,
} from './BrickBreakerTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_RESULT_HOLD = 1.25;
const RENDER_STEP = 1 / 30;

export class BrickBreakerViewModel {
    private readonly clock = new FixedStepClock(1 / 60, 7);
    private readonly model = new BrickBreakerModel();
    private readonly autopilot = new BrickBreakerAutopilot();
    private controller: BrickBreakerControllerMode = 'autopilot';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private humanAxis = 0;
    private humanTargetNormalized: number | null = null;
    private resultElapsed = 0;
    private renderAccumulator = RENDER_STEP;
    private bestScore = 0;
    private paused = false;
    private dirty = true;

    update(deltaTime: number): boolean {
        if (this.paused) {
            return false;
        }
        const frameDelta = Math.max(0, Math.min(0.1, deltaTime));
        const steps = this.clock.advance(frameDelta, 1, (step) => {
            if (this.controller === 'human') {
                this.humanIdleElapsed += step;
                if (this.humanIdleElapsed >= AI_TAKEOVER_DELAY) {
                    this.activateAutopilot();
                }
            }

            if (this.controller === 'autopilot') {
                this.updateAutopilot(step);
            } else {
                this.applyHumanControl();
            }
            this.model.step(step);
            this.updateResultState(step);
        });

        this.bestScore = Math.max(this.bestScore, this.model.score);
        this.renderAccumulator += frameDelta;
        if (steps > 0) {
            this.dirty = true;
        }
        if (!this.dirty && this.renderAccumulator < RENDER_STEP) {
            return false;
        }
        this.renderAccumulator %= RENDER_STEP;
        this.dirty = false;
        return true;
    }

    humanAxisChanged(axis: number): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        this.humanTargetNormalized = null;
        this.humanAxis = Math.max(-1, Math.min(1, axis));
        this.dirty = true;
    }

    humanTargetChanged(normalizedX: number): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        this.humanTargetNormalized = Math.max(-1, Math.min(1, normalizedX));
        this.dirty = true;
    }

    humanPointerReleased(): void {
        if (this.paused || this.controller !== 'human') {
            return;
        }
        this.humanTargetNormalized = null;
        this.humanAxis = 0;
        this.model.setPaddleAxis(0);
    }

    launchFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        if (this.model.phase === 'lost') {
            this.resetHumanRun();
            return;
        }
        if (this.model.phase === 'won') {
            this.model.advanceLevel();
        }
        this.model.launch();
        this.resultElapsed = 0;
        this.dirty = true;
    }

    restartFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        this.resetHumanRun();
    }

    pause(): void {
        this.paused = true;
        this.model.setPaddleAxis(0);
        this.dirty = true;
    }

    resume(): void {
        this.paused = false;
        this.renderAccumulator = RENDER_STEP;
        this.dirty = true;
    }

    reset(): void {
        this.model.reset();
        this.autopilot.reset();
        this.clock.reset();
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.humanAxis = 0;
        this.humanTargetNormalized = null;
        this.resultElapsed = 0;
        this.renderAccumulator = RENDER_STEP;
        this.paused = false;
        this.dirty = true;
    }

    dispose(): void {
        this.model.setPaddleAxis(0);
        this.autopilot.reset();
        this.clock.reset();
    }

    createViewState(): BrickBreakerViewState {
        const phase = this.paused ? 'paused' : this.model.phase;
        const controllerName = this.controller === 'autopilot' ? 'AI' : 'HUMAN';
        const phaseName = phase === 'ready'
            ? 'READY'
            : phase === 'playing'
                ? 'BREAKING'
                : phase === 'won'
                    ? 'LEVEL CLEAR'
                    : phase === 'lost'
                        ? 'GAME OVER'
                        : 'PAUSED';
        return {
            phase,
            controller: this.controller,
            worldHalfWidth: this.model.worldHalfWidth,
            worldHalfHeight: this.model.worldHalfHeight,
            paddle: { ...this.model.paddle },
            balls: this.model.createBallViewStates(),
            bricks: this.model.createBrickViewStates(),
            powerups: this.model.createPowerupViewStates(),
            lives: this.model.lives,
            score: this.model.score,
            level: this.model.level,
            pierceRemaining: this.model.pierceRemaining,
            expandRemaining: this.model.expandRemaining,
            status: `${controllerName}  ${phaseName}`,
            scoreText: `SCORE ${this.model.score}`
                + `  BEST ${this.bestScore}`
                + `  LEVEL ${this.model.level}`
                + `  LIFE ${this.model.lives}`,
            hint: phase === 'lost'
                ? 'TAP, CLICK OR PRESS SPACE TO RESTART'
                : phase === 'won'
                    ? 'LEVEL CLEAR — NEXT BOARD IS READY'
                    : this.controller === 'autopilot'
                        ? 'AI ACTIVE — MOVE OR TOUCH TO TAKE OVER'
                        : phase === 'ready'
                            ? 'MOVE THE PADDLE, THEN TAP OR PRESS SPACE TO LAUNCH'
                            : 'DRAG, MOVE THE MOUSE OR USE LEFT AND RIGHT',
        };
    }

    private updateAutopilot(_step: number): void {
        if (this.model.phase === 'lost' || this.model.phase === 'won') {
            this.model.setPaddleAxis(0);
            return;
        }
        const control = this.autopilot.decide(this.model.createObservation());
        this.model.setPaddleAxis(control.axis);
        if (control.launch) {
            this.model.launch();
        }
    }

    private applyHumanControl(): void {
        if (this.humanTargetNormalized === null) {
            this.model.setPaddleAxis(this.humanAxis);
            return;
        }
        const halfRange = Math.max(
            1,
            this.model.worldHalfWidth - this.model.paddle.width / 2,
        );
        const targetX = this.humanTargetNormalized * halfRange;
        const error = targetX - this.model.paddle.x;
        this.model.setPaddleAxis(
            Math.abs(error) <= 1.5
                ? 0
                : Math.max(-1, Math.min(1, error / 26)),
        );
    }

    private updateResultState(step: number): void {
        if (this.model.phase !== 'lost' && this.model.phase !== 'won') {
            this.resultElapsed = 0;
            return;
        }
        this.resultElapsed += step;
        if (this.controller !== 'autopilot' || this.resultElapsed < AI_RESULT_HOLD) {
            return;
        }
        if (this.model.phase === 'won') {
            this.model.advanceLevel();
            this.model.launch();
        } else {
            this.model.reset();
        }
        this.autopilot.reset();
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private activateHumanControl(): void {
        if (this.controller === 'autopilot') {
            this.autopilot.reset();
        }
        this.controller = 'human';
        this.humanIdleElapsed = 0;
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private activateAutopilot(): void {
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.humanAxis = 0;
        this.humanTargetNormalized = null;
        this.resultElapsed = 0;
        this.autopilot.reset();
        this.dirty = true;
    }

    private resetHumanRun(): void {
        this.bestScore = Math.max(this.bestScore, this.model.score);
        this.model.reset();
        this.autopilot.reset();
        this.clock.reset();
        this.controller = 'human';
        this.humanIdleElapsed = 0;
        this.humanAxis = 0;
        this.humanTargetNormalized = null;
        this.resultElapsed = 0;
        this.renderAccumulator = RENDER_STEP;
        this.dirty = true;
    }
}
