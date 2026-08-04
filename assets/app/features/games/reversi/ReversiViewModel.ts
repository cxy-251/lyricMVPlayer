import { ReversiAutopilot } from './ReversiAutopilot';
import { ReversiModel } from './ReversiModel';
import type {
    ReversiCell,
    ReversiControllerMode,
    ReversiDifficulty,
    ReversiViewState,
} from './ReversiTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.42;
const RESULT_HOLD = 1.6;
const TARGET_WINS = 2;

const OPENINGS: ReadonlyArray<{
    readonly name: string;
    readonly moves: readonly ReversiCell[];
}> = [
    { name: 'STANDARD', moves: [] },
    {
        name: 'NORTHWEST',
        moves: [{ row: 2, column: 3 }, { row: 2, column: 2 }],
    },
    {
        name: 'SOUTHEAST',
        moves: [{ row: 5, column: 4 }, { row: 5, column: 5 }],
    },
    {
        name: 'WEST PRESS',
        moves: [{ row: 3, column: 2 }, { row: 2, column: 2 }],
    },
];

const DIFFICULTIES: readonly ReversiDifficulty[] = [
    'casual',
    'standard',
    'expert',
];

export class ReversiViewModel {
    private readonly model = new ReversiModel();
    private readonly autopilot = new ReversiAutopilot();
    private controller: ReversiControllerMode = 'autopilot';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiElapsed = AI_ACTION_INTERVAL;
    private resultElapsed = 0;
    private focusRow = 2;
    private focusColumn = 3;
    private blackWins = 0;
    private whiteWins = 0;
    private draws = 0;
    private blackMargin = 0;
    private whiteMargin = 0;
    private round = 1;
    private resultRecorded = false;
    private paused = false;
    private dirty = true;

    constructor() {
        this.startRound();
    }

    update(deltaTime: number): boolean {
        if (this.paused) {
            return false;
        }
        const dt = Math.max(0, Math.min(0.1, deltaTime));
        if (this.controller === 'human') {
            this.humanIdleElapsed += dt;
            if (this.humanIdleElapsed >= AI_TAKEOVER_DELAY) {
                this.activateAutopilot();
            }
        }
        if (this.controller === 'autopilot') {
            this.updateAutopilot(dt);
        }
        return this.consumeDirty();
    }

    placeFromHuman(row: number, column: number): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.focusRow = Math.max(0, Math.min(7, row));
        this.focusColumn = Math.max(0, Math.min(7, column));
        if (this.model.phase !== 'playing') {
            this.advanceTerminal(false);
            return;
        }
        this.applyMove(this.focusRow, this.focusColumn);
    }

    moveFocusFromHuman(rowOffset: number, columnOffset: number): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.focusRow = (this.focusRow + rowOffset + 8) % 8;
        this.focusColumn = (this.focusColumn + columnOffset + 8) % 8;
        this.dirty = true;
    }

    placeFocusedFromHuman(): void {
        this.placeFromHuman(this.focusRow, this.focusColumn);
    }

    restartFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.resetMatch(false);
    }

    pause(): void {
        this.paused = true;
        this.dirty = true;
    }

    resume(): void {
        this.paused = false;
        this.dirty = true;
    }

    reset(): void {
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.paused = false;
        this.resetMatch(true);
    }

    dispose(): void {}

    createViewState(): ReversiViewState {
        const observation = this.model.createObservation();
        const phase = this.paused ? 'paused' : observation.phase;
        const turnName = observation.currentPlayer === 1 ? 'BLACK' : 'WHITE';
        const winnerName = this.model.winner === 0
            ? 'DRAW'
            : this.model.winner === 1
                ? 'BLACK WINS'
                : 'WHITE WINS';
        const matchWinner = this.matchWinner();
        const difficulty = this.currentDifficulty();
        const status = phase === 'ended'
            ? matchWinner !== 0
                ? `${matchWinner === 1 ? 'BLACK' : 'WHITE'} TAKES MATCH`
                : `${winnerName} · ROUND ${this.round}`
            : phase === 'paused'
                ? 'PAUSED'
                : `${this.controller === 'autopilot' ? 'AI' : 'HUMAN'} · ${turnName} TURN`;
        return {
            ...observation,
            phase,
            controller: this.controller,
            winner: this.model.winner,
            focusRow: this.focusRow,
            focusColumn: this.focusColumn,
            blackCount: this.model.blackCount,
            whiteCount: this.model.whiteCount,
            round: this.round,
            targetWins: TARGET_WINS,
            blackWins: this.blackWins,
            whiteWins: this.whiteWins,
            draws: this.draws,
            blackMargin: this.blackMargin,
            whiteMargin: this.whiteMargin,
            openingName: this.currentOpening().name,
            difficulty,
            status,
            stats: `R${this.round}  B ${this.model.blackCount} · ${this.blackWins}/${TARGET_WINS}`
                + `  W ${this.model.whiteCount} · ${this.whiteWins}/${TARGET_WINS}`
                + `  D${this.draws}  ${this.currentOpening().name}`
                + `  ${difficulty.toUpperCase()}`,
            hint: phase === 'playing'
                ? this.controller === 'autopilot'
                    ? 'AI ACTIVE — TAP A LEGAL CELL TO TAKE OVER'
                    : 'TAP A DOT OR USE ARROWS AND ENTER'
                : matchWinner !== 0
                    ? `MARGIN B+${this.blackMargin} W+${this.whiteMargin} · TAP FOR NEW MATCH`
                    : 'TAP FOR THE NEXT OPENING · NEW RESETS MATCH',
        };
    }

    private updateAutopilot(dt: number): void {
        if (this.model.phase !== 'playing') {
            this.recordResult();
            this.resultElapsed += dt;
            if (this.resultElapsed >= RESULT_HOLD) {
                this.advanceTerminal(true);
            }
            return;
        }
        this.aiElapsed += dt;
        if (this.aiElapsed < AI_ACTION_INTERVAL) {
            return;
        }
        this.aiElapsed = 0;
        const move = this.autopilot.decide(
            this.model.createObservation(),
            this.currentDifficulty(),
        );
        if (move) {
            this.focusRow = move.row;
            this.focusColumn = move.column;
            this.applyMove(move.row, move.column);
        }
    }

    private applyMove(row: number, column: number): void {
        if (!this.model.play(row, column)) {
            return;
        }
        this.recordResult();
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private recordResult(): void {
        if (this.resultRecorded || this.model.phase !== 'ended') {
            return;
        }
        this.resultRecorded = true;
        const margin = Math.abs(this.model.blackCount - this.model.whiteCount);
        if (this.model.winner === 1) {
            this.blackWins += 1;
            this.blackMargin += margin;
        } else if (this.model.winner === 2) {
            this.whiteWins += 1;
            this.whiteMargin += margin;
        } else {
            this.draws += 1;
        }
    }

    private advanceTerminal(keepAutopilot: boolean): void {
        this.recordResult();
        if (this.matchWinner() !== 0) {
            this.resetMatch(keepAutopilot);
            return;
        }
        this.round += 1;
        this.startRound();
        this.aiElapsed = keepAutopilot ? AI_ACTION_INTERVAL : 0;
    }

    private resetMatch(keepAutopilot: boolean): void {
        this.blackWins = 0;
        this.whiteWins = 0;
        this.draws = 0;
        this.blackMargin = 0;
        this.whiteMargin = 0;
        this.round = 1;
        this.startRound();
        this.aiElapsed = keepAutopilot ? AI_ACTION_INTERVAL : 0;
        this.dirty = true;
    }

    private startRound(): void {
        this.model.reset();
        for (const move of this.currentOpening().moves) {
            if (!this.model.play(move.row, move.column)) {
                this.model.reset();
                break;
            }
        }
        const firstLegal = this.model.legalMoves()[0];
        this.focusRow = firstLegal?.row ?? 2;
        this.focusColumn = firstLegal?.column ?? 3;
        this.resultElapsed = 0;
        this.resultRecorded = false;
        this.dirty = true;
    }

    private currentOpening(): typeof OPENINGS[number] {
        return OPENINGS[(this.round - 1) % OPENINGS.length] ?? OPENINGS[0];
    }

    private currentDifficulty(): ReversiDifficulty {
        return DIFFICULTIES[(this.round - 1) % DIFFICULTIES.length] ?? 'standard';
    }

    private matchWinner(): 0 | 1 | 2 {
        return this.blackWins >= TARGET_WINS
            ? 1
            : this.whiteWins >= TARGET_WINS
                ? 2
                : 0;
    }

    private activateHuman(): void {
        this.controller = 'human';
        this.humanIdleElapsed = 0;
        this.aiElapsed = 0;
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private activateAutopilot(): void {
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private consumeDirty(): boolean {
        const value = this.dirty;
        this.dirty = false;
        return value;
    }
}
