import { HybridGameSession } from '../shared/HybridGameSession';
import { TowerDefenseAutopilot } from './TowerDefenseAutopilot';
import { TowerDefenseModel } from './TowerDefenseModel';
import type {
    TowerDefenseDirection,
    TowerDefenseTowerKind,
    TowerDefenseViewState,
} from './TowerDefenseTypes';

const AI_TAKEOVER_DELAY = 3;
const AI_ACTION_INTERVAL = 0.52;
const RESULT_HOLD = 1.5;
const RENDER_INTERVAL = 1 / 30;

export class TowerDefenseViewModel {
    private readonly model = new TowerDefenseModel();
    private readonly autopilot = new TowerDefenseAutopilot();
    private readonly session = new HybridGameSession({
        aiTakeoverDelay: AI_TAKEOVER_DELAY,
        aiActionInterval: AI_ACTION_INTERVAL,
        resultHold: RESULT_HOLD,
        renderInterval: RENDER_INTERVAL,
    });
    private selectedSlotId = 0;
    private selectedKind: TowerDefenseTowerKind = 'dart';

    update(deltaTime: number): boolean {
        if (this.session.isPaused) {
            return false;
        }
        const dt = this.session.beginFrame(deltaTime);

        if (this.model.phase === 'won' || this.model.phase === 'lost') {
            return this.updateTerminalState(dt);
        }

        if (this.session.shouldActivateAutopilot(dt)) {
            this.activateAutopilot();
        }

        if (this.session.shouldRunAi(dt)) {
            const action = this.autopilot.decide(this.model.createObservation());
            if (action && this.model.perform(action)) {
                if (action.kind === 'build' || action.kind === 'upgrade') {
                    this.selectedSlotId = action.slotId;
                }
                if (action.kind === 'build') {
                    this.selectedKind = action.towerKind;
                }
                this.session.markDirty();
            }
        }

        this.session.markDirty(this.model.step(dt));
        if (this.model.phase === 'won' || this.model.phase === 'lost') {
            this.session.resetTerminalClock();
            this.session.markDirty();
        }
        return this.session.consumeRender();
    }

    selectSlotFromHuman(slotId: number): void {
        if (this.session.isPaused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        const slots = this.model.createObservation().slots;
        if (slots.some((slot) => slot.id === slotId)) {
            this.selectedSlotId = slotId;
            this.session.markDirty();
        }
    }

    moveSelectionFromHuman(direction: TowerDefenseDirection): void {
        if (this.session.isPaused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        const observation = this.model.createObservation();
        const current = observation.slots.find((slot) => slot.id === this.selectedSlotId)
            ?? observation.slots[0];
        if (!current) {
            return;
        }

        let bestId = current.id;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const candidate of observation.slots) {
            if (candidate.id === current.id) {
                continue;
            }
            const dx = candidate.x - current.x;
            const dy = candidate.y - current.y;
            const valid = direction === 'left'
                ? dx < 0
                : direction === 'right'
                    ? dx > 0
                    : direction === 'up'
                        ? dy > 0
                        : dy < 0;
            if (!valid) {
                continue;
            }
            const primary = direction === 'left' || direction === 'right'
                ? Math.abs(dx)
                : Math.abs(dy);
            const secondary = direction === 'left' || direction === 'right'
                ? Math.abs(dy)
                : Math.abs(dx);
            const score = primary + secondary * 1.8;
            if (score < bestScore) {
                bestScore = score;
                bestId = candidate.id;
            }
        }
        this.selectedSlotId = bestId;
        this.session.markDirty();
    }

    selectKindFromHuman(kind: TowerDefenseTowerKind): void {
        if (this.session.isPaused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        this.selectedKind = kind;
        this.session.markDirty();
    }

    buildSelectedFromHuman(): void {
        if (this.session.isPaused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        this.session.markDirty(this.model.perform({
            kind: 'build',
            slotId: this.selectedSlotId,
            towerKind: this.selectedKind,
        }));
    }

    upgradeSelectedFromHuman(): void {
        if (this.session.isPaused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        this.session.markDirty(this.model.perform({
            kind: 'upgrade',
            slotId: this.selectedSlotId,
        }));
    }

    startWaveFromHuman(): void {
        if (this.session.isPaused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        this.session.markDirty(this.model.perform({ kind: 'start-wave' }));
    }

    restartFromHuman(): void {
        if (this.session.isPaused) {
            return;
        }
        this.activateHuman();
        this.resetDefense();
        this.session.markDirty();
    }

    pause(): void {
        this.session.pause();
    }

    resume(): void {
        this.session.resume();
    }

    reset(): void {
        this.resetDefense();
        this.session.reset();
    }

    dispose(): void {}

    createViewState(): TowerDefenseViewState {
        const observation = this.model.createObservation();
        const controller = this.session.controller;
        const phase = this.session.isPaused ? 'paused' : observation.phase;
        const selected = observation.slots.find((slot) => slot.id === this.selectedSlotId);
        const status = phase === 'won'
            ? 'ALL WAVES CLEARED'
            : phase === 'lost'
                ? 'BASE OVERRUN'
                : phase === 'paused'
                    ? 'PAUSED'
                    : phase === 'building'
                        ? controller === 'autopilot'
                            ? 'AI BUILDING'
                            : 'BUILD PHASE'
                        : controller === 'autopilot'
                            ? 'AI DEFENDING'
                            : 'WAVE ACTIVE';
        const selectedText = selected?.tower
            ? `${selected.tower.kind.toUpperCase()} L${selected.tower.level}`
            : `EMPTY / ${this.selectedKind.toUpperCase()}`;
        return {
            ...observation,
            phase,
            controller,
            selectedSlotId: this.selectedSlotId,
            selectedKind: this.selectedKind,
            status,
            stats: `WAVE ${observation.wave}/${observation.maxWaves}`
                + `   GOLD ${observation.gold}`
                + `   BASE ${observation.lives}`
                + `   SCORE ${observation.score}`,
            hint: phase === 'won' || phase === 'lost'
                ? controller === 'autopilot'
                    ? 'AI WILL START A NEW DEFENSE'
                    : 'SELECT, BUILD OR PRESS NEW'
                : `${selectedText}`
                    + (observation.phase === 'building'
                        ? `   NEXT ${Math.ceil(observation.timeToNextWave)}S`
                        : `   ENEMIES ${observation.enemies.length}`
                            + `   SPAWNED ${observation.spawned}/${observation.waveSize}`),
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
            this.resetDefense();
            this.session.resetTerminalClock();
            this.session.resetAiClock(true);
            this.session.markDirty();
        }
        return this.session.consumeRender();
    }

    private restartTerminalIfNeeded(): void {
        if (this.model.phase !== 'won' && this.model.phase !== 'lost') {
            return;
        }
        this.resetDefense();
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

    private resetDefense(): void {
        this.model.reset();
        this.selectedSlotId = 0;
        this.selectedKind = 'dart';
    }
}
