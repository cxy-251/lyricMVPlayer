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
    private currentDirection: SnakeDirection = 'right';
    private requestedDirection: SnakeDirection = 'right';
    private currentPhase: 'playing' | 'won' | 'lost' = 'playing';
    private currentScore = 0;
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
        this.currentDirection = 'right';
        this.requestedDirection = 'right';
        this.currentPhase = 'playing';
        this.currentScore = 0;
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
            direction: this.currentDirection,
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
            || this.body.slice(0, collisionLength).some(
                (point) => point.x === next.x && point.y === next.y,
            )
        ) {
            this.currentPhase = 'lost';
            return;
        }

        this.body.unshift(next);
        if (eating) {
            this.currentScore += 1;
            this.spawnFood();
        } else {
            this.body.pop();
        }
    }

    private spawnFood(): void {
        const occupied = new Set(this.body.map((point) => this.key(point.x, point.y)));
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
        this.foodPoint = empty[this.randomSource.nextInt(empty.length)];
    }

    private stepInterval(): number {
        return Math.max(MINIMUM_INTERVAL, START_INTERVAL - this.currentScore * SPEED_GAIN);
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
