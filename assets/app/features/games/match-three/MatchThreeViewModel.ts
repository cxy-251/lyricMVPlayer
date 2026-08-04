import { MatchThreeAutopilot } from './MatchThreeAutopilot';
import { MatchThreeModel } from './MatchThreeModel';
import type {
    MatchThreeCell,
    MatchThreeControllerMode,
    MatchThreeDirection,
    MatchThreeViewState,
} from './MatchThreeTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.46;
const RESULT_HOLD = 1.4;
const RENDER_INTERVAL = 1 / 20;

export class MatchThreeViewModel {
    private readonly model = new MatchThreeModel();
    private readonly autopilot = new MatchThreeAutopilot();
    private controller: MatchThreeControllerMode = 'autopilot';
    private selected: MatchThreeCell | null = null;
    private focus: MatchThreeCell = { row: 3, column: 3 };
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
            this.aiActionElapsed += dt;
            if (this.aiActionElapsed >= AI_ACTION_INTERVAL) {
                this.aiActionElapsed %= AI_ACTION_INTERVAL;
                const swap = this.autopilot.decide(this.model.createObservation());
                if (swap && this.model.swap(swap.first, swap.second)) {
                    this.focus = { ...swap.second };
                    this.selected = null;
                    this.bestScore = Math.max(this.bestScore, this.model.score);
                    this.dirty = true;
                }
            }
        }
        return this.consumeRender();
    }

    selectCellFromHuman(row: number, column: number): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();

        const cell = this.clampCell({ row, column });
        this.focus = cell;
        if (!this.selected) {
            this.selected = cell;
            this.dirty = true;
            return;
        }
        if (this.sameCell(this.selected, cell)) {
            this.selected = null;
            this.dirty = true;
            return;
        }
        if (this.manhattan(this.selected, cell) === 1) {
            const changed = this.model.swap(this.selected, cell);
            this.bestScore = Math.max(this.bestScore, this.model.score);
            this.selected = changed ? null : cell;
            this.dirty = true;
            return;
        }
        this.selected = cell;
        this.dirty = true;
    }

    swapCellFromHuman(
        row: number,
        column: number,
        direction: MatchThreeDirection,
    ): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();

        const first = this.clampCell({ row, column });
        const second = this.offset(first, direction);
        if (!this.inside(second)) {
            this.focus = first;
            this.selected = first;
            this.dirty = true;
            return;
        }
        this.focus = second;
        this.selected = null;
        if (this.model.swap(first, second)) {
            this.bestScore = Math.max(this.bestScore, this.model.score);
        }
        this.dirty = true;
    }

    moveFocusFromHuman(rowDelta: number, columnDelta: number): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.focus = this.clampCell({
            row: this.focus.row + rowDelta,
            column: this.focus.column + columnDelta,
        });
        this.dirty = true;
    }

    activateFocusedFromHuman(): void {
        this.selectCellFromHuman(this.focus.row, this.focus.column);
    }

    restartFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.model.reset();
        this.selected = null;
        this.focus = { row: 3, column: 3 };
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
        this.selected = null;
        this.focus = { row: 3, column: 3 };
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiActionElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.renderElapsed = RENDER_INTERVAL;
        this.paused = false;
        this.dirty = true;
    }

    dispose(): void {}

    createViewState(): MatchThreeViewState {
        const observation = this.model.createObservation();
        const phase = this.paused ? 'paused' : observation.phase;
        const status = phase === 'won'
            ? 'TARGET REACHED'
            : phase === 'lost'
                ? 'OUT OF MOVES'
                : phase === 'paused'
                    ? 'PAUSED'
                    : this.controller === 'autopilot'
                        ? 'AI MATCHING'
                        : 'HUMAN';
        return {
            ...observation,
            phase,
            controller: this.controller,
            selected: this.selected ? { ...this.selected } : null,
            focus: { ...this.focus },
            combo: this.model.combo,
            bestScore: this.bestScore,
            status,
            stats: `SCORE ${observation.score}/${observation.targetScore}`
                + `   MOVES ${observation.movesRemaining}`
                + `   COMBO ${Math.max(1, this.model.combo)}`,
            hint: phase === 'won' || phase === 'lost'
                ? this.controller === 'autopilot'
                    ? 'AI WILL START A NEW BOARD'
                    : 'SELECT A TILE OR PRESS NEW'
                : this.controller === 'autopilot'
                    ? 'AI ACTIVE — TAP OR SWIPE TO TAKE OVER'
                    : 'TAP ADJACENT TILES / SWIPE / ARROWS + ENTER',
        };
    }

    private updateTerminalState(dt: number): boolean {
        if (this.controller === 'human') {
            this.humanIdleElapsed += dt;
            if (this.humanIdleElapsed >= AI_TAKEOVER_DELAY) {
                this.activateAutopilot();
            }
            return this.consumeRender();
        }

        this.resultElapsed += dt;
        if (this.resultElapsed >= RESULT_HOLD) {
            this.model.reset();
            this.selected = null;
            this.focus = { row: 3, column: 3 };
            this.resultElapsed = 0;
            this.aiActionElapsed = AI_ACTION_INTERVAL;
            this.dirty = true;
        }
        return this.consumeRender();
    }

    private restartTerminalIfNeeded(): void {
        if (this.model.phase === 'playing') {
            return;
        }
        this.model.reset();
        this.selected = null;
        this.focus = { row: 3, column: 3 };
        this.resultElapsed = 0;
    }

    private activateHuman(): void {
        this.controller = 'human';
        this.humanIdleElapsed = 0;
        this.aiActionElapsed = 0;
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private activateAutopilot(): void {
        this.controller = 'autopilot';
        this.selected = null;
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiActionElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private consumeRender(): boolean {
        if (!this.dirty && this.renderElapsed < RENDER_INTERVAL) {
            return false;
        }
        this.renderElapsed %= RENDER_INTERVAL;
        this.dirty = false;
        return true;
    }

    private clampCell(cell: MatchThreeCell): MatchThreeCell {
        return {
            row: Math.max(0, Math.min(7, Math.floor(cell.row))),
            column: Math.max(0, Math.min(7, Math.floor(cell.column))),
        };
    }

    private inside(cell: MatchThreeCell): boolean {
        return cell.row >= 0
            && cell.row < 8
            && cell.column >= 0
            && cell.column < 8;
    }

    private offset(
        cell: MatchThreeCell,
        direction: MatchThreeDirection,
    ): MatchThreeCell {
        switch (direction) {
            case 'up':
                return { row: cell.row + 1, column: cell.column };
            case 'down':
                return { row: cell.row - 1, column: cell.column };
            case 'left':
                return { row: cell.row, column: cell.column - 1 };
            case 'right':
                return { row: cell.row, column: cell.column + 1 };
        }
    }

    private manhattan(first: MatchThreeCell, second: MatchThreeCell): number {
        return Math.abs(first.row - second.row)
            + Math.abs(first.column - second.column);
    }

    private sameCell(first: MatchThreeCell, second: MatchThreeCell): boolean {
        return first.row === second.row && first.column === second.column;
    }
}
