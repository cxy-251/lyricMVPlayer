import { MinesweeperAutopilot } from './MinesweeperAutopilot';
import { MinesweeperModel } from './MinesweeperModel';
import type {
    MinesweeperAction,
    MinesweeperChallenge,
    MinesweeperControllerMode,
    MinesweeperPhase,
    MinesweeperViewState,
} from './MinesweeperTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.22;
const AI_RESULT_HOLD = 1.35;
const RENDER_INTERVAL = 1 / 15;
const CHALLENGES: readonly MinesweeperChallenge[] = ['classic', 'sweep', 'low-flag'];

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
    private challengeIndex = 0;
    private points = 0;
    private bestPoints = 0;
    private winStreak = 0;
    private safeStreak = 0;
    private largestSweep = 0;
    private maximumFlagsUsed = 0;
    private terminalScored = false;

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
        this.scoreTerminalIfNeeded();

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
        this.applyScoredAction(() => (
            this.flagMode
                ? this.model.toggleFlag(row, column)
                : this.model.reveal(row, column)
        ));
    }

    secondaryCell(row: number, column: number): void {
        if (!this.prepareHumanAction(row, column)) {
            return;
        }
        this.applyScoredAction(() => this.model.toggleFlag(row, column));
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
        this.activateHumanControl();
        this.startNewBoard(true);
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
        this.challengeIndex = 0;
        this.points = 0;
        this.winStreak = 0;
        this.controller = 'autopilot';
        this.startNewBoard(false);
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiActionElapsed = AI_ACTION_INTERVAL;
        this.renderElapsed = RENDER_INTERVAL;
        this.paused = false;
    }

    dispose(): void {
        this.autopilot.reset();
    }

    createViewState(): MinesweeperViewState {
        const phase = this.paused ? 'paused' : this.model.phase;
        const controllerName = this.controller === 'autopilot' ? 'AI' : 'HUMAN';
        const challenge = this.currentChallenge();
        const challengeName = challenge === 'classic'
            ? 'CLASSIC'
            : challenge === 'sweep'
                ? 'SWEEP BONUS'
                : 'LOW FLAG';
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
            challenge,
            points: this.points,
            bestPoints: this.bestPoints,
            winStreak: this.winStreak,
            safeStreak: this.safeStreak,
            status: `${controllerName}  ${phaseName} · ${challengeName}`,
            score: `PTS ${this.points}`
                + `  BEST ${this.bestPoints}`
                + `  STREAK ${this.winStreak}`
                + `  MINES ${Math.max(0, this.model.remainingMines)}`
                + `  TIME ${Math.floor(this.model.elapsedSeconds)}`,
        };
    }

    private updateAutopilot(dt: number): void {
        if (this.model.phase === 'won' || this.model.phase === 'lost') {
            this.resultElapsed += dt;
            if (this.resultElapsed >= AI_RESULT_HOLD) {
                this.startNewBoard(true);
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
            this.startNewBoard(true);
            return;
        }
        const row = action.row;
        const column = action.column;
        if (row === undefined || column === undefined) {
            return;
        }
        this.focusRow = row;
        this.focusColumn = column;
        this.applyScoredAction(() => (
            action.kind === 'flag'
                ? this.model.toggleFlag(row, column)
                : action.kind === 'chord'
                    ? this.model.chord(row, column)
                    : this.model.reveal(row, column)
        ));
    }

    private applyScoredAction(action: () => boolean): void {
        const revealedBefore = this.revealedCount();
        const flagsBefore = this.flagsUsed();
        const phaseBefore = this.model.phase;
        const changed = action();
        if (!changed) {
            return;
        }

        const phaseAfter = this.model.phase;
        const revealedGain = Math.max(0, this.revealedCount() - revealedBefore);
        const flagsAfter = phaseAfter === 'won' ? flagsBefore : this.flagsUsed();
        this.maximumFlagsUsed = Math.max(this.maximumFlagsUsed, flagsAfter);
        if (revealedGain > 0 && phaseAfter !== 'lost') {
            this.safeStreak += 1;
            this.largestSweep = Math.max(this.largestSweep, revealedGain);
            const sweepMultiplier = this.currentChallenge() === 'sweep'
                ? 1 + Math.min(2, revealedGain / 8)
                : 1;
            this.points += Math.round(
                (revealedGain * 6 + Math.min(12, this.safeStreak) * 2) * sweepMultiplier,
            );
        } else if (flagsAfter > flagsBefore) {
            this.points += this.currentChallenge() === 'low-flag' ? 1 : 3;
        }
        if (phaseBefore !== 'lost' && phaseAfter === 'lost') {
            this.safeStreak = 0;
        }
        this.scoreTerminalIfNeeded();
        this.bestPoints = Math.max(this.bestPoints, this.points);
        this.dirty = true;
    }

    private scoreTerminalIfNeeded(): void {
        const phase: MinesweeperPhase = this.model.phase;
        if ((phase !== 'won' && phase !== 'lost') || this.terminalScored) {
            return;
        }
        this.terminalScored = true;
        if (phase === 'won') {
            this.winStreak += 1;
            const time = Math.floor(this.model.elapsedSeconds);
            const challengeBonus = this.currentChallenge() === 'classic'
                ? Math.max(80, 520 - time * 6)
                : this.currentChallenge() === 'sweep'
                    ? 120 + this.largestSweep * 24
                    : 160 + Math.max(0, 8 - this.maximumFlagsUsed) * 70;
            this.points += challengeBonus + this.winStreak * 50;
        } else {
            this.winStreak = 0;
            this.safeStreak = 0;
        }
        this.bestPoints = Math.max(this.bestPoints, this.points);
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private startNewBoard(rotateChallenge: boolean): void {
        if (rotateChallenge) {
            this.challengeIndex = (this.challengeIndex + 1) % CHALLENGES.length;
        }
        this.model.reset();
        this.autopilot.reset();
        this.humanIdleElapsed = this.controller === 'autopilot'
            ? AI_TAKEOVER_DELAY
            : 0;
        this.aiActionElapsed = this.controller === 'autopilot'
            ? AI_ACTION_INTERVAL
            : 0;
        this.resultElapsed = 0;
        this.flagMode = false;
        this.safeStreak = 0;
        this.largestSweep = 0;
        this.maximumFlagsUsed = 0;
        this.terminalScored = false;
        this.centerFocus();
        this.dirty = true;
    }

    private currentChallenge(): MinesweeperChallenge {
        return CHALLENGES[this.challengeIndex] ?? 'classic';
    }

    private revealedCount(): number {
        return this.model.createObservation().cells.reduce(
            (count, cell) => count + (cell.state === 'revealed' ? 1 : 0),
            0,
        );
    }

    private flagsUsed(): number {
        return this.model.mineCount - this.model.remainingMines;
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
