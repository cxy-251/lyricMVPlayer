import { TowerDefenseAutopilot } from './TowerDefenseAutopilot';
import { TowerDefenseModel } from './TowerDefenseModel';
import type {
    TowerDefenseControllerMode,
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
    private controller: TowerDefenseControllerMode = 'autopilot';
    private selectedSlotId = 0;
    private selectedKind: TowerDefenseTowerKind = 'dart';
    private humanIdleElapsed = AI_TAKEOVER_DELAY;
    private aiElapsed = AI_ACTION_INTERVAL;
    private resultElapsed = 0;
    private renderElapsed = RENDER_INTERVAL;
    private paused = false;
    private dirty = true;

    update(deltaTime: number): boolean {
        if (this.paused) {
            return false;
        }
        const dt = Math.max(0, Math.min(0.1, deltaTime));
        this.renderElapsed += dt;

        if (this.model.phase === 'won' || this.model.phase === 'lost') {
            return this.updateTerminalState(dt);
        }

        if (this.controller === 'human') {
            this.humanIdleElapsed += dt;
            if (this.humanIdleElapsed >= AI_TAKEOVER_DELAY) {
                this.activateAutopilot();
            }
        }

        if (this.controller === 'autopilot') {
            this.aiElapsed += dt;
            if (this.aiElapsed >= AI_ACTION_INTERVAL) {
                this.aiElapsed %= AI_ACTION_INTERVAL;
                const action = this.autopilot.decide(this.model.createObservation());
                if (action && this.model.perform(action)) {
                    if (action.kind === 'build' || action.kind === 'upgrade') {
                        this.selectedSlotId = action.slotId;
                    }
                    if (action.kind === 'build') {
                        this.selectedKind = action.towerKind;
                    }
                    this.dirty = true;
                }
            }
        }

        if (this.model.step(dt)) {
            this.dirty = true;
        }
        if (this.model.phase === 'won' || this.model.phase === 'lost') {
            this.resultElapsed = 0;
            this.dirty = true;
        }
        return this.consumeRender();
    }

    selectSlotFromHuman(slotId: number): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        const slots = this.model.createObservation().slots;
        if (slots.some((slot) => slot.id === slotId)) {
            this.selectedSlotId = slotId;
            this.dirty = true;
        }
    }

    moveSelectionFromHuman(direction: TowerDefenseDirection): void {
        if (this.paused) {
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
            const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
            const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
            const score = primary + secondary * 1.8;
            if (score < bestScore) {
                bestScore = score;
                bestId = candidate.id;
            }
        }
        this.selectedSlotId = bestId;
        this.dirty = true;
    }

    selectKindFromHuman(kind: TowerDefenseTowerKind): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.selectedKind = kind;
        this.dirty = true;
    }

    buildSelectedFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        this.dirty = this.model.perform({
            kind: 'build',
            slotId: this.selectedSlotId,
            towerKind: this.selectedKind,
        }) || this.dirty;
    }

    upgradeSelectedFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        this.dirty = this.model.perform({
            kind: 'upgrade',
            slotId: this.selectedSlotId,
        }) || this.dirty;
    }

    startWaveFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.restartTerminalIfNeeded();
        this.dirty = this.model.perform({ kind: 'start-wave' }) || this.dirty;
    }

    restartFromHuman(): void {
        if (this.paused) {
            return;
        }
        this.activateHuman();
        this.model.reset();
        this.selectedSlotId = 0;
        this.selectedKind = 'dart';
        this.dirty = true;
    }

    pause(): void {
        this.paused = true;
        this.dirty = true;
    }

    resume(): void {
        this.paused = false;
        this.renderElapsed = RENDER_INTERVAL;
        this.dirty = true;
    }

    reset(): void {
        this.model.reset();
        this.controller = 'autopilot';
        this.selectedSlotId = 0;
        this.selectedKind = 'dart';
        this.humanIdleElapsed = AI_TAKEOVER_DELAY;
        this.aiElapsed = AI_ACTION_INTERVAL;
        this.resultElapsed = 0;
        this.renderElapsed = RENDER_INTERVAL;
        this.paused = false;
        this.dirty = true;
    }

    dispose(): void {}

    createViewState(): TowerDefenseViewState {
        const observation = this.model.createObservation();
        const phase = this.paused ? 'paused' : observation.phase;
        const selected = observation.slots.find((slot) => slot.id === this.selectedSlotId);
        const status = phase === 'won'
            ? 'ALL WAVES CLEARED'
            : phase === 'lost'
                ? 'BASE OVERRUN'
                : phase === 'paused'
                    ? 'PAUSED'
                    : phase === 'building'
                        ? this.controller === 'autopilot'
                            ? 'AI BUILDING'
                            : 'BUILD PHASE'
                        : this.controller === 'autopilot'
                            ? 'AI DEFENDING'
                            : 'WAVE ACTIVE';
        const selectedText = selected?.tower
            ? `${selected.tower.kind.toUpperCase()} L${selected.tower.level}`
            : `EMPTY / ${this.selectedKind.toUpperCase()}`;
        return {
            ...observation,
            phase,
            controller: this.controller,
            selectedSlotId: this.selectedSlotId,
            selectedKind: this.selectedKind,
            status,
            stats: `WAVE ${observation.wave}/${observation.maxWaves}`
                + `   GOLD ${observation.gold}`
                + `   BASE ${observation.lives}`
                + `   SCORE ${observation.score}`,
            hint: phase === 'won' || phase === 'lost'
                ? this.controller === 'autopilot'
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
        if (this.controller === 'human') {
            this.humanIdleElapsed += dt;
            if (this.humanIdleElapsed >= AI_TAKEOVER_DELAY) {
                this.activateAutopilot();
            }
            return this.consumeRender();
        }

        this.resultElapsed += dt;
        if (this.resultElapsed >= RESULT_HOLD) {
            this.model.reset();
            this.selectedSlotId = 0;
            this.selectedKind = 'dart';
            this.resultElapsed = 0;
            this.aiElapsed = AI_ACTION_INTERVAL;
            this.dirty = true;
        }
        return this.consumeRender();
    }

    private restartTerminalIfNeeded(): void {
        if (this.model.phase !== 'won' && this.model.phase !== 'lost') {
            return;
        }
        this.model.reset();
        this.selectedSlotId = 0;
        this.selectedKind = 'dart';
        this.resultElapsed = 0;
        this.aiElapsed = 0;
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

    private consumeRender(): boolean {
        if (!this.dirty && this.renderElapsed < RENDER_INTERVAL) {
            return false;
        }
        this.renderElapsed %= RENDER_INTERVAL;
        this.dirty = false;
        return true;
    }
}
