import { ConnectFourAutopilot } from './ConnectFourAutopilot';
import { ConnectFourModel } from './ConnectFourModel';
import type {
    ConnectFourControllerMode,
    ConnectFourViewState,
} from './ConnectFourTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.34;
const RESULT_HOLD = 1.5;

export class ConnectFourViewModel {
    private readonly model = new ConnectFourModel();
    private readonly autopilot = new ConnectFourAutopilot();
    private controller: ConnectFourControllerMode = 'autopilot';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiElapsed = AI_ACTION_INTERVAL;
    private resultElapsed = 0;
    private focusColumn = 3;
    private redWins = 0;
    private yellowWins = 0;
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

    dropFromHuman(column: number): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.focusColumn = Math.max(0, Math.min(6, column));
        if (this.model.phase !== 'playing') {
            this.restartRound(false);
            return;
        }
        this.applyMove(this.focusColumn);
    }

    moveFocusFromHuman(offset: number): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.focusColumn = (this.focusColumn + offset + 7) % 7;
        this.dirty = true;
    }

    dropFocusedFromHuman(): void {
        this.dropFromHuman(this.focusColumn);
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
        this.focusColumn = 3;
        this.redWins = 0;
        this.yellowWins = 0;
        this.resultRecorded = false;
        this.paused = false;
        this.dirty = true;
    }

    dispose(): void {}

    createViewState(): ConnectFourViewState {
        const observation = this.model.createObservation();
        const phase = this.paused ? 'paused' : observation.phase;
        const playerName = observation.currentPlayer === 1 ? 'RED' : 'YELLOW';
        const status = phase === 'won'
            ? `${this.model.winner === 1 ? 'RED' : 'YELLOW'} WINS`
            : phase === 'draw'
                ? 'DRAW'
                : phase === 'paused'
                    ? 'PAUSED'
                    : `${this.controller === 'autopilot' ? 'AI' : 'HUMAN'} · ${playerName} TURN`;
        return {
            ...observation,
            phase,
            controller: this.controller,
            winner: this.model.winner,
            winningCells: this.model.winningCells.map((cell) => ({ ...cell })),
            focusColumn: this.focusColumn,
            status,
            stats: `MOVES ${this.model.moves}   RED ${this.redWins}   YELLOW ${this.yellowWins}`,
            hint: phase === 'playing'
                ? this.controller === 'autopilot'
                    ? 'AI ACTIVE — TAP A COLUMN TO TAKE OVER'
                    : 'TAP A COLUMN OR USE ← → AND ENTER'
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
        const column = this.autopilot.decide(this.model.createObservation());
        if (column !== null) {
            this.focusColumn = column;
            this.applyMove(column);
        }
    }

    private applyMove(column: number): void {
        if (!this.model.drop(column)) {
            return;
        }
        this.recordResult();
        this.resultElapsed = 0;
        this.dirty = true;
    }

    private recordResult(): void {
        if (this.resultRecorded || this.model.phase !== 'won') {
            return;
        }
        this.resultRecorded = true;
        if (this.model.winner === 1) {
            this.redWins += 1;
        } else if (this.model.winner === 2) {
            this.yellowWins += 1;
        }
    }

    private restartRound(keepAutopilot: boolean): void {
        this.model.reset();
        this.resultElapsed = 0;
        this.aiElapsed = keepAutopilot ? AI_ACTION_INTERVAL : 0;
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
