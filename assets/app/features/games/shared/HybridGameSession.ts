export type HybridControllerMode = 'human' | 'autopilot';

export interface HybridGameSessionOptions {
    readonly aiTakeoverDelay: number;
    readonly aiActionInterval: number;
    readonly resultHold: number;
    readonly renderInterval: number;
    readonly maximumDeltaTime?: number;
}

export class HybridGameSession {
    private currentController: HybridControllerMode = 'autopilot';
    private humanIdleElapsed: number;
    private aiElapsed: number;
    private resultElapsed = 0;
    private renderElapsed: number;
    private paused = false;
    private dirty = true;

    constructor(private readonly options: HybridGameSessionOptions) {
        this.validateOptions();
        this.humanIdleElapsed = options.aiTakeoverDelay;
        this.aiElapsed = options.aiActionInterval;
        this.renderElapsed = options.renderInterval;
    }

    get controller(): HybridControllerMode {
        return this.currentController;
    }

    get isPaused(): boolean {
        return this.paused;
    }

    beginFrame(deltaTime: number): number {
        const maximumDeltaTime = this.options.maximumDeltaTime ?? 0.1;
        const candidate = Number.isFinite(deltaTime) ? deltaTime : 0;
        const dt = Math.max(0, Math.min(maximumDeltaTime, candidate));
        this.renderElapsed += dt;
        return dt;
    }

    shouldActivateAutopilot(deltaTime: number): boolean {
        if (this.currentController !== 'human') {
            return false;
        }
        this.humanIdleElapsed += deltaTime;
        return this.humanIdleElapsed >= this.options.aiTakeoverDelay;
    }

    shouldRunAi(deltaTime: number): boolean {
        if (this.currentController !== 'autopilot') {
            return false;
        }
        this.aiElapsed += deltaTime;
        if (this.aiElapsed < this.options.aiActionInterval) {
            return false;
        }
        this.aiElapsed %= this.options.aiActionInterval;
        return true;
    }

    shouldRestartTerminal(deltaTime: number): boolean {
        if (this.currentController !== 'autopilot') {
            return false;
        }
        this.resultElapsed += deltaTime;
        return this.resultElapsed >= this.options.resultHold;
    }

    activateHuman(): void {
        this.currentController = 'human';
        this.humanIdleElapsed = 0;
        this.aiElapsed = 0;
        this.resultElapsed = 0;
        this.dirty = true;
    }

    activateAutopilot(): void {
        this.currentController = 'autopilot';
        this.humanIdleElapsed = this.options.aiTakeoverDelay;
        this.aiElapsed = this.options.aiActionInterval;
        this.resultElapsed = 0;
        this.dirty = true;
    }

    pause(): void {
        this.paused = true;
        this.dirty = true;
    }

    resume(): void {
        this.paused = false;
        this.renderElapsed = this.options.renderInterval;
        this.dirty = true;
    }

    reset(): void {
        this.currentController = 'autopilot';
        this.humanIdleElapsed = this.options.aiTakeoverDelay;
        this.aiElapsed = this.options.aiActionInterval;
        this.resultElapsed = 0;
        this.renderElapsed = this.options.renderInterval;
        this.paused = false;
        this.dirty = true;
    }

    markDirty(changed = true): void {
        if (changed) {
            this.dirty = true;
        }
    }

    resetTerminalClock(): void {
        this.resultElapsed = 0;
    }

    resetAiClock(runImmediately: boolean): void {
        this.aiElapsed = runImmediately ? this.options.aiActionInterval : 0;
    }

    consumeRender(): boolean {
        if (!this.dirty && this.renderElapsed < this.options.renderInterval) {
            return false;
        }
        this.renderElapsed %= this.options.renderInterval;
        this.dirty = false;
        return true;
    }

    private validateOptions(): void {
        const nonNegative = [
            ['aiTakeoverDelay', this.options.aiTakeoverDelay],
            ['resultHold', this.options.resultHold],
        ] as const;
        for (const [name, value] of nonNegative) {
            if (!Number.isFinite(value) || value < 0) {
                throw new Error(`HybridGameSession ${name} must be a finite non-negative number`);
            }
        }

        const positive = [
            ['aiActionInterval', this.options.aiActionInterval],
            ['renderInterval', this.options.renderInterval],
            ['maximumDeltaTime', this.options.maximumDeltaTime ?? 0.1],
        ] as const;
        for (const [name, value] of positive) {
            if (!Number.isFinite(value) || value <= 0) {
                throw new Error(`HybridGameSession ${name} must be a finite positive number`);
            }
        }
    }
}
