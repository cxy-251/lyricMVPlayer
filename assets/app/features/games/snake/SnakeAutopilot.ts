import type {
    SnakeDirection,
    SnakeObservation,
    SnakePoint,
} from './SnakeTypes';

const DIRECTIONS: readonly SnakeDirection[] = ['up', 'down', 'left', 'right'];
const OFFSETS: Record<SnakeDirection, readonly [number, number]> = {
    up: [0, 1],
    down: [0, -1],
    left: [-1, 0],
    right: [1, 0],
};

interface Candidate {
    readonly direction: SnakeDirection;
    readonly score: number;
}

export class SnakeAutopilot {
    decide(observation: SnakeObservation): SnakeDirection | null {
        if (observation.phase !== 'playing' || observation.snake.length === 0) {
            return null;
        }
        const candidates: Candidate[] = [];
        for (const direction of DIRECTIONS) {
            if (this.isOpposite(direction, observation.direction)) {
                continue;
            }
            const candidate = this.evaluateDirection(observation, direction);
            if (candidate) {
                candidates.push(candidate);
            }
        }
        candidates.sort((left, right) => right.score - left.score);
        return candidates[0]?.direction ?? null;
    }

    private evaluateDirection(
        observation: SnakeObservation,
        direction: SnakeDirection,
    ): Candidate | null {
        const head = observation.snake[0];
        const [offsetX, offsetY] = OFFSETS[direction];
        const next = { x: head.x + offsetX, y: head.y + offsetY };
        const eating = next.x === observation.food.x && next.y === observation.food.y;
        const occupiedBefore = new Set<string>();
        const collisionLength = eating
            ? observation.snake.length
            : Math.max(0, observation.snake.length - 1);
        for (let index = 0; index < collisionLength; index += 1) {
            const point = observation.snake[index];
            occupiedBefore.add(this.key(point.x, point.y));
        }
        if (
            !this.inside(next, observation.width, observation.height)
            || occupiedBefore.has(this.key(next.x, next.y))
        ) {
            return null;
        }

        const simulated = [
            next,
            ...observation.snake.slice(0, eating
                ? observation.snake.length
                : observation.snake.length - 1),
        ];
        const blocked = new Set(simulated.slice(1).map((point) => this.key(point.x, point.y)));
        const area = this.reachableArea(next, blocked, observation.width, observation.height);
        const foodDistance = this.shortestDistance(
            next,
            observation.food,
            blocked,
            observation.width,
            observation.height,
        );
        const tail = simulated[simulated.length - 1];
        const tailDistance = this.shortestDistance(
            next,
            tail,
            new Set(simulated.slice(1, -1).map((point) => this.key(point.x, point.y))),
            observation.width,
            observation.height,
        );

        let score = area * 4;
        score += tailDistance >= 0 ? 125 : -180;
        score += eating ? 240 : 0;
        score += foodDistance >= 0 ? Math.max(-160, 100 - foodDistance * 9) : -90;
        if (area < simulated.length + 5) {
            score -= 320;
        }
        const wallDistance = Math.min(
            next.x,
            observation.width - 1 - next.x,
            next.y,
            observation.height - 1 - next.y,
        );
        score += Math.min(4, wallDistance) * 3;
        return { direction, score };
    }

    private reachableArea(
        start: SnakePoint,
        blocked: ReadonlySet<string>,
        width: number,
        height: number,
    ): number {
        const queue: SnakePoint[] = [start];
        const visited = new Set([this.key(start.x, start.y)]);
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const point = queue[cursor];
            for (const direction of DIRECTIONS) {
                const [dx, dy] = OFFSETS[direction];
                const next = { x: point.x + dx, y: point.y + dy };
                const key = this.key(next.x, next.y);
                if (
                    this.inside(next, width, height)
                    && !blocked.has(key)
                    && !visited.has(key)
                ) {
                    visited.add(key);
                    queue.push(next);
                }
            }
        }
        return visited.size;
    }

    private shortestDistance(
        start: SnakePoint,
        target: SnakePoint,
        blocked: ReadonlySet<string>,
        width: number,
        height: number,
    ): number {
        const targetKey = this.key(target.x, target.y);
        const queue: Array<{ point: SnakePoint; distance: number }> = [
            { point: start, distance: 0 },
        ];
        const visited = new Set([this.key(start.x, start.y)]);
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const current = queue[cursor];
            if (this.key(current.point.x, current.point.y) === targetKey) {
                return current.distance;
            }
            for (const direction of DIRECTIONS) {
                const [dx, dy] = OFFSETS[direction];
                const next = {
                    x: current.point.x + dx,
                    y: current.point.y + dy,
                };
                const key = this.key(next.x, next.y);
                if (
                    this.inside(next, width, height)
                    && !blocked.has(key)
                    && !visited.has(key)
                ) {
                    visited.add(key);
                    queue.push({ point: next, distance: current.distance + 1 });
                }
            }
        }
        return -1;
    }

    private inside(point: SnakePoint, width: number, height: number): boolean {
        return point.x >= 0 && point.x < width && point.y >= 0 && point.y < height;
    }

    private isOpposite(left: SnakeDirection, right: SnakeDirection): boolean {
        return (left === 'up' && right === 'down')
            || (left === 'down' && right === 'up')
            || (left === 'left' && right === 'right')
            || (left === 'right' && right === 'left');
    }

    private key(x: number, y: number): string {
        return `${x}:${y}`;
    }
}
