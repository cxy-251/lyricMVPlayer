import { FixedStepClock } from '../../../animation/FixedStepClock';
import { tetrisPieceCells } from './TetrisPieces';
import { TetrisAutopilot } from './TetrisAutopilot';
import { TetrisModel } from './TetrisModel';
import type {
    TetrisAction,
    TetrisControllerMode,
    TetrisDrawCell,
    TetrisViewState,
} from './TetrisTypes';
import { TETRIS_VISIBLE_HEIGHT } from './TetrisTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.065;
const AI_RESULT_HOLD = 1.4;
const HORIZONTAL_DAS = 0.16;
const HORIZONTAL_ARR = 0.052;
const RENDER_INTERVAL = 1 / 30;

export class TetrisViewModel {
    private readonly clock = new FixedStepClock(1 / 60, 8);
    private readonly model = new TetrisModel();
    private readonly autopilot = new TetrisAutopilot();
    private controller: TetrisControllerMode = 'autopilot';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiActionElapsed = AI_ACTION_INTERVAL;
    private resultElapsed = 0;
    private renderElapsed = RENDER_INTERVAL;
    private horizontal: -1 | 0 | 1 = 0;
    private horizontalHeldElapsed = 0;
    private horizontalRepeatElapsed = 0;
    private softDropHeld = false;
    private paused = false;
    private dirty = true;

    update(deltaTime: number): boolean {
        if (this.paused) {
            return false;
        }
        const frameDelta = Math.max(0, Math.min(0.1, deltaTime));
        const steps = this.clock.advance(frameDelta, 1, (step) => {
            if (this.controller === 'human') {
                this.updateHumanControl(step);
                this.humanIdleElapsed += step;
                if (this.horizontal !== 0 || this.softDropHeld) {
                    this.humanIdleElapsed = 0;
                }
                if (this.humanIdleElapsed >= AI_TAKEOVER_DELAY) {
                    this.activateAutopilot();
                }
            } else {
                this.model.setSoftDrop(false);
                this.updateAutopilot(step);
            }
            this.model.step(step);
        });

        this.renderElapsed += frameDelta;
        if (steps > 0) {
            this.dirty = true;
        }
        if (!this.dirty && this.renderElapsed < RENDER_INTERVAL) {
            return false;
        }
        this.renderElapsed %= RENDER_INTERVAL;
        this.dirty = false;
        return true;
    }

    moveOnceFromHuman(direction: -1 | 1): void {
        if (!this.prepareHumanAction()) {
            return;
        }
        this.dirty = this.model.moveHorizontal(direction) || this.dirty;
    }

    setHorizontalFromHuman(direction: -1 | 0 | 1): void {
        if (this.paused) {
            return;
        }
        if (direction !== 0) {
            this.activateHumanControl();
            this.model.moveHorizontal(direction);
        }
        this.horizontal = direction;
        this.horizontalHeldElapsed = 0;
        this.horizontalRepeatElapsed = 0;
        this.dirty = true;
    }

    setSoftDropFromHuman(active: boolean): void {
        if (this.paused) {
            return;
        }
        if (active) {
            this.activateHumanControl();
        }
        this.softDropHeld = active;
        this.model.setSoftDrop(active && this.controller === 'human');
        this.dirty = true;
    }

    softDropOnceFromHuman(): void {
        if (!this.prepareHumanAction()) {
            return;
        }
        this.dirty = this.model.softDropStep() || this.dirty;
    }

    rotateClockwiseFromHuman(): void {
        if (!this.prepareHumanAction()) {
            return;
        }
        this.dirty = this.model.rotate(1) || this.dirty;
    }

    rotateCounterClockwiseFromHuman(): void {
        if (!this.prepareHumanAction()) {
            return;
        }
        this.dirty = this.model.rotate(-1) || this.dirty;
    }

    hardDropFromHuman(): void {
        if (!this.prepareHumanAction()) {
            return;
        }
        this.dirty = this.model.hardDrop() || this.dirty;
    }

    holdFromHuman(): void {
        if (!this.prepareHumanAction()) {
            return;
        }
        this.dirty = this.model.holdCurrent() || this.dirty;
    }

    restartFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.model.reset();
        this.autopilot.reset();
        this.clock.reset();
        this.controller = 'human';
        this.humanIdleElapsed = 0;
        this.aiActionElapsed = 0;
        this.resultElapsed = 0;
        this.horizontal = 0;
        this.softDropHeld = false;
        this.model.setSoftDrop(false);
        this.dirty = true;
    }

    pause(): void {
        this.paused = true;
        this.model.setSoftDrop(false);
        this.dirty = true;
    }

    resume(): void {
        this.paused = false;
        this.renderElapsed = RENDER_INTERVAL;
        this.dirty = true;
    }

    reset(): void {
        this.model.reset();
        this.autopilot.reset();
        this.clock.reset();
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiActionElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.renderElapsed = RENDER_INTERVAL;
        this.horizontal = 0;
        this.softDropHeld = false;
        this.paused = false;
        this.dirty = true;
    }

    dispose(): void {
        this.autopilot.reset();
        this.clock.reset();
    }

    createViewState(): TetrisViewState {
        const phase = this.paused ? 'paused' : this.model.phase;
        const active = this.model.active;
        const activeCells: TetrisDrawCell[] = [];
        const ghostCells: TetrisDrawCell[] = [];
        if (active) {
            const ghostY = this.model.ghostY();
            for (const cell of tetrisPieceCells(active.type, active.rotation)) {
                const activeY = active.y + cell.y;
                const ghostCellY = ghostY + cell.y;
                if (activeY >= 0 && activeY < TETRIS_VISIBLE_HEIGHT) {
                    activeCells.push({
                        x: active.x + cell.x,
                        y: activeY,
                        type: active.type,
                    });
                }
                if (ghostCellY >= 0 && ghostCellY < TETRIS_VISIBLE_HEIGHT) {
                    ghostCells.push({
                        x: active.x + cell.x,
                        y: ghostCellY,
                        type: active.type,
                    });
                }
            }
        }

        const controllerName = this.controller === 'autopilot' ? 'AI' : 'HUMAN';
        const phaseName = phase === 'lost'
            ? 'GAME OVER'
            : phase === 'paused'
                ? 'PAUSED'
                : 'PLAYING';
        return {
            phase,
            controller: this.controller,
            board: this.model.createVisibleBoard(),
            activeCells,
            ghostCells,
            next: [...this.model.next.slice(0, 3)],
            hold: this.model.hold,
            score: this.model.score,
            lines: this.model.lines,
            level: this.model.level,
            status: `${controllerName}  ${phaseName}`,
            scoreText: `SCORE ${this.model.score}`
                + `  LINES ${this.model.lines}`
                + `  LEVEL ${this.model.level}`,
            hint: phase === 'lost'
                ? 'TAP DROP OR PRESS R TO RESTART'
                : this.controller === 'autopilot'
                    ? 'AI ACTIVE — USE ANY CONTROL TO TAKE OVER'
                    : 'ARROWS / A-D  Z-X ROTATE  SPACE DROP  C HOLD',
        };
    }

    private updateHumanControl(step: number): void {
        this.model.setSoftDrop(this.softDropHeld);
        if (this.horizontal === 0) {
            return;
        }
        this.horizontalHeldElapsed += step;
        if (this.horizontalHeldElapsed < HORIZONTAL_DAS) {
            return;
        }
        this.horizontalRepeatElapsed += step;
        while (this.horizontalRepeatElapsed >= HORIZONTAL_ARR) {
            this.horizontalRepeatElapsed -= HORIZONTAL_ARR;
            this.model.moveHorizontal(this.horizontal);
        }
    }

    private updateAutopilot(step: number): void {
        if (this.model.phase === 'lost') {
            this.resultElapsed += step;
            if (this.resultElapsed >= AI_RESULT_HOLD) {
                this.model.reset();
                this.autopilot.reset();
                this.resultElapsed = 0;
                this.aiActionElapsed = AI_ACTION_INTERVAL;
                this.dirty = true;
            }
            return;
        }

        this.resultElapsed = 0;
        this.aiActionElapsed += step;
        if (this.aiActionElapsed < AI_ACTION_INTERVAL) {
            return;
        }
        this.aiActionElapsed %= AI_ACTION_INTERVAL;
        const action = this.autopilot.decide(this.model.createObservation());
        if (action) {
            this.executeAction(action);
        }
    }

    private executeAction(action: TetrisAction): void {
        switch (action.kind) {
            case 'left':
                this.model.moveHorizontal(-1);
                break;
            case 'right':
                this.model.moveHorizontal(1);
                break;
            case 'soft-drop':
                this.model.softDropStep();
                break;
            case 'rotate-cw':
                this.model.rotate(1);
                break;
            case 'rotate-ccw':
                this.model.rotate(-1);
                break;
            case 'hard-drop':
                this.model.hardDrop();
                break;
            case 'hold':
                this.model.holdCurrent();
                break;
            case 'restart':
                this.model.reset();
                this.autopilot.reset();
                break;
            default:
                break;
        }
        this.dirty = true;
    }

    private prepareHumanAction(): boolean {
        if (this.paused) {
            return false;
        }
        this.activateHumanControl();
        if (this.model.phase === 'lost') {
            this.model.reset();
            this.autopilot.reset();
            this.clock.reset();
        }
        return true;
    }

    private activateHumanControl(): void {
        if (this.controller === 'autopilot') {
            this.autopilot.reset();
        }
        this.controller = 'human';
        this.humanIdleElapsed = 0;
        this.aiActionElapsed = 0;
        this.resultElapsed = 0;
        this.model.setSoftDrop(this.softDropHeld);
        this.dirty = true;
    }

    private activateAutopilot(): void {
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiActionElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.horizontal = 0;
        this.softDropHeld = false;
        this.model.setSoftDrop(false);
        this.autopilot.reset();
        this.dirty = true;
    }
}
