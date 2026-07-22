export class FixedStepClock {
    private accumulator = 0;

    constructor(
        readonly step = 1 / 120,
        readonly maximumSubSteps = 12,
    ) {
        if (step <= 0 || maximumSubSteps < 1) {
            throw new Error('FixedStepClock requires a positive step and substep count');
        }
    }

    advance(
        frameDelta: number,
        timeScale: number,
        update: (step: number) => void,
    ): number {
        const scaledDelta = Math.max(0, Math.min(0.1, frameDelta))
            * Math.max(0, timeScale);
        this.accumulator += scaledDelta;

        let steps = 0;

        while (this.accumulator >= this.step && steps < this.maximumSubSteps) {
            update(this.step);
            this.accumulator -= this.step;
            steps += 1;
        }

        if (steps === this.maximumSubSteps && this.accumulator >= this.step) {
            this.accumulator %= this.step;
        }

        return steps;
    }

    reset(): void {
        this.accumulator = 0;
    }
}
