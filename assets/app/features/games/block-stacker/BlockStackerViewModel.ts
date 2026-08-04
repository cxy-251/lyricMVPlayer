import { FixedStepClock } from '../../../animation/FixedStepClock';
import { BlockStackerAutopilot } from './BlockStackerAutopilot';
import { BlockStackerModel } from './BlockStackerModel';
import type {
    BlockStackerControllerMode,
    BlockStackerDropResult,
    BlockStackerViewState,
} from './BlockStackerTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_DROP_ARM_DELAY = 0.12;
const AI_RESULT_HOLD = 1.3;
const RENDER_STEP = 1 / 30;

export class BlockStackerViewModel {
    private readonly clock = new FixedStepClock(1 / 60, 6);
    private readonly model = new BlockStackerModel();
    private readonly autopilot = new BlockStackerAutopilot();
    private controller: BlockStackerControllerMode = 'autopilot';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiDropArmedElapsed = 0;
    private resultElapsed = 0;
    private renderAccumulator = RENDER_STEP;
    private cameraY = 0;
    private bestScore = 0;
    private lastEvent = 'NEW RUN';
    private paused = false;
    private dirty = true;

    update(deltaTime: number): boolean {
        if (this.paused) {
            return false;
        }
        const frameDelta = Math.max(0, Math.min(0.1, deltaTime));
        const steps = this.clock.advance(frameDelta, 1, (step) => {
            this.model.step(step);
            if (this.controller === 'human') {
                this.humanIdleElapsed += step;
                if (this.humanIdleElapsed >= AI_TAKEOVER_DELAY) {
                    this.activateAutopilot();
                }
            }
            if (this.controller === 'autopilot') {
                this.updateAutopilot(step);
            }
        });

        const cameraBlend = 1 - Math.exp(-7.5 * frameDelta);
        this.cameraY += (this.model.cameraTargetY - this.cameraY) * cameraBlend;
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

    dropFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        if (this.model.phase === 'lost') {
            this.resetHumanRun();
            return;
        }
        this.applyDropResult(this.model.drop());
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
        this.aiDropArmedElapsed = 0;
        this.resultElapsed = 0;
        this.renderAccumulator = RENDER_STEP;
        this.cameraY = 0;
        this.lastEvent = 'NEW RUN';
        this.paused = false;
        this.dirty = true;
    }

    dispose(): void {
        this.autopilot.reset();
        this.clock.reset();
    }

    createViewState(): BlockStackerViewState {
        const phase = this.paused ? 'paused' : this.model.phase;
        const moving = this.model.moving;
        const controllerName = this.controller === 'autopilot' ? 'AI' : 'HUMAN';
        const phaseName = phase === 'lost'
            ? 'TOWER LOST'
            : phase === 'paused'
                ? 'PAUSED'
                : 'STACKING';
        const windText = this.model.wind === 0
            ? 'CALM'
            : this.model.wind > 0
                ? `WIND →${Math.abs(this.model.wind)}`
                : `WIND ←${Math.abs(this.model.wind)}`;
        return {
            phase,
            controller: this.controller,
            blocks: this.model.createBlockViewStates().map((block) => ({ ...block })),
            movingBlock: moving ? { ...moving } : null,
            fragments: this.model.createFragmentViewStates().map((fragment) => ({
                x: fragment.x,
                y: fragment.y,
                width: fragment.width,
                height: fragment.height,
                rotation: fragment.rotation,
            })),
            cameraY: this.cameraY,
            worldHalfWidth: this.model.worldHalfWidth,
            blockHeight: this.model.blockHeight,
            wind: this.model.wind,
            shield: this.model.shield,
            eventText: this.lastEvent,
            status: `${controllerName}  ${phaseName}`
                + (this.lastEvent === 'STACKED' ? '' : ` · ${this.lastEvent}`),
            scoreText: `SCORE ${this.model.score}`
                + `  BEST ${this.bestScore}`
                + `  LV ${Math.max(0, this.model.level - 1)}`
                + `  C${this.model.combo}`
                + `  SHIELD ${this.model.shield}`
                + `  ${windText}`,
            hint: phase === 'lost'
                ? 'TAP, CLICK OR PRESS SPACE TO RESTART'
                : this.model.shield > 0
                    ? 'SHIELD READY · ONE COMPLETE MISS WILL BE SAVED'
                    : this.controller === 'autopilot'
                        ? 'AI ACTIVE — TAP THE PLAYFIELD TO TAKE OVER'
                        : 'TAP, CLICK OR PRESS SPACE TO DROP',
        };
    }

    private updateAutopilot(step: number): void {
        if (this.model.phase === 'lost') {
            this.resultElapsed += step;
            if (this.resultElapsed >= AI_RESULT_HOLD) {
                this.model.reset();
                this.autopilot.reset();
                this.aiDropArmedElapsed = 0;
                this.resultElapsed = 0;
                this.cameraY = 0;
                this.lastEvent = 'NEW RUN';
                this.dirty = true;
            }
            return;
        }

        this.resultElapsed = 0;
        this.aiDropArmedElapsed += step;
        if (this.aiDropArmedElapsed < AI_DROP_ARM_DELAY) {
            return;
        }
        if (this.autopilot.shouldDrop(this.model.createObservation())) {
            this.applyDropResult(this.model.drop());
            this.aiDropArmedElapsed = 0;
            this.autopilot.reset();
        }
    }

    private activateHumanControl(): void {
        if (this.controller === 'autopilot') {
            this.autopilot.reset();
        }
        this.controller = 'human';
        this.humanIdleElapsed = 0;
        this.aiDropArmedElapsed = 0;
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private activateAutopilot(): void {
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiDropArmedElapsed = 0;
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
        this.aiDropArmedElapsed = 0;
        this.resultElapsed = 0;
        this.cameraY = 0;
        this.lastEvent = 'NEW RUN';
        this.dirty = true;
    }

    private applyDropResult(result: BlockStackerDropResult): void {
        if (!result.changed) {
            return;
        }
        this.bestScore = Math.max(this.bestScore, this.model.score);
        this.lastEvent = result.rescued
            ? 'SHIELD SAVE'
            : result.lost
                ? 'MISSED'
                : result.perfect
                    ? this.model.shield > 0
                        ? 'PERFECT · SHIELD READY'
                        : `PERFECT · COMBO ${this.model.combo}`
                    : 'STACKED';
        this.resultElapsed = 0;
        this.dirty = true;
    }
}
