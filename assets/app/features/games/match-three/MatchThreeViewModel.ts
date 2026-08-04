import { HybridGameSession } from '../shared/HybridGameSession';
import { MatchThreeAutopilot } from './MatchThreeAutopilot';
import { MatchThreeModel } from './MatchThreeModel';
import type {
    MatchThreeCell,
    MatchThreeDirection,
    MatchThreeObjective,
    MatchThreePhase,
    MatchThreeViewState,
} from './MatchThreeTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.46;
const RESULT_HOLD = 1.4;
const RENDER_INTERVAL = 1 / 20;
const OBJECTIVES: readonly MatchThreeObjective[] = ['score', 'cascade', 'special'];

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
    private level = 1;
    private runScore = 0;
    private objectiveProgress = 0;
    private levelComplete = false;

    update(deltaTime: number): boolean {
        if (this.session.isPaused) {
            return false;
        }
        const dt = this.session.beginFrame(deltaTime);

        if (this.terminalPhase() !== 'playing') {
            return this.updateTerminalState(dt);
        }

        if (this.session.shouldActivateAutopilot(dt)) {
            this.activateAutopilot();
        }

        if (this.session.shouldRunAi(dt)) {
            const swap = this.autopilot.decide(this.model.createObservation());
            if (swap) {
                const specialsBefore = this.specialCount();
                if (this.model.swap(swap.first, swap.second)) {
                    this.focus = { ...swap.second };
                    this.selected = null;
                    this.afterSuccessfulSwap(specialsBefore);
                    this.session.markDirty();
                }
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
            const specialsBefore = this.specialCount();
            const changed = this.model.swap(this.selected, cell);
            if (changed) {
                this.afterSuccessfulSwap(specialsBefore);
            }
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
        const specialsBefore = this.specialCount();
        if (this.model.swap(first, second)) {
            this.afterSuccessfulSwap(specialsBefore);
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
        this.resetRun();
        this.session.markDirty();
    }

    pause(): void {
        this.session.pause();
    }

    resume(): void {
        this.session.resume();
    }

    reset(): void {
        this.resetRun();
        this.session.reset();
    }

    dispose(): void {}

    createViewState(): MatchThreeViewState {
        const observation = this.model.createObservation();
        const controller = this.session.controller;
        const phase = this.session.isPaused ? 'paused' : this.terminalPhase();
        const objective = this.currentObjective();
        const objectiveName = objective === 'score'
            ? 'SCORE'
            : objective === 'cascade'
                ? 'CASCADE'
                : 'SPECIALS';
        const status = phase === 'won'
            ? `LEVEL ${this.level} CLEARED`
            : phase === 'lost'
                ? `RUN ENDED · LEVEL ${this.level}`
                : phase === 'paused'
                    ? 'PAUSED'
                    : controller === 'autopilot'
                        ? `AI · ${objectiveName}`
                        : `HUMAN · ${objectiveName}`;
        const total = this.runScore + observation.score;
        return {
            ...observation,
            phase,
            controller,
            selected: this.selected ? { ...this.selected } : null,
            focus: { ...this.focus },
            combo: this.model.combo,
            bestScore: this.bestScore,
            level: this.level,
            runScore: total,
            objective,
            objectiveProgress: this.displayObjectiveProgress(),
            objectiveTarget: this.objectiveTarget(),
            status,
            stats: `LV ${this.level}`
                + `   RUN ${total}`
                + `   ${objectiveName} ${this.displayObjectiveProgress()}/${this.objectiveTarget()}`
                + `   MOVES ${observation.movesRemaining}`,
            hint: phase === 'won'
                ? controller === 'autopilot'
                    ? 'AI WILL LOAD THE NEXT OBJECTIVE'
                    : 'SELECT A TILE TO CONTINUE · NEW RESTARTS RUN'
                : phase === 'lost'
                    ? controller === 'autopilot'
                        ? 'AI WILL START A NEW RUN'
                        : 'SELECT A TILE OR PRESS NEW'
                    : objective === 'cascade'
                        ? 'BUILD A 3X CASCADE AND REACH 900 SCORE'
                        : objective === 'special'
                            ? 'CREATE 2 SPECIAL TILES AND REACH 900 SCORE'
                            : controller === 'autopilot'
                                ? 'AI ACTIVE — TAP OR SWIPE TO TAKE OVER'
                                : 'REACH 1500 SCORE · TAP / SWIPE / ARROWS + ENTER',
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
            if (this.terminalPhase() === 'won') {
                this.advanceLevel();
            } else {
                this.resetRun();
            }
            this.session.resetTerminalClock();
            this.session.resetAiClock(true);
            this.session.markDirty();
        }
        return this.session.consumeRender();
    }

    private afterSuccessfulSwap(specialsBefore: number): void {
        const observation = this.model.createObservation();
        const objective = this.currentObjective();
        if (objective === 'score') {
            this.objectiveProgress = observation.score;
        } else if (objective === 'cascade') {
            this.objectiveProgress = Math.max(this.objectiveProgress, this.model.combo);
        } else {
            const gained = Math.max(0, this.specialCount() - specialsBefore);
            this.objectiveProgress += gained;
        }

        const currentTotal = this.runScore + observation.score;
        this.bestScore = Math.max(this.bestScore, currentTotal);
        if (this.objectiveSatisfied() || observation.phase === 'won') {
            this.levelComplete = true;
            this.session.resetTerminalClock();
        }
    }

    private objectiveSatisfied(): boolean {
        const score = this.model.score;
        switch (this.currentObjective()) {
            case 'score':
                return score >= 1500;
            case 'cascade':
                return score >= 900 && this.objectiveProgress >= 3;
            case 'special':
                return score >= 900 && this.objectiveProgress >= 2;
        }
    }

    private terminalPhase(): MatchThreePhase {
        if (this.levelComplete) {
            return 'won';
        }
        return this.model.phase;
    }

    private restartTerminalIfNeeded(): void {
        const phase = this.terminalPhase();
        if (phase === 'playing') {
            return;
        }
        if (phase === 'won') {
            this.advanceLevel();
        } else {
            this.resetRun();
        }
        this.session.resetTerminalClock();
        this.session.resetAiClock(false);
        this.session.markDirty();
    }

    private advanceLevel(): void {
        const levelBonus = 250 + this.level * 75;
        this.runScore += this.model.score + levelBonus;
        this.bestScore = Math.max(this.bestScore, this.runScore);
        this.level += 1;
        this.resetLevelBoard();
    }

    private resetRun(): void {
        this.level = 1;
        this.runScore = 0;
        this.resetLevelBoard();
    }

    private resetLevelBoard(): void {
        this.model.reset();
        this.selected = null;
        this.focus = { row: 3, column: 3 };
        this.objectiveProgress = 0;
        this.levelComplete = false;
    }

    private currentObjective(): MatchThreeObjective {
        return OBJECTIVES[(this.level - 1) % OBJECTIVES.length] ?? 'score';
    }

    private displayObjectiveProgress(): number {
        return this.currentObjective() === 'score'
            ? Math.min(this.objectiveTarget(), this.model.score)
            : Math.min(this.objectiveTarget(), this.objectiveProgress);
    }

    private objectiveTarget(): number {
        return this.currentObjective() === 'score'
            ? 1500
            : this.currentObjective() === 'cascade'
                ? 3
                : 2;
    }

    private specialCount(): number {
        return this.model.createObservation().board.flat().reduce(
            (count, tile) => count + (tile.special === 'none' ? 0 : 1),
            0,
        );
    }

    private activateHuman(): void {
        this.session.activateHuman();
    }

    private activateAutopilot(): void {
        this.selected = null;
        this.session.activateAutopilot();
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
