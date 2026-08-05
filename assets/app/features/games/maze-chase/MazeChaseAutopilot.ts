import type {
    MazeChaseDirection,
    MazeChaseObservation,
    MazeChasePoint,
} from './MazeChaseTypes';

const DIRECTIONS: readonly MazeChaseDirection[] = ['up', 'left', 'down', 'right'];
const OFFSETS: Record<MazeChaseDirection, readonly [number, number]> = {
    up: [0, 1],
    down: [0, -1],
    left: [-1, 0],
    right: [1, 0],
};

export class MazeChaseAutopilot {
    decide(observation: MazeChaseObservation): MazeChaseDirection | null {
        if (observation.phase !== 'playing') {
            return null;
        }
        let best: MazeChaseDirection | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const direction of DIRECTIONS) {
            const next = this.offset(observation.player, direction);
            if (!this.isOpen(observation, next)) {
                continue;
            }
            const enemyDistance = this.distanceToNearestEnemy(observation, next);
            const pelletDistance = this.distanceToNearestPellet(observation, next);
            const reachable = this.reachableArea(observation, next);
            const continuing = direction === observation.direction ? 8 : 0;
            const frightened = observation.frightenedRemaining > 0;
            const danger = frightened
                ? 0
                : enemyDistance <= 1
                    ? -10000
                    : enemyDistance === 2
                        ? -650
                        : Math.min(enemyDistance, 8) * 32;
            const hunt = frightened && enemyDistance < 99
                ? Math.max(0, 280 - enemyDistance * 26)
                : 0;
            const pellet = pelletDistance >= 0 ? 240 - pelletDistance * 18 : -300;
            const index = next.y * observation.width + next.x;
            const powerBonus = observation.powerPellets[index] ? 420 : 0;
            const score = danger + hunt + pellet + powerBonus + reachable * 2.5 + continuing;
            if (score > bestScore) {
                bestScore = score;
                best = direction;
            }
        }
        return best;
    }

    private distanceToNearestEnemy(
        observation: MazeChaseObservation,
        start: MazeChasePoint,
    ): number {
        let best = Number.POSITIVE_INFINITY;
        for (const enemy of observation.enemies) {
            if (enemy.respawning) {
                continue;
            }
            const distance = this.shortestDistance(observation, start, (point) => (
                point.x === enemy.x && point.y === enemy.y
            ));
            if (distance >= 0) {
                best = Math.min(best, distance);
            }
        }
        return Number.isFinite(best) ? best : 99;
    }

    private distanceToNearestPellet(
        observation: MazeChaseObservation,
        start: MazeChasePoint,
    ): number {
        return this.shortestDistance(observation, start, (point) => {
            const index = point.y * observation.width + point.x;
            return observation.pellets[index] || observation.powerPellets[index];
        });
    }

    private reachableArea(
        observation: MazeChaseObservation,
        start: MazeChasePoint,
    ): number {
        const queue: MazeChasePoint[] = [start];
        const visited = new Set([this.key(start)]);
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const point = queue[cursor];
            for (const direction of DIRECTIONS) {
                const next = this.offset(point, direction);
                const key = this.key(next);
                if (this.isOpen(observation, next) && !visited.has(key)) {
                    visited.add(key);
                    queue.push(next);
                }
            }
        }
        return visited.size;
    }

    private shortestDistance(
        observation: MazeChaseObservation,
        start: MazeChasePoint,
        target: (point: MazeChasePoint) => boolean,
    ): number {
        const queue: Array<{ point: MazeChasePoint; distance: number }> = [
            { point: start, distance: 0 },
        ];
        const visited = new Set([this.key(start)]);
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const current = queue[cursor];
            if (target(current.point)) {
                return current.distance;
            }
            for (const direction of DIRECTIONS) {
                const next = this.offset(current.point, direction);
                const key = this.key(next);
                if (this.isOpen(observation, next) && !visited.has(key)) {
                    visited.add(key);
                    queue.push({ point: next, distance: current.distance + 1 });
                }
            }
        }
        return -1;
    }

    private isOpen(observation: MazeChaseObservation, point: MazeChasePoint): boolean {
        return point.x >= 0
            && point.x < observation.width
            && point.y >= 0
            && point.y < observation.height
            && !observation.walls[point.y * observation.width + point.x];
    }

    private offset(point: MazeChasePoint, direction: MazeChaseDirection): MazeChasePoint {
        const [dx, dy] = OFFSETS[direction];
        return { x: point.x + dx, y: point.y + dy };
    }

    private key(point: MazeChasePoint): string {
        return `${point.x}:${point.y}`;
    }
}
