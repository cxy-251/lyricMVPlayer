import type {
    RiverCrossingDirection,
    RiverCrossingObservation,
    RiverLaneState,
} from './RiverCrossingTypes';

const ACTIONS: ReadonlyArray<RiverCrossingDirection | null> = [
    'up', 'left', 'right', null, 'down',
];
const FORECAST_TIME = 0.32;

export class RiverCrossingAutopilot {
    decide(observation: RiverCrossingObservation): RiverCrossingDirection | null {
        if (observation.phase !== 'playing') {
            return null;
        }
        let bestAction: RiverCrossingDirection | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const action of ACTIONS) {
            const candidate = this.candidate(observation, action);
            if (!candidate) {
                continue;
            }
            const lane = observation.lanes[candidate.y];
            const safety = this.safetyMargin(observation, lane, candidate.x, FORECAST_TIME);
            if (safety < 0) {
                continue;
            }
            const progress = candidate.y * 120;
            const center = -Math.abs(candidate.x - (observation.width - 1) / 2) * 3;
            const downward = action === 'down' ? -85 : 0;
            const waiting = action === null ? -8 : 0;
            const goalBonus = lane.kind === 'goal' ? 2000 : 0;
            const score = progress + safety * 42 + center + downward + waiting + goalBonus;
            if (score > bestScore) {
                bestScore = score;
                bestAction = action;
            }
        }
        return bestAction;
    }

    private candidate(
        observation: RiverCrossingObservation,
        action: RiverCrossingDirection | null,
    ): { x: number; y: number } | null {
        let x = observation.player.x;
        let y = observation.player.y;
        if (action === 'up') {
            y += 1;
        } else if (action === 'down') {
            y -= 1;
        } else if (action === 'left') {
            x -= 1;
        } else if (action === 'right') {
            x += 1;
        }
        if (y < 0 || y >= observation.height || x < 0 || x > observation.width - 1) {
            return null;
        }
        const lane = observation.lanes[y];
        if (action === null && lane.kind === 'river') {
            x += lane.speed * FORECAST_TIME;
        }
        return { x, y };
    }

    private safetyMargin(
        observation: RiverCrossingObservation,
        lane: RiverLaneState,
        x: number,
        time: number,
    ): number {
        if (lane.kind === 'safe' || lane.kind === 'goal') {
            return 4;
        }
        let closest = Number.POSITIVE_INFINITY;
        let supported = false;
        for (const object of lane.objects) {
            const projected = this.wrapX(
                object.x + lane.speed * time,
                object.width,
                observation.width,
            );
            const margin = Math.abs(projected - x) - object.width / 2 - 0.32;
            closest = Math.min(closest, margin);
            if (margin <= 0) {
                supported = true;
            }
        }
        if (lane.kind === 'road') {
            return closest;
        }
        if (!supported) {
            return -1;
        }
        const carriedX = x + lane.speed * time;
        return Math.min(carriedX + 0.35, observation.width - 0.65 - carriedX, 1.5);
    }

    private wrapX(x: number, objectWidth: number, width: number): number {
        const minimum = -objectWidth / 2 - 1;
        const maximum = width - 1 + objectWidth / 2 + 1;
        const span = maximum - minimum;
        let value = x;
        while (value > maximum) {
            value -= span;
        }
        while (value < minimum) {
            value += span;
        }
        return value;
    }
}
