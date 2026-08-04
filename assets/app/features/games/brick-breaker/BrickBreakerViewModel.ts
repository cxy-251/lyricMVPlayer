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

type BrickBreakerContract = 'blitz' | 'perfect' | 'multiball';
const CONTRACTS: readonly BrickBreakerContract[] = ['blitz', 'perfect', 'multiball'];

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
    private contractBonus = 0;
    private contractStreak = 0;
    private completedContracts = 0;
    private levelElapsed = 0;
    private levelStartLives = 3;
    private maximumActiveBalls = 1;
    private contractRecorded = false;
    private contractResult = 'CONTRACT READY';
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
            if (this.model.phase === 'playing') {
                this.levelElapsed += step;
            }
            this.model.step(step);
            this.maximumActiveBalls = Math.max(
                this.maximumActiveBalls,
                this.model.balls.filter((ball) => ball.active).length,
            );
            this.recordContractIfNeeded();
            this.updateResultState(step);
        });

        this.bestScore = Math.max(this.bestScore, this.totalScore());
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
            this.recordContractIfNeeded();
            this.model.advanceLevel();
            this.beginLevelTracking();
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
        this.contractBonus = 0;
        this.contractStreak = 0;
        this.completedContracts = 0;
        this.paused = false;
        this.beginLevelTracking();
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
        const contract = this.currentContract();
        const phaseName = phase === 'ready'
            ? 'READY'
            : phase === 'playing'
                ? 'BREAKING'
                : phase === 'won'
                    ? this.contractResult
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
            score: this.totalScore(),
            level: this.model.level,
            pierceRemaining: this.model.pierceRemaining,
            expandRemaining: this.model.expandRemaining,
            status: `${controllerName}  ${phaseName}`,
            scoreText: `S ${this.totalScore()}`
                + `  B ${this.bestScore}`
                + `  LV ${this.model.level}`
                + `  LIFE ${this.model.lives}`
                + `  C${this.contractStreak}`
                + `  ${contract.toUpperCase()}`,
            hint: phase === 'lost'
                ? `CONTRACTS ${this.completedContracts} · TAP OR SPACE TO RESTART`
                : phase === 'won'
                    ? `${this.contractResult} · NEXT CONTRACT ${this.nextContract().toUpperCase()}`
                    : contract === 'blitz'
                        ? `BLITZ: CLEAR WITHIN ${this.blitzTarget().toFixed(0)}S`
                        : contract === 'perfect'
                            ? 'PERFECT: CLEAR WITHOUT LOSING A LIFE'
                            : 'MULTIBALL: REACH THREE ACTIVE BALLS BEFORE CLEAR',
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
            this.recordContractIfNeeded();
            this.model.advanceLevel();
            this.beginLevelTracking();
            this.model.launch();
        } else {
            this.model.reset();
            this.contractBonus = 0;
            this.contractStreak = 0;
            this.completedContracts = 0;
            this.beginLevelTracking();
        }
        this.autopilot.reset();
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private recordContractIfNeeded(): void {
        if (this.model.phase !== 'won' || this.contractRecorded) {
            return;
        }
        this.contractRecorded = true;
        const contract = this.currentContract();
        const success = contract === 'blitz'
            ? this.levelElapsed <= this.blitzTarget()
            : contract === 'perfect'
                ? this.model.lives >= this.levelStartLives
                : this.maximumActiveBalls >= 3;
        if (success) {
            this.contractStreak += 1;
            this.completedContracts += 1;
            const bonus = 250 + this.model.level * 90 + this.contractStreak * 60;
            this.contractBonus += bonus;
            this.contractResult = `CONTRACT +${bonus}`;
        } else {
            this.contractStreak = 0;
            this.contractResult = 'CONTRACT MISSED';
        }
        this.bestScore = Math.max(this.bestScore, this.totalScore());
        this.dirty = true;
    }

    private beginLevelTracking(): void {
        this.levelElapsed = 0;
        this.levelStartLives = this.model.lives;
        this.maximumActiveBalls = Math.max(
            1,
            this.model.balls.filter((ball) => ball.active).length,
        );
        this.contractRecorded = false;
        this.contractResult = `${this.currentContract().toUpperCase()} READY`;
    }

    private currentContract(): BrickBreakerContract {
        return CONTRACTS[(this.model.level - 1) % CONTRACTS.length] ?? 'blitz';
    }

    private nextContract(): BrickBreakerContract {
        return CONTRACTS[this.model.level % CONTRACTS.length] ?? 'blitz';
    }

    private blitzTarget(): number {
        return Math.max(20, 34 - Math.min(12, this.model.level * 1.5));
    }

    private totalScore(): number {
        return this.model.score + this.contractBonus;
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
        this.bestScore = Math.max(this.bestScore, this.totalScore());
        this.model.reset();
        this.autopilot.reset();
        this.clock.reset();
        this.controller = 'human';
        this.humanIdleElapsed = 0;
        this.humanAxis = 0;
        this.humanTargetNormalized = null;
        this.resultElapsed = 0;
        this.renderAccumulator = RENDER_STEP;
        this.contractBonus = 0;
        this.contractStreak = 0;
        this.completedContracts = 0;
        this.beginLevelTracking();
        this.dirty = true;
    }
}
