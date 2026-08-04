import {
    XorShift32Random,
    type RandomSource,
} from '../shared/RandomSource';
import type {
    SnakeDirection,
    SnakeObservation,
    SnakePoint,
} from './SnakeTypes';

const WIDTH = 20;
const HEIGHT = 14;
const START_LENGTH = 4;
const START_INTERVAL = 0.19;
const MINIMUM_INTERVAL = 0.07;
const SPEED_GAIN = 0.0045;
const FOODS_PER_STAGE = 5;
const OBSTACLES_PER_STAGE = 2;
const MAXIMUM_OBSTACLES = 18;
const BONUS_FOOD_CYCLE = 5;
const RESET_SALT = 0x9e3779b9;

const OFFSETS: Record<SnakeDirection, readonly [number, number]> = {
    up: [0, 1],
    down: [0, -1],
    left: [-1, 0],
    right: [1, 0],
};

export class SnakeModel {
    private body: SnakePoint[] = [];
    private foodPoint: SnakePoint = { x: 0, y: 0 };
    private obstacles: SnakePoint[] = [];
    private currentFoodValue: 1 | 3 = 1;
    private currentDirection: SnakeDirection = 'right';
    private requestedDirection: SnakeDirection = 'right';
    private currentPhase: 'playing' | 'won' | 'lost' = 'playing';
    private currentScore = 0;
    private foodsEaten = 0;
    private accumulator = 0;

    constructor(
        private readonly randomSource: RandomSource = new XorShift32Random(0x75d3ac41),
    ) {
        this.reset();
    }

    get width(): number {
        return WIDTH;
    }

    get height(): number {
        return HEIGHT;
    }

    get phase(): 'playing' | 'won' | 'lost' {
        return this.currentPhase;
    }

    get score(): number {
        return this.currentScore;
    }

    get stage(): number {
        return 1 + Math.floor(this.foodsEaten / FOODS_PER_STAGE);
    }

    get speed(): number {
        return 1 / this.stepInterval();
    }

    reset(): void {
        this.body.length = 0;
        const centerX = Math.floor(WIDTH / 2);
        const centerY = Math.floor(HEIGHT / 2);
        for (let index = 0; index < START_LENGTH; index += 1) {
            this.body.push({ x: centerX - index, y: centerY });
        }
        this.obstacles = [];
        this.currentFoodValue = 1;
        this.currentDirection = 'right';
        this.requestedDirection = 'right';
        this.currentPhase = 'playing';
        this.currentScore = 0;
        this.foodsEaten = 0;
        this.accumulator = 0;
        this.randomSource.reset(
            XorShift32Random.mix(this.randomSource.snapshot() ^ RESET_SALT),
        );
        this.spawnFood();
    }

    setDirection(direction: SnakeDirection): boolean {
        if (this.currentPhase !== 'playing' || this.isOpposite(direction, this.currentDirection)) {
            return false;
        }
        this.requestedDirection = direction;
        return true;
    }

    step(deltaTime: number): number {
        if (this.currentPhase !== 'playing') {
            return 0;
        }
        this.accumulator += Math.max(0, Math.min(0.1, deltaTime));
        let moved = 0;
        const interval = this.stepInterval();
        while (this.accumulator >= interval && moved < 4) {
            this.accumulator -= interval;
            this.advanceOneCell();
            moved += 1;
            if (this.currentPhase !== 'playing') {
                break;
            }
        }
        return moved;
    }

    createObservation(): SnakeObservation {
        return {
            width: WIDTH,
            height: HEIGHT,
            snake: this.body.map((point) => ({ ...point })),
            food: { ...this.foodPoint },
            foodValue: this.currentFoodValue,
            obstacles: this.obstacles.map((point) => ({ ...point })),
            direction: this.currentDirection,
            foodsEaten: this.foodsEaten,
            stage: this.stage,
            phase: this.currentPhase,
        };
    }

    private advanceOneCell(): void {
        if (!this.isOpposite(this.requestedDirection, this.currentDirection)) {
            this.currentDirection = this.requestedDirection;
        }
        const [offsetX, offsetY] = OFFSETS[this.currentDirection];
        const head = this.body[0];
        const next = { x: head.x + offsetX, y: head.y + offsetY };
        const eating = next.x === this.foodPoint.x && next.y === this.foodPoint.y;
        const collisionLength = eating ? this.body.length : this.body.length - 1;
        if (
            next.x < 0
            || next.x >= WIDTH
            || next.y < 0
            || next.y >= HEIGHT
            || this.hasObstacle(next.x, next.y)
            || this.body.slice(0, collisionLength).some(
                (point) => point.x === next.x && point.y === next.y,
            )
        ) {
            this.currentPhase = 'lost';
            return;
        }

        this.body.unshift(next);
        if (eating) {
            this.currentScore += this.currentFoodValue;
            this.foodsEaten += 1;
            this.ensureStageObstacles();
            this.spawnFood();
        } else {
            this.body.pop();
        }
    }

    private ensureStageObstacles(): void {
        const target = Math.min(
            MAXIMUM_OBSTACLES,
            Math.max(0, this.stage - 1) * OBSTACLES_PER_STAGE,
        );
        if (this.obstacles.length >= target) {
            return;
        }

        const head = this.body[0];
        const occupied = new Set(this.body.map((point) => this.key(point.x, point.y)));
        for (const point of this.obstacles) {
            occupied.add(this.key(point.x, point.y));
        }
        const candidates: SnakePoint[] = [];
        for (let y = 1; y < HEIGHT - 1; y += 1) {
            for (let x = 1; x < WIDTH - 1; x += 1) {
                const key = this.key(x, y);
                const headDistance = Math.abs(x - head.x) + Math.abs(y - head.y);
                if (occupied.has(key) || headDistance <= 3) {
                    continue;
                }
                const openNeighbors = Object.values(OFFSETS).filter(([dx, dy]) => (
                    !occupied.has(this.key(x + dx, y + dy))
                )).length;
                if (openNeighbors >= 3) {
                    candidates.push({ x, y });
                }
            }
        }
        for (let index = candidates.length - 1; index > 0; index -= 1) {
            const swapIndex = this.randomSource.nextInt(index + 1);
            [candidates[index], candidates[swapIndex]] = [
                candidates[swapIndex],
                candidates[index],
            ];
        }
        while (this.obstacles.length < target && candidates.length > 0) {
            const candidate = candidates.pop();
            if (candidate) {
                this.obstacles.push(candidate);
            }
        }
    }

    private spawnFood(): void {
        const occupied = new Set(this.body.map((point) => this.key(point.x, point.y)));
        for (const point of this.obstacles) {
            occupied.add(this.key(point.x, point.y));
        }
        const empty: SnakePoint[] = [];
        for (let y = 0; y < HEIGHT; y += 1) {
            for (let x = 0; x < WIDTH; x += 1) {
                if (!occupied.has(this.key(x, y))) {
                    empty.push({ x, y });
                }
            }
        }
        if (empty.length === 0) {
            this.foodPoint = { x: -1, y: -1 };
            this.currentPhase = 'won';
            return;
        }
        this.currentFoodValue = (this.foodsEaten + 1) % BONUS_FOOD_CYCLE === 0 ? 3 : 1;
        this.foodPoint = empty[this.randomSource.nextInt(empty.length)];
    }

    private stepInterval(): number {
        const obstaclePressure = Math.max(0, this.stage - 1) * 0.002;
        return Math.max(
            MINIMUM_INTERVAL,
            START_INTERVAL - this.foodsEaten * SPEED_GAIN - obstaclePressure,
        );
    }

    private hasObstacle(x: number, y: number): boolean {
        return this.obstacles.some((point) => point.x === x && point.y === y);
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
