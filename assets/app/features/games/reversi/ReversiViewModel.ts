import { ReversiAutopilot } from './ReversiAutopilot';
import { ReversiModel } from './ReversiModel';
import type {
    ReversiControllerMode,
    ReversiViewState,
} from './ReversiTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.42;
const RESULT_HOLD = 1.6;

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
    private resultRecorded = false;
    private paused = false;
    private dirty = true;

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
            this.restartRound(false);
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
        this.restartRound(false);
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
        this.model.reset();
        this.controller = 'autopilot';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.focusRow = 2;
        this.focusColumn = 3;
        this.blackWins = 0;
        this.whiteWins = 0;
        this.resultRecorded = false;
        this.paused = false;
        this.dirty = true;
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
        return {
            ...observation,
            phase,
            controller: this.controller,
            winner: this.model.winner,
            focusRow: this.focusRow,
            focusColumn: this.focusColumn,
            blackCount: this.model.blackCount,
            whiteCount: this.model.whiteCount,
            status: phase === 'ended'
                ? winnerName
                : phase === 'paused'
                    ? 'PAUSED'
                    : `${this.controller === 'autopilot' ? 'AI' : 'HUMAN'} · ${turnName} TURN`,
            stats: `BLACK ${this.model.blackCount}   WHITE ${this.model.whiteCount}`
                + `   MATCH ${this.blackWins}-${this.whiteWins}`,
            hint: phase === 'playing'
                ? this.controller === 'autopilot'
                    ? 'AI ACTIVE — TAP A LEGAL CELL TO TAKE OVER'
                    : 'TAP A DOT OR USE ARROWS AND ENTER'
                : 'TAP OR PRESS R FOR A NEW ROUND',
        };
    }

    private updateAutopilot(dt: number): void {
        if (this.model.phase !== 'playing') {
            this.recordResult();
            this.resultElapsed += dt;
            if (this.resultElapsed >= RESULT_HOLD) {
                this.restartRound(true);
            }
            return;
        }
        this.aiElapsed += dt;
        if (this.aiElapsed < AI_ACTION_INTERVAL) {
            return;
        }
        this.aiElapsed = 0;
        const move = this.autopilot.decide(this.model.createObservation());
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
        if (this.model.winner === 1) {
            this.blackWins += 1;
        } else if (this.model.winner === 2) {
            this.whiteWins += 1;
        }
    }

    private restartRound(keepAutopilot: boolean): void {
        this.model.reset();
        this.resultElapsed = 0;
        this.aiElapsed = keepAutopilot ? AI_ACTION_INTERVAL : 0;
        this.focusRow = 2;
        this.focusColumn = 3;
        this.resultRecorded = false;
        this.dirty = true;
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
