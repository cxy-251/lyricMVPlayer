import { ConnectFourAutopilot } from './ConnectFourAutopilot';
import { ConnectFourModel } from './ConnectFourModel';
import type {
    ConnectFourControllerMode,
    ConnectFourDifficulty,
    ConnectFourViewState,
} from './ConnectFourTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.34;
const RESULT_HOLD = 1.5;
const TARGET_WINS = 3;

const OPENINGS: ReadonlyArray<{
    readonly name: string;
    readonly columns: readonly number[];
}> = [
    { name: 'CLASSIC', columns: [] },
    { name: 'CENTER SPLIT', columns: [3, 2] },
    { name: 'WIDE PRESS', columns: [2, 4] },
    { name: 'DOUBLE CENTER', columns: [3, 3, 2, 4] },
];

const DIFFICULTIES: readonly ConnectFourDifficulty[] = [
    'casual',
    'standard',
    'expert',
];

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
    private draws = 0;
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

    dropFromHuman(column: number): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.focusColumn = Math.max(0, Math.min(6, column));
        if (this.model.phase !== 'playing') {
            this.advanceTerminal(false);
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

    createViewState(): ConnectFourViewState {
        const observation = this.model.createObservation();
        const phase = this.paused ? 'paused' : observation.phase;
        const playerName = observation.currentPlayer === 1 ? 'RED' : 'YELLOW';
        const difficulty = this.currentDifficulty();
        const matchWinner = this.matchWinner();
        const roundResult = this.model.winner === 1
            ? 'RED WINS'
            : this.model.winner === 2
                ? 'YELLOW WINS'
                : 'DRAW';
        const status = phase === 'won' || phase === 'draw'
            ? matchWinner !== 0
                ? `${matchWinner === 1 ? 'RED' : 'YELLOW'} TAKES MATCH`
                : `${roundResult} · ROUND ${this.round}`
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
            round: this.round,
            targetWins: TARGET_WINS,
            redWins: this.redWins,
            yellowWins: this.yellowWins,
            draws: this.draws,
            openingName: this.currentOpening().name,
            difficulty,
            status,
            stats: `R${this.round}  RED ${this.redWins}/${TARGET_WINS}`
                + `  YELLOW ${this.yellowWins}/${TARGET_WINS}`
                + `  D${this.draws}  ${this.currentOpening().name}`
                + `  ${difficulty.toUpperCase()}`,
            hint: phase === 'playing'
                ? this.controller === 'autopilot'
                    ? 'AI ACTIVE — TAP A COLUMN TO TAKE OVER'
                    : 'TAP A COLUMN OR USE ← → AND ENTER'
                : matchWinner !== 0
                    ? 'TAP TO START A NEW MATCH · NEW ALSO RESETS'
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
        const column = this.autopilot.decide(
            this.model.createObservation(),
            this.currentDifficulty(),
        );
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
        if (this.resultRecorded || this.model.phase === 'playing') {
            return;
        }
        this.resultRecorded = true;
        if (this.model.winner === 1) {
            this.redWins += 1;
        } else if (this.model.winner === 2) {
            this.yellowWins += 1;
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
        this.redWins = 0;
        this.yellowWins = 0;
        this.draws = 0;
        this.round = 1;
        this.startRound();
        this.aiElapsed = keepAutopilot ? AI_ACTION_INTERVAL : 0;
        this.dirty = true;
    }

    private startRound(): void {
        this.model.reset();
        for (const column of this.currentOpening().columns) {
            if (!this.model.drop(column)) {
                this.model.reset();
                break;
            }
        }
        this.resultElapsed = 0;
        this.focusColumn = 3;
        this.resultRecorded = false;
        this.dirty = true;
    }

    private currentOpening(): typeof OPENINGS[number] {
        return OPENINGS[(this.round - 1) % OPENINGS.length] ?? OPENINGS[0];
    }

    private currentDifficulty(): ConnectFourDifficulty {
        return DIFFICULTIES[(this.round - 1) % DIFFICULTIES.length] ?? 'standard';
    }

    private matchWinner(): 0 | 1 | 2 {
        return this.redWins >= TARGET_WINS
            ? 1
            : this.yellowWins >= TARGET_WINS
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
