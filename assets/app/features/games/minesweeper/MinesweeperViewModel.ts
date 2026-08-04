import { MinesweeperAutopilot } from './MinesweeperAutopilot';
import { MinesweeperModel } from './MinesweeperModel';
import type {
    MinesweeperAction,
    MinesweeperControllerMode,
    MinesweeperViewState,
} from './MinesweeperTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.22;
const AI_RESULT_HOLD = 1.35;
const RENDER_INTERVAL = 1 / 15;

export class MinesweeperViewModel {
    private readonly model = new MinesweeperModel();
    private readonly autopilot = new MinesweeperAutopilot();
    private controller: MinesweeperControllerMode = 'autopilot';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiActionElapsed = AI_ACTION_INTERVAL;
    private resultElapsed = 0;
    private renderElapsed = RENDER_INTERVAL;
    private flagMode = false;
    private focusRow = Math.floor(this.model.rows / 2);
    private focusColumn = Math.floor(this.model.columns / 2);
    private paused = false;
    private dirty = true;

    get rows(): number {
        return this.model.rows;
    }

    get columns(): number {
        return this.model.columns;
    }

    update(deltaTime: number): boolean {
        if (this.paused) {
            return false;
        }
        const dt = Math.max(0, Math.min(0.1, deltaTime));
        this.renderElapsed += dt;
        this.model.step(dt);

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

    primaryCell(row: number, column: number): void {
        if (!this.prepareHumanAction(row, column)) {
            return;
        }
        const changed = this.flagMode
            ? this.model.toggleFlag(row, column)
            : this.model.reveal(row, column);
        this.dirty = this.dirty || changed;
    }

    secondaryCell(row: number, column: number): void {
        if (!this.prepareHumanAction(row, column)) {
            return;
        }
        this.dirty = this.model.toggleFlag(row, column) || this.dirty;
    }

    primaryFocused(): void {
        this.primaryCell(this.focusRow, this.focusColumn);
    }

    secondaryFocused(): void {
        this.secondaryCell(this.focusRow, this.focusColumn);
    }

    moveFocus(rowOffset: number, columnOffset: number): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        this.focusRow = this.wrap(this.focusRow + rowOffset, this.model.rows);
        this.focusColumn = this.wrap(this.focusColumn + columnOffset, this.model.columns);
        this.dirty = true;
    }

    toggleFlagMode(): void {
        if (this.paused) {
            return;
        }
        this.activateHumanControl();
        this.flagMode = !this.flagMode;
        this.dirty = true;
    }

    restartFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.model.reset();
        this.autopilot.reset();
        this.controller = 'human';
        this.humanIdleElapsed = 0;
        this.aiActionElapsed = 0;
        this.resultElapsed = 0;
        this.flagMode = false;
        this.centerFocus();
        this.dirty = true;
    }

    pause(): void {
        this.paused = true;
        this.model.pause();
        this.dirty = true;
    }

    resume(): void {
        this.paused = false;
        this.model.resume();
        this.renderElapsed = RENDER_INTERVAL;
        this.dirty = true;
    }

    reset(): void {
        this.model.reset();
        this.autopilot.reset();
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiActionElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.renderElapsed = RENDER_INTERVAL;
        this.flagMode = false;
        this.paused = false;
        this.centerFocus();
        this.dirty = true;
    }

    dispose(): void {
        this.autopilot.reset();
    }

    createViewState(): MinesweeperViewState {
        const phase = this.paused ? 'paused' : this.model.phase;
        const controllerName = this.controller === 'autopilot' ? 'AI' : 'HUMAN';
        const phaseName = phase === 'ready'
            ? 'READY'
            : phase === 'playing'
                ? 'PLAYING'
                : phase === 'won'
                    ? 'CLEARED'
                    : phase === 'lost'
                        ? 'MINE HIT'
                        : 'PAUSED';
        return {
            rows: this.model.rows,
            columns: this.model.columns,
            cells: this.model.createCellViewStates(),
            phase,
            controller: this.controller,
            flagMode: this.flagMode,
            remainingMines: this.model.remainingMines,
            elapsedSeconds: Math.floor(this.model.elapsedSeconds),
            focusRow: this.focusRow,
            focusColumn: this.focusColumn,
            status: `${controllerName}  ${phaseName}`,
            score: `MINES ${Math.max(0, this.model.remainingMines)}`
                + `  TIME ${Math.floor(this.model.elapsedSeconds)}`,
        };
    }

    private updateAutopilot(dt: number): void {
        if (this.model.phase === 'won' || this.model.phase === 'lost') {
            this.resultElapsed += dt;
            if (this.resultElapsed >= AI_RESULT_HOLD) {
                this.model.reset();
                this.autopilot.reset();
                this.resultElapsed = 0;
                this.aiActionElapsed = AI_ACTION_INTERVAL;
                this.centerFocus();
                this.dirty = true;
            }
            return;
        }

        this.resultElapsed = 0;
        this.aiActionElapsed += dt;
        if (this.aiActionElapsed < AI_ACTION_INTERVAL) {
            return;
        }
        this.aiActionElapsed %= AI_ACTION_INTERVAL;
        const action = this.autopilot.decide(this.model.createObservation());
        if (action) {
            this.executeAutopilotAction(action);
        }
    }

    private executeAutopilotAction(action: MinesweeperAction): void {
        if (action.kind === 'restart') {
            this.model.reset();
            this.autopilot.reset();
            this.centerFocus();
            this.dirty = true;
            return;
        }
        if (action.row === undefined || action.column === undefined) {
            return;
        }
        this.focusRow = action.row;
        this.focusColumn = action.column;
        const changed = action.kind === 'flag'
            ? this.model.toggleFlag(action.row, action.column)
            : action.kind === 'chord'
                ? this.model.chord(action.row, action.column)
                : this.model.reveal(action.row, action.column);
        this.dirty = this.dirty || changed;
    }

    private prepareHumanAction(row: number, column: number): boolean {
        if (
            this.paused
            || row < 0
            || row >= this.model.rows
            || column < 0
            || column >= this.model.columns
        ) {
            return false;
        }
        this.activateHumanControl();
        this.focusRow = row;
        this.focusColumn = column;
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
    }

    private activateAutopilot(): void {
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiActionElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.autopilot.reset();
        this.dirty = true;
    }

    private centerFocus(): void {
        this.focusRow = Math.floor(this.model.rows / 2);
        this.focusColumn = Math.floor(this.model.columns / 2);
    }

    private wrap(value: number, size: number): number {
        return ((value % size) + size) % size;
    }
}
