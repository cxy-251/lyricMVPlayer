import type { BlockStackerObservation } from './BlockStackerTypes';

export class BlockStackerAutopilot {
    private lastLevel = -1;
    private lastError = Number.NaN;

    reset(): void {
        this.lastLevel = -1;
        this.lastError = Number.NaN;
    }

    shouldDrop(observation: BlockStackerObservation): boolean {
        if (observation.phase !== 'playing' || observation.movingWidth <= 0) {
            return false;
        }
        if (observation.level !== this.lastLevel) {
            this.lastLevel = observation.level;
            this.lastError = Number.NaN;
        }

        const maximumBias = observation.supportWidth < 34
            ? 0
            : Math.min(2.6, observation.supportWidth * 0.017);
        const targetBias = Math.sin(observation.level * 2.173 + 0.41) * maximumBias;
        const targetX = observation.supportX + targetBias;
        const error = observation.movingX - targetX;
        const tolerance = Math.max(
            1.35,
            Math.min(4.6, observation.movingWidth * 0.034),
        );
        const crossedTarget = Number.isFinite(this.lastError)
            && error !== 0
            && this.lastError !== 0
            && Math.sign(error) !== Math.sign(this.lastError);
        const movingTowardTarget = error * observation.direction < 0;
        const overlapLeft = Math.max(
            observation.movingX - observation.movingWidth / 2,
            observation.supportX - observation.supportWidth / 2,
        );
        const overlapRight = Math.min(
            observation.movingX + observation.movingWidth / 2,
            observation.supportX + observation.supportWidth / 2,
        );
        const overlapRatio = Math.max(0, overlapRight - overlapLeft)
            / Math.max(1, observation.movingWidth);

        this.lastError = error;
        if (Math.abs(error) <= tolerance || crossedTarget) {
            return true;
        }
        return overlapRatio > 0.91
            && !movingTowardTarget
            && Math.abs(error) < observation.supportWidth * 0.12;
    }
}
