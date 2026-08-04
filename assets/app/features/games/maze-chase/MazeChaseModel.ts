import type {
    MazeChaseDirection,
    MazeChaseEnemyKind,
    MazeChaseEnemyState,
    MazeChaseObservation,
    MazeChasePhase,
    MazeChasePoint,
} from './MazeChaseTypes';

const MAP = [
    '#################',
    '#.......#.......#',
    '#.###.#.#.#.###.#',
    '#.....#...#.....#',
    '###.#.#####.#.###',
    '#...#...A...#...#',
    '#.#.###.#.###.#.#',
    '#.#.....@.....#.#',
    '#.#.###.#.###.#.#',
    '#...#..B.C..#...#',
    '###.#.#####.#.###',
    '#.......#.......#',
    '#################',
] as const;

const DIRECTIONS: readonly MazeChaseDirection[] = ['up', 'left', 'down', 'right'];
const OFFSETS: Record<MazeChaseDirection, readonly [number, number]> = {
    up: [0, 1],
    down: [0, -1],
    left: [-1, 0],
    right: [1, 0],
};
const PLAYER_INTERVAL = 0.115;
const ENEMY_INTERVAL = 0.155;

interface MutableEnemy {
    x: number;
    y: number;
    startX: number;
    startY: number;
    kind: MazeChaseEnemyKind;
    direction: MazeChaseDirection;
}

export class MazeChaseModel {
    readonly width = MAP[0].length;
    readonly height = MAP.length;

    private readonly walls: boolean[] = [];
    private readonly initialPellets: boolean[] = [];
    private pellets: boolean[] = [];
    private player = { x: 0, y: 0 };
    private playerStart = { x: 0, y: 0 };
    private direction: MazeChaseDirection = 'left';
    private desiredDirection: MazeChaseDirection = 'left';
    private enemies: MutableEnemy[] = [];
    private currentPhase: MazeChasePhase = 'playing';
    private currentScore = 0;
    private currentLives = 3;
    private playerElapsed = 0;
    private enemyElapsed = 0;
    private invulnerableElapsed = 0;
    private patrolPhase = 0;

    constructor() {
        this.parseMap();
        this.reset();
    }

    get phase(): MazeChasePhase {
        return this.currentPhase;
    }

    get score(): number {
        return this.currentScore;
    }

    get lives(): number {
        return this.currentLives;
    }

    get remainingPellets(): number {
        return this.pellets.filter(Boolean).length;
    }

    reset(): void {
        this.pellets = [...this.initialPellets];
        this.currentPhase = 'playing';
        this.currentScore = 0;
        this.currentLives = 3;
        this.playerElapsed = 0;
        this.enemyElapsed = 0;
        this.invulnerableElapsed = 0;
        this.patrolPhase = 0;
        this.resetActors();
        this.consumePellet();
    }

    setDesiredDirection(direction: MazeChaseDirection): void {
        if (this.currentPhase !== 'playing') {
            return;
        }
        this.desiredDirection = direction;
    }

    step(deltaTime: number): boolean {
        if (this.currentPhase !== 'playing') {
            return false;
        }
        const dt = Math.max(0, Math.min(0.1, deltaTime));
        if (dt <= 0) {
            return false;
        }

        this.playerElapsed += dt;
        this.enemyElapsed += dt;
        this.invulnerableElapsed = Math.max(0, this.invulnerableElapsed - dt);
        this.patrolPhase += dt;
        let changed = false;

        while (this.playerElapsed >= PLAYER_INTERVAL) {
            this.playerElapsed -= PLAYER_INTERVAL;
            changed = this.movePlayer() || changed;
            if (this.currentPhase !== 'playing') {
                return true;
            }
        }

        while (this.enemyElapsed >= ENEMY_INTERVAL) {
            this.enemyElapsed -= ENEMY_INTERVAL;
            changed = this.moveEnemies() || changed;
            if (this.resolveCollision()) {
                changed = true;
            }
            if (this.currentPhase !== 'playing') {
                return true;
            }
        }
        return changed;
    }

    createObservation(): MazeChaseObservation {
        return {
            width: this.width,
            height: this.height,
            walls: [...this.walls],
            pellets: [...this.pellets],
            player: { ...this.player },
            direction: this.direction,
            enemies: this.enemies.map((enemy): MazeChaseEnemyState => ({
                x: enemy.x,
                y: enemy.y,
                kind: enemy.kind,
                direction: enemy.direction,
            })),
            phase: this.currentPhase,
        };
    }

    private parseMap(): void {
        this.walls.length = 0;
        this.initialPellets.length = 0;
        this.enemies.length = 0;
        for (let mapRow = MAP.length - 1; mapRow >= 0; mapRow -= 1) {
            const y = MAP.length - 1 - mapRow;
            const row = MAP[mapRow];
            if (row.length !== this.width) {
                throw new Error('Maze Chase map rows must have equal width.');
            }
            for (let x = 0; x < row.length; x += 1) {
                const symbol = row[x];
                this.walls.push(symbol === '#');
                this.initialPellets.push(symbol === '.');
                if (symbol === '@') {
                    this.playerStart = { x, y };
                } else if (symbol === 'A' || symbol === 'B' || symbol === 'C') {
                    const kind: MazeChaseEnemyKind = symbol === 'A'
                        ? 'chaser'
                        : symbol === 'B'
                            ? 'ambusher'
                            : 'patroller';
                    this.enemies.push({
                        x,
                        y,
                        startX: x,
                        startY: y,
                        kind,
                        direction: symbol === 'B' ? 'right' : 'left',
                    });
                }
            }
        }
    }

    private resetActors(): void {
        this.player = { ...this.playerStart };
        this.direction = 'left';
        this.desiredDirection = 'left';
        for (const enemy of this.enemies) {
            enemy.x = enemy.startX;
            enemy.y = enemy.startY;
            enemy.direction = enemy.kind === 'ambusher' ? 'right' : 'left';
        }
    }

    private movePlayer(): boolean {
        if (this.canMove(this.player, this.desiredDirection)) {
            this.direction = this.desiredDirection;
        }
        if (!this.canMove(this.player, this.direction)) {
            return false;
        }
        this.player = this.offset(this.player, this.direction);
        this.consumePellet();
        if (this.currentPhase === 'playing') {
            this.resolveCollision();
        }
        return true;
    }

    private consumePellet(): void {
        const index = this.index(this.player.x, this.player.y);
        if (!this.pellets[index]) {
            return;
        }
        this.pellets[index] = false;
        this.currentScore += 10;
        if (this.remainingPellets === 0) {
            this.currentPhase = 'won';
            this.currentScore += 500;
            this.playerElapsed = 0;
            this.enemyElapsed = 0;
        }
    }

    private moveEnemies(): boolean {
        let moved = false;
        for (const enemy of this.enemies) {
            const target = this.enemyTarget(enemy.kind);
            const nextDirection = this.chooseEnemyDirection(enemy, target);
            if (!nextDirection) {
                continue;
            }
            enemy.direction = nextDirection;
            const next = this.offset(enemy, nextDirection);
            if (!this.inside(next) || this.walls[this.index(next.x, next.y)]) {
                continue;
            }
            enemy.x = next.x;
            enemy.y = next.y;
            moved = true;
        }
        return moved;
    }

    private enemyTarget(kind: MazeChaseEnemyKind): MazeChasePoint {
        if (kind === 'chaser') {
            return this.player;
        }
        if (kind === 'ambusher') {
            const [dx, dy] = OFFSETS[this.direction];
            return {
                x: Math.max(1, Math.min(this.width - 2, this.player.x + dx * 3)),
                y: Math.max(1, Math.min(this.height - 2, this.player.y + dy * 3)),
            };
        }
        const corners = [
            { x: 1, y: 1 },
            { x: this.width - 2, y: this.height - 2 },
            { x: this.width - 2, y: 1 },
            { x: 1, y: this.height - 2 },
        ];
        return corners[Math.floor(this.patrolPhase / 4) % corners.length];
    }

    private chooseEnemyDirection(
        enemy: MutableEnemy,
        target: MazeChasePoint,
    ): MazeChaseDirection | null {
        const reverse = this.opposite(enemy.direction);
        const legal = DIRECTIONS.filter((direction) => this.canMove(enemy, direction));
        if (legal.length === 0) {
            return null;
        }
        const candidates = legal.length > 1
            ? legal.filter((direction) => direction !== reverse)
            : legal;
        let best = candidates[0] ?? legal[0];
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const direction of candidates) {
            const next = this.offset(enemy, direction);
            const distance = this.shortestDistance(next, target);
            if (distance >= 0 && distance < bestDistance) {
                bestDistance = distance;
                best = direction;
            }
        }
        return best;
    }

    private resolveCollision(): boolean {
        if (this.invulnerableElapsed > 0 || this.currentPhase !== 'playing') {
            return false;
        }
        const hit = this.enemies.some((enemy) => (
            enemy.x === this.player.x && enemy.y === this.player.y
        ));
        if (!hit) {
            return false;
        }

        this.currentLives = Math.max(0, this.currentLives - 1);
        this.playerElapsed = 0;
        this.enemyElapsed = 0;
        this.resetActors();
        if (this.currentLives === 0) {
            this.currentPhase = 'lost';
            this.invulnerableElapsed = 0;
        } else {
            this.invulnerableElapsed = 1;
        }
        return true;
    }

    private shortestDistance(start: MazeChasePoint, target: MazeChasePoint): number {
        if (
            !this.inside(start)
            || !this.inside(target)
            || this.walls[this.index(start.x, start.y)]
        ) {
            return -1;
        }
        const queue: MazeChasePoint[] = [start];
        const distances = new Array<number>(this.width * this.height).fill(-1);
        distances[this.index(start.x, start.y)] = 0;
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const point = queue[cursor];
            const distance = distances[this.index(point.x, point.y)];
            if (point.x === target.x && point.y === target.y) {
                return distance;
            }
            for (const direction of DIRECTIONS) {
                const next = this.offset(point, direction);
                if (!this.inside(next)) {
                    continue;
                }
                const index = this.index(next.x, next.y);
                if (!this.walls[index] && distances[index] < 0) {
                    distances[index] = distance + 1;
                    queue.push(next);
                }
            }
        }
        return -1;
    }

    private canMove(point: MazeChasePoint, direction: MazeChaseDirection): boolean {
        const next = this.offset(point, direction);
        return this.inside(next) && !this.walls[this.index(next.x, next.y)];
    }

    private offset(point: MazeChasePoint, direction: MazeChaseDirection): MazeChasePoint {
        const [dx, dy] = OFFSETS[direction];
        return { x: point.x + dx, y: point.y + dy };
    }

    private inside(point: MazeChasePoint): boolean {
        return point.x >= 0 && point.x < this.width && point.y >= 0 && point.y < this.height;
    }

    private index(x: number, y: number): number {
        return y * this.width + x;
    }

    private opposite(direction: MazeChaseDirection): MazeChaseDirection {
        return direction === 'up'
            ? 'down'
            : direction === 'down'
                ? 'up'
                : direction === 'left'
                    ? 'right'
                    : 'left';
    }
}
