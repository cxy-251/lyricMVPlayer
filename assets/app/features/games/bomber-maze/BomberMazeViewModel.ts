import { HybridGameSession } from '../shared/HybridGameSession';
import { BomberMazeAutopilot } from './BomberMazeAutopilot';
import { BomberMazeModel } from './BomberMazeModel';
import type {
    BomberMazeDirection,
    BomberMazeViewState,
} from './BomberMazeTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.15;
const RESULT_HOLD = 1.5;
const LIFE_LOST_HOLD = 1.05;
const RENDER_INTERVAL = 1 / 30;

export class BomberMazeViewModel {
    private readonly model = new BomberMazeModel();
    private readonly autopilot = new BomberMazeAutopilot();
    private readonly session = new HybridGameSession({
        aiTakeoverDelay: AI_TAKEOVER_DELAY,
        aiActionInterval: AI_ACTION_INTERVAL,
        resultHold: RESULT_HOLD,
        renderInterval: RENDER_INTERVAL,
    });
    private lifeLostElapsed = 0;

    update(deltaTime: number): boolean {
        if (this.session.isPaused) {
            return false;
        }
        const dt = this.session.beginFrame(deltaTime);

        if (this.lifeLostElapsed > 0) {
            this.lifeLostElapsed = Math.max(0, this.lifeLostElapsed - dt);
            if (this.lifeLostElapsed === 0) {
                this.session.resetAiClock(true);
                this.session.markDirty();
            }
            return this.session.consumeRender();
        }

        if (this.model.phase !== 'playing') {
            return this.updateTerminalState(dt);
        }

        if (this.session.shouldActivateAutopilot(dt)) {
            this.activateAutopilot();
        }

        if (this.session.shouldRunAi(dt)) {
            const action = this.autopilot.decide(this.model.createObservation());
            const livesBeforeAction = this.model.lives;
            this.session.markDirty(Boolean(action && this.model.perform(action)));
            if (this.beginLifeLostHold(livesBeforeAction)) {
                return this.session.consumeRender();
            }
        }

        const livesBeforeStep = this.model.lives;
        this.session.markDirty(this.model.step(dt));
        this.beginLifeLostHold(livesBeforeStep);
        if (this.model.phase !== 'playing') {
            this.session.resetTerminalClock();
            this.session.markDirty();
        }
        return this.session.consumeRender();
    }

    moveFromHuman(direction: BomberMazeDirection): void {
        if (this.session.isPaused || this.lifeLostElapsed > 0) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        const livesBeforeAction = this.model.lives;
        this.session.markDirty(this.model.movePlayer(direction));
        this.beginLifeLostHold(livesBeforeAction);
    }

    placeBombFromHuman(): void {
        if (this.session.isPaused || this.lifeLostElapsed > 0) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        this.session.markDirty(this.model.placeBomb());
    }

    restartFromHuman(): void {
        if (this.session.isPaused) {
            return;
        }
        this.activateHuman();
        this.lifeLostElapsed = 0;
        this.model.reset();
        this.session.markDirty();
    }

    pause(): void {
        this.session.pause();
    }

    resume(): void {
        this.session.resume();
    }

    reset(): void {
        this.lifeLostElapsed = 0;
        this.model.reset();
        this.session.reset();
    }

    dispose(): void {
        this.lifeLostElapsed = 0;
    }

    createViewState(): BomberMazeViewState {
        const observation = this.model.createObservation();
        const controller = this.session.controller;
        const hazardActive = observation.bombs.length > 0
            || observation.explosions.length > 0;
        const phase = this.session.isPaused
            ? 'paused'
            : this.lifeLostElapsed > 0
                ? 'respawning'
                : observation.phase;
        const status = phase === 'won'
            ? 'MAZE CLEARED'
            : phase === 'lost'
                ? 'RUN ENDED'
                : phase === 'respawning'
                    ? 'LIFE LOST'
                    : phase === 'paused'
                        ? 'PAUSED'
                        : controller === 'autopilot'
                            ? hazardActive
                                ? 'AI HOLDING SAFE POSITION'
                                : 'AI PLANNING ESCAPES'
                            : 'HUMAN';
        return {
            ...observation,
            phase,
            controller,
            score: this.model.score,
            lives: this.model.lives,
            status,
            stats: `SCORE ${this.model.score}`
                + `   LIVES ${this.model.lives}`
                + `   ENEMIES ${observation.enemies.length}`
                + `   BOMBS ${observation.activeBombs}/${observation.bombCapacity}`
                + `   RANGE ${observation.blastRange}`,
            hint: phase === 'respawning'
                ? 'RESPAWNING...'
                : phase === 'won' || phase === 'lost'
                    ? controller === 'autopilot'
                        ? 'AI WILL START A NEW MAZE'
                        : 'MOVE, BOMB OR PRESS NEW'
                    : controller === 'autopilot'
                        ? hazardActive
                            ? 'AI WAITS OUTSIDE THE BLAST AREA'
                            : 'AI ACTIVE — MOVE OR DROP A BOMB TO TAKE OVER'
                        : 'ARROWS / WASD / SWIPE   F OR B TO BOMB',
            invulnerable: this.model.invulnerable,
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
            this.model.reset();
            this.session.resetTerminalClock();
            this.session.resetAiClock(true);
            this.session.markDirty();
        }
        return this.session.consumeRender();
    }

    private beginLifeLostHold(previousLives: number): boolean {
        if (
            this.model.phase !== 'playing'
            || this.model.lives >= previousLives
        ) {
            return false;
        }
        this.lifeLostElapsed = LIFE_LOST_HOLD;
        this.session.resetAiClock(false);
        this.session.markDirty();
        return true;
    }

    private restartTerminalIfNeeded(): void {
        if (this.model.phase === 'playing') {
            return;
        }
        this.lifeLostElapsed = 0;
        this.model.reset();
        this.session.resetTerminalClock();
        this.session.resetAiClock(false);
        this.session.markDirty();
    }

    private activateHuman(): void {
        this.session.activateHuman();
    }

    private activateAutopilot(): void {
        this.session.activateAutopilot();
    }
}
