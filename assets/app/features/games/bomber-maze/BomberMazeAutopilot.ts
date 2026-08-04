import type {
    BomberMazeAction,
    BomberMazeBombState,
    BomberMazeCellKind,
    BomberMazeDirection,
    BomberMazeObservation,
    BomberMazePoint,
} from './BomberMazeTypes';

const DIRECTIONS: readonly BomberMazeDirection[] = ['up', 'down', 'left', 'right'];
const OFFSETS: Record<BomberMazeDirection, readonly [number, number]> = {
    up: [0, 1],
    down: [0, -1],
    left: [-1, 0],
    right: [1, 0],
};
const STEP_TIME = 0.15;
const SAFETY_MARGIN = 0.18;

interface SearchNode extends BomberMazePoint {
    readonly firstDirection: BomberMazeDirection | null;
    readonly steps: number;
}

export class BomberMazeAutopilot {
    decide(observation: BomberMazeObservation): BomberMazeAction | null {
        if (observation.phase !== 'playing') {
            return null;
        }

        const danger = this.buildDangerMap(observation, null);
        const currentDanger = danger.get(this.key(observation.player));
        if (currentDanger !== undefined && currentDanger < 1.05) {
            const escape = this.findSafeDirection(observation, danger);
            return escape ? { kind: 'move', direction: escape } : null;
        }

        const enemyDistance = Math.min(
            ...observation.enemies.map((enemy) => this.manhattan(observation.player, enemy)),
            Number.POSITIVE_INFINITY,
        );
        const softAdjacent = DIRECTIONS.some((direction) => {
            const point = this.offset(observation.player, direction);
            return this.cellAt(observation, point) === 'soft-wall';
        });
        const enemyAdjacent = enemyDistance <= 2;

        if (
            observation.activeBombs < observation.bombCapacity
            && (softAdjacent || enemyAdjacent)
            && this.canEscapeAfterBomb(observation)
        ) {
            return { kind: 'bomb' };
        }

        const powerupDirection = this.findPathDirection(
            observation,
            (point) => observation.powerups.some((powerup) => this.same(point, powerup)),
            danger,
        );
        if (powerupDirection) {
            return { kind: 'move', direction: powerupDirection };
        }

        const attackDirection = this.findPathDirection(
            observation,
            (point) => (
                observation.enemies.some((enemy) => this.manhattan(point, enemy) <= 2)
                || DIRECTIONS.some((direction) => (
                    this.cellAt(observation, this.offset(point, direction)) === 'soft-wall'
                ))
            ),
            danger,
        );
        if (attackDirection) {
            return { kind: 'move', direction: attackDirection };
        }

        const safeDirection = this.bestLocalDirection(observation, danger);
        return safeDirection ? { kind: 'move', direction: safeDirection } : null;
    }

    private canEscapeAfterBomb(observation: BomberMazeObservation): boolean {
        const hypothetical: BomberMazeBombState = {
            x: observation.player.x,
            y: observation.player.y,
            fuse: 2.15,
            range: observation.blastRange,
        };
        const danger = this.buildDangerMap(observation, hypothetical);
        return this.findSafeDirection(observation, danger) !== null;
    }

    private findSafeDirection(
        observation: BomberMazeObservation,
        danger: ReadonlyMap<string, number>,
    ): BomberMazeDirection | null {
        const queue: SearchNode[] = [{
            ...observation.player,
            firstDirection: null,
            steps: 0,
        }];
        const visited = new Set<string>([this.key(observation.player)]);

        for (let cursor = 0; cursor < queue.length && cursor < 180; cursor += 1) {
            const node = queue[cursor];
            const arrival = node.steps * STEP_TIME;
            const dangerTime = danger.get(this.key(node));
            const safeAtArrival = dangerTime === undefined || arrival + SAFETY_MARGIN < dangerTime;
            const staysSafe = dangerTime === undefined || dangerTime > 2.45;
            if (node.steps > 0 && safeAtArrival && staysSafe && node.firstDirection) {
                return node.firstDirection;
            }

            for (const direction of DIRECTIONS) {
                const next = this.offset(node, direction);
                const key = this.key(next);
                if (visited.has(key) || !this.canTraverse(observation, next)) {
                    continue;
                }
                const nextSteps = node.steps + 1;
                const nextDanger = danger.get(key);
                if (
                    nextDanger !== undefined
                    && nextSteps * STEP_TIME + SAFETY_MARGIN >= nextDanger
                ) {
                    continue;
                }
                visited.add(key);
                queue.push({
                    ...next,
                    firstDirection: node.firstDirection ?? direction,
                    steps: nextSteps,
                });
            }
        }
        return null;
    }

    private findPathDirection(
        observation: BomberMazeObservation,
        isTarget: (point: BomberMazePoint) => boolean,
        danger: ReadonlyMap<string, number>,
    ): BomberMazeDirection | null {
        const queue: SearchNode[] = [{
            ...observation.player,
            firstDirection: null,
            steps: 0,
        }];
        const visited = new Set<string>([this.key(observation.player)]);

        for (let cursor = 0; cursor < queue.length && cursor < 220; cursor += 1) {
            const node = queue[cursor];
            if (node.steps > 0 && isTarget(node) && node.firstDirection) {
                return node.firstDirection;
            }
            for (const direction of DIRECTIONS) {
                const next = this.offset(node, direction);
                const key = this.key(next);
                if (visited.has(key) || !this.canTraverse(observation, next)) {
                    continue;
                }
                const arrival = (node.steps + 1) * STEP_TIME;
                const dangerTime = danger.get(key);
                if (dangerTime !== undefined && arrival + SAFETY_MARGIN >= dangerTime) {
                    continue;
                }
                if (observation.enemies.some((enemy) => this.same(enemy, next))) {
                    continue;
                }
                visited.add(key);
                queue.push({
                    ...next,
                    firstDirection: node.firstDirection ?? direction,
                    steps: node.steps + 1,
                });
            }
        }
        return null;
    }

    private bestLocalDirection(
        observation: BomberMazeObservation,
        danger: ReadonlyMap<string, number>,
    ): BomberMazeDirection | null {
        let best: BomberMazeDirection | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const direction of DIRECTIONS) {
            const point = this.offset(observation.player, direction);
            if (!this.canTraverse(observation, point)) {
                continue;
            }
            const dangerTime = danger.get(this.key(point));
            const nearestEnemy = Math.min(
                ...observation.enemies.map((enemy) => this.manhattan(point, enemy)),
                20,
            );
            const openNeighbors = DIRECTIONS.filter((candidate) => (
                this.canTraverse(observation, this.offset(point, candidate))
            )).length;
            const score = (dangerTime === undefined ? 80 : dangerTime * 12)
                + nearestEnemy * 4
                + openNeighbors * 7;
            if (score > bestScore) {
                bestScore = score;
                best = direction;
            }
        }
        return best;
    }

    private buildDangerMap(
        observation: BomberMazeObservation,
        hypothetical: BomberMazeBombState | null,
    ): Map<string, number> {
        const danger = new Map<string, number>();
        for (const explosion of observation.explosions) {
            danger.set(this.key(explosion), 0);
        }
        const bombs = hypothetical ? [...observation.bombs, hypothetical] : observation.bombs;
        for (const bomb of bombs) {
            for (const point of this.blastCells(observation, bomb)) {
                const key = this.key(point);
                const previous = danger.get(key);
                if (previous === undefined || bomb.fuse < previous) {
                    danger.set(key, bomb.fuse);
                }
            }
        }
        return danger;
    }

    private blastCells(
        observation: BomberMazeObservation,
        bomb: BomberMazeBombState,
    ): BomberMazePoint[] {
        const cells: BomberMazePoint[] = [{ x: bomb.x, y: bomb.y }];
        for (const direction of DIRECTIONS) {
            const [dx, dy] = OFFSETS[direction];
            for (let step = 1; step <= bomb.range; step += 1) {
                const point = { x: bomb.x + dx * step, y: bomb.y + dy * step };
                const kind = this.cellAt(observation, point);
                if (kind === 'hard-wall') {
                    break;
                }
                cells.push(point);
                if (kind === 'soft-wall') {
                    break;
                }
            }
        }
        return cells;
    }

    private canTraverse(
        observation: BomberMazeObservation,
        point: BomberMazePoint,
    ): boolean {
        return this.cellAt(observation, point) === 'floor'
            && !observation.bombs.some((candidate) => this.same(candidate, point));
    }

    private cellAt(
        observation: BomberMazeObservation,
        point: BomberMazePoint,
    ): BomberMazeCellKind {
        if (
            point.x < 0
            || point.x >= observation.width
            || point.y < 0
            || point.y >= observation.height
        ) {
            return 'hard-wall';
        }
        return observation.cells[point.y * observation.width + point.x] ?? 'hard-wall';
    }

    private offset(
        point: BomberMazePoint,
        direction: BomberMazeDirection,
    ): BomberMazePoint {
        const [dx, dy] = OFFSETS[direction];
        return { x: point.x + dx, y: point.y + dy };
    }

    private manhattan(left: BomberMazePoint, right: BomberMazePoint): number {
        return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
    }

    private same(left: BomberMazePoint, right: BomberMazePoint): boolean {
        return left.x === right.x && left.y === right.y;
    }

    private key(point: BomberMazePoint): string {
        return `${point.x}:${point.y}`;
    }
}
