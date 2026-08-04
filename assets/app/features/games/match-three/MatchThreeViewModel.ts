import { HybridGameSession } from '../shared/HybridGameSession';
import { MatchThreeAutopilot } from './MatchThreeAutopilot';
import { MatchThreeModel } from './MatchThreeModel';
import type {
    MatchThreeCell,
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
    private readonly session = new HybridGameSession({
        aiTakeoverDelay: AI_TAKEOVER_DELAY,
        aiActionInterval: AI_ACTION_INTERVAL,
        resultHold: RESULT_HOLD,
        renderInterval: RENDER_INTERVAL,
    });
    private selected: MatchThreeCell | null = null;
    private focus: MatchThreeCell = { row: 3, column: 3 };
    private bestScore = 0;

    update(deltaTime: number): boolean {
        if (this.session.isPaused) {
            return false;
        }
        const dt = this.session.beginFrame(deltaTime);

        if (this.model.phase !== 'playing') {
            return this.updateTerminalState(dt);
        }

        if (this.session.shouldActivateAutopilot(dt)) {
            this.activateAutopilot();
        }

        if (this.session.shouldRunAi(dt)) {
            const swap = this.autopilot.decide(this.model.createObservation());
            if (swap && this.model.swap(swap.first, swap.second)) {
                this.focus = { ...swap.second };
                this.selected = null;
                this.bestScore = Math.max(this.bestScore, this.model.score);
                this.session.markDirty();
            }
        }
        return this.session.consumeRender();
    }

    selectCellFromHuman(row: number, column: number): void {
        if (this.session.isPaused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();

        const cell = this.clampCell({ row, column });
        this.focus = cell;
        if (!this.selected) {
            this.selected = cell;
            this.session.markDirty();
            return;
        }
        if (this.sameCell(this.selected, cell)) {
            this.selected = null;
            this.session.markDirty();
            return;
        }
        if (this.manhattan(this.selected, cell) === 1) {
            const changed = this.model.swap(this.selected, cell);
            this.bestScore = Math.max(this.bestScore, this.model.score);
            this.selected = changed ? null : cell;
            this.session.markDirty();
            return;
        }
        this.selected = cell;
        this.session.markDirty();
    }

    swapCellFromHuman(
        row: number,
        column: number,
        direction: MatchThreeDirection,
    ): void {
        if (this.session.isPaused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();

        const first = this.clampCell({ row, column });
        const second = this.offset(first, direction);
        if (!this.inside(second)) {
            this.focus = first;
            this.selected = first;
            this.session.markDirty();
            return;
        }
        this.focus = second;
        this.selected = null;
        if (this.model.swap(first, second)) {
            this.bestScore = Math.max(this.bestScore, this.model.score);
        }
        this.session.markDirty();
    }

    moveFocusFromHuman(rowDelta: number, columnDelta: number): void {
        if (this.session.isPaused) {
            return;
        }
        this.activateHuman();
        this.focus = this.clampCell({
            row: this.focus.row + rowDelta,
            column: this.focus.column + columnDelta,
        });
        this.session.markDirty();
    }

    activateFocusedFromHuman(): void {
        this.selectCellFromHuman(this.focus.row, this.focus.column);
    }

    restartFromHuman(): void {
        if (this.session.isPaused) {
            return;
        }
        this.activateHuman();
        this.resetBoard();
        this.session.markDirty();
    }

    pause(): void {
        this.session.pause();
    }

    resume(): void {
        this.session.resume();
    }

    reset(): void {
        this.resetBoard();
        this.session.reset();
    }

    dispose(): void {}

    createViewState(): MatchThreeViewState {
        const observation = this.model.createObservation();
        const controller = this.session.controller;
        const phase = this.session.isPaused ? 'paused' : observation.phase;
        const status = phase === 'won'
            ? 'TARGET REACHED'
            : phase === 'lost'
                ? 'OUT OF MOVES'
                : phase === 'paused'
                    ? 'PAUSED'
                    : controller === 'autopilot'
                        ? 'AI MATCHING'
                        : 'HUMAN';
        return {
            ...observation,
            phase,
            controller,
            selected: this.selected ? { ...this.selected } : null,
            focus: { ...this.focus },
            combo: this.model.combo,
            bestScore: this.bestScore,
            status,
            stats: `SCORE ${observation.score}/${observation.targetScore}`
                + `   MOVES ${observation.movesRemaining}`
                + `   COMBO ${Math.max(1, this.model.combo)}`,
            hint: phase === 'won' || phase === 'lost'
                ? controller === 'autopilot'
                    ? 'AI WILL START A NEW BOARD'
                    : 'SELECT A TILE OR PRESS NEW'
                : controller === 'autopilot'
                    ? 'AI ACTIVE — TAP OR SWIPE TO TAKE OVER'
                    : 'TAP ADJACENT TILES / SWIPE / ARROWS + ENTER',
        };
    }

    private updateTerminalState(dt: number): boolean {
        if (this.session.controller === 'human') {
            if (this.session.shouldActivateAutopilot(dt)) {
                this.activateAutopilot();
            }
            return this.session.consumeRender();
        }

        if (this.session.shouldRestartTerminal(dt)) {
            this.resetBoard();
            this.session.resetTerminalClock();
            this.session.resetAiClock(true);
            this.session.markDirty();
        }
        return this.session.consumeRender();
    }

    private restartTerminalIfNeeded(): void {
        if (this.model.phase === 'playing') {
            return;
        }
        this.resetBoard();
        this.session.resetTerminalClock();
    }

    private activateHuman(): void {
        this.session.activateHuman();
    }

    private activateAutopilot(): void {
        this.selected = null;
        this.session.activateAutopilot();
    }

    private resetBoard(): void {
        this.model.reset();
        this.selected = null;
        this.focus = { row: 3, column: 3 };
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
