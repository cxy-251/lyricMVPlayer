import type {
    BrickBreakerBallState,
    BrickBreakerBrickState,
    BrickBreakerObservation,
    BrickBreakerPowerupKind,
    BrickBreakerPowerupState,
} from './BrickBreakerTypes';
import type {
    MutableBrickBreakerBall,
    MutableBrickBreakerBrick,
    MutableBrickBreakerPaddle,
    MutableBrickBreakerPowerup,
} from './BrickBreakerDomain';
import { createBrickBreakerLevel } from './BrickBreakerLevel';
import { stepBrickBreakerBall } from './BrickBreakerPhysics';

const WORLD_HALF_WIDTH = 180;
const WORLD_HALF_HEIGHT = 280;
const PADDLE_Y = -236;
const PADDLE_BASE_WIDTH = 88;
const PADDLE_EXPANDED_WIDTH = 126;
const PADDLE_HEIGHT = 14;
const PADDLE_SPEED = 340;
const BALL_RADIUS = 7;
const BALL_BASE_SPEED = 252;
const BALL_MAXIMUM_SPEED = 390;
const MAXIMUM_BALLS = 5;
const POWERUP_FALL_SPEED = 92;
const POWERUP_CATCH_HALF_SIZE = 10;
const EXPAND_DURATION = 12;
const PIERCE_DURATION = 8;

export class BrickBreakerModel {
    readonly balls: MutableBrickBreakerBall[] = Array.from(
        { length: MAXIMUM_BALLS },
        () => ({
            active: false,
            x: 0,
            y: 0,
            velocityX: 0,
            velocityY: 0,
            radius: BALL_RADIUS,
        }),
    );
    readonly bricks: MutableBrickBreakerBrick[] = [];
    readonly powerups: MutableBrickBreakerPowerup[] = [];
    readonly paddle: MutableBrickBreakerPaddle = {
        x: 0,
        y: PADDLE_Y,
        width: PADDLE_BASE_WIDTH,
        height: PADDLE_HEIGHT,
    };

    private currentPhase: 'ready' | 'playing' | 'won' | 'lost' = 'ready';
    private currentLives = 3;
    private currentScore = 0;
    private currentLevel = 1;
    private paddleAxis = 0;
    private expandRemainingTime = 0;
    private pierceRemainingTime = 0;

    constructor() {
        this.reset();
    }

    get phase(): 'ready' | 'playing' | 'won' | 'lost' {
        return this.currentPhase;
    }

    get lives(): number {
        return this.currentLives;
    }

    get score(): number {
        return this.currentScore;
    }

    get level(): number {
        return this.currentLevel;
    }

    get worldHalfWidth(): number {
        return WORLD_HALF_WIDTH;
    }

    get worldHalfHeight(): number {
        return WORLD_HALF_HEIGHT;
    }

    get expandRemaining(): number {
        return this.expandRemainingTime;
    }

    get pierceRemaining(): number {
        return this.pierceRemainingTime;
    }

    setPaddleAxis(axis: number): void {
        this.paddleAxis = Math.max(-1, Math.min(1, axis));
    }

    reset(): void {
        this.currentLives = 3;
        this.currentScore = 0;
        this.currentLevel = 1;
        this.expandRemainingTime = 0;
        this.pierceRemainingTime = 0;
        this.paddle.x = 0;
        this.paddle.width = PADDLE_BASE_WIDTH;
        this.paddleAxis = 0;
        this.replaceLevel();
        this.resetRound();
    }

    launch(): boolean {
        if (this.currentPhase !== 'ready') {
            return false;
        }
        const ball = this.balls.find((candidate) => candidate.active)
            ?? this.attachSingleBall();
        const speed = this.levelBallSpeed();
        const direction = this.currentLevel % 2 === 0 ? -1 : 1;
        ball.velocityX = speed * 0.34 * direction;
        ball.velocityY = Math.sqrt(
            Math.max(1, speed * speed - ball.velocityX * ball.velocityX),
        );
        this.currentPhase = 'playing';
        return true;
    }

    advanceLevel(): boolean {
        if (this.currentPhase !== 'won') {
            return false;
        }
        this.currentLevel += 1;
        this.currentScore += 300 + this.currentLevel * 40;
        this.expandRemainingTime = 0;
        this.pierceRemainingTime = 0;
        this.paddle.width = PADDLE_BASE_WIDTH;
        this.paddle.x = 0;
        this.replaceLevel();
        this.resetRound();
        return true;
    }

    step(deltaTime: number): void {
        const dt = Math.max(0, Math.min(0.05, deltaTime));
        if (dt <= 0 || this.currentPhase === 'lost' || this.currentPhase === 'won') {
            return;
        }

        this.updateTimers(dt);
        this.updatePaddle(dt);
        if (this.currentPhase === 'ready') {
            this.attachBallsToPaddle();
            return;
        }

        this.updatePowerups(dt);
        for (const ball of this.balls) {
            if (!ball.active) {
                continue;
            }
            stepBrickBreakerBall({
                ball,
                deltaTime: dt,
                worldHalfWidth: WORLD_HALF_WIDTH,
                worldHalfHeight: WORLD_HALF_HEIGHT,
                paddle: this.paddle,
                bricks: this.bricks,
                piercing: this.pierceRemainingTime > 0,
                hitBrick: (brick, forceDestroy) => (
                    this.hitBrick(brick, forceDestroy)
                ),
            });
        }

        if (
            this.currentPhase === 'playing'
            && !this.balls.some((ball) => ball.active)
        ) {
            this.loseLife();
        }
    }

    createObservation(): BrickBreakerObservation {
        return {
            phase: this.currentPhase,
            worldHalfWidth: WORLD_HALF_WIDTH,
            paddle: { ...this.paddle },
            balls: this.createBallViewStates(),
            powerups: this.createPowerupViewStates(),
        };
    }

    createBallViewStates(): readonly BrickBreakerBallState[] {
        return this.balls.map((ball) => ({ ...ball }));
    }

    createBrickViewStates(): readonly BrickBreakerBrickState[] {
        return this.bricks.map((brick) => ({ ...brick }));
    }

    createPowerupViewStates(): readonly BrickBreakerPowerupState[] {
        return this.powerups
            .filter((powerup) => powerup.active)
            .map((powerup) => ({ ...powerup }));
    }

    private resetRound(): void {
        for (const ball of this.balls) {
            ball.active = false;
            ball.velocityX = 0;
            ball.velocityY = 0;
        }
        this.powerups.length = 0;
        this.currentPhase = 'ready';
        this.attachSingleBall();
    }

    private attachSingleBall(): MutableBrickBreakerBall {
        const ball = this.balls[0];
        ball.active = true;
        ball.radius = BALL_RADIUS;
        ball.velocityX = 0;
        ball.velocityY = 0;
        this.positionAttachedBall(ball, 0);
        return ball;
    }

    private attachBallsToPaddle(): void {
        let attachedIndex = 0;
        for (const ball of this.balls) {
            if (!ball.active) {
                continue;
            }
            this.positionAttachedBall(ball, attachedIndex);
            ball.velocityX = 0;
            ball.velocityY = 0;
            attachedIndex += 1;
        }
    }

    private positionAttachedBall(
        ball: MutableBrickBreakerBall,
        index: number,
    ): void {
        const offset = (index - 0.5) * BALL_RADIUS * 1.5;
        ball.x = this.clamp(
            this.paddle.x + offset,
            -WORLD_HALF_WIDTH + ball.radius,
            WORLD_HALF_WIDTH - ball.radius,
        );
        ball.y = this.paddle.y + this.paddle.height / 2 + ball.radius + 2;
    }

    private updatePaddle(dt: number): void {
        this.paddle.x += this.paddleAxis * PADDLE_SPEED * dt;
        const halfWidth = this.paddle.width / 2;
        this.paddle.x = this.clamp(
            this.paddle.x,
            -WORLD_HALF_WIDTH + halfWidth,
            WORLD_HALF_WIDTH - halfWidth,
        );
    }

    private updateTimers(dt: number): void {
        if (this.expandRemainingTime > 0) {
            this.expandRemainingTime = Math.max(0, this.expandRemainingTime - dt);
            if (this.expandRemainingTime === 0) {
                this.paddle.width = PADDLE_BASE_WIDTH;
                this.updatePaddle(0);
            }
        }
        if (this.pierceRemainingTime > 0) {
            this.pierceRemainingTime = Math.max(0, this.pierceRemainingTime - dt);
        }
    }

    private updatePowerups(dt: number): void {
        for (let index = this.powerups.length - 1; index >= 0; index -= 1) {
            const powerup = this.powerups[index];
            if (!powerup.active) {
                this.powerups.splice(index, 1);
                continue;
            }
            powerup.y += powerup.velocityY * dt;
            if (this.powerupTouchesPaddle(powerup)) {
                this.applyPowerup(powerup.kind);
                this.currentScore += 75;
                this.powerups.splice(index, 1);
            } else if (powerup.y < -WORLD_HALF_HEIGHT - 24) {
                this.powerups.splice(index, 1);
            }
        }
    }

    private powerupTouchesPaddle(
        powerup: MutableBrickBreakerPowerup,
    ): boolean {
        return Math.abs(powerup.x - this.paddle.x)
                <= this.paddle.width / 2 + POWERUP_CATCH_HALF_SIZE
            && Math.abs(powerup.y - this.paddle.y)
                <= this.paddle.height / 2 + POWERUP_CATCH_HALF_SIZE;
    }

    private applyPowerup(kind: BrickBreakerPowerupKind): void {
        if (kind === 'expand') {
            this.expandRemainingTime = EXPAND_DURATION;
            this.paddle.width = PADDLE_EXPANDED_WIDTH;
            this.updatePaddle(0);
            return;
        }
        if (kind === 'pierce') {
            this.pierceRemainingTime = PIERCE_DURATION;
            return;
        }
        this.spawnAdditionalBalls();
    }

    private spawnAdditionalBalls(): void {
        const source = this.balls.find((ball) => ball.active);
        if (!source) {
            return;
        }
        const speed = Math.max(
            BALL_BASE_SPEED,
            Math.hypot(source.velocityX, source.velocityY),
        );
        const sourceAngle = Math.atan2(source.velocityY, source.velocityX);
        for (const offset of [-0.32, 0.32]) {
            const target = this.balls.find((ball) => !ball.active);
            if (!target) {
                break;
            }
            target.active = true;
            target.x = source.x;
            target.y = source.y;
            target.radius = source.radius;
            target.velocityX = Math.cos(sourceAngle + offset) * speed;
            target.velocityY = Math.sin(sourceAngle + offset) * speed;
        }
    }

    private hitBrick(
        brick: MutableBrickBreakerBrick,
        forceDestroy: boolean,
    ): boolean {
        if (!brick.active) {
            return false;
        }
        if (brick.kind === 'solid') {
            this.currentScore += 2;
            return false;
        }
        brick.hitPoints = forceDestroy ? 0 : brick.hitPoints - 1;
        this.currentScore += brick.kind === 'strong' ? 18 : 12;
        if (brick.hitPoints > 0) {
            return false;
        }
        brick.active = false;
        this.currentScore += brick.kind === 'strong' ? 40 : 24;
        this.maybeSpawnPowerup(brick);
        if (
            this.bricks.some(
                (candidate) => candidate.active && candidate.kind !== 'solid',
            )
        ) {
            return false;
        }
        this.currentPhase = 'won';
        for (const ball of this.balls) {
            ball.active = false;
        }
        return true;
    }

    private maybeSpawnPowerup(brick: MutableBrickBreakerBrick): void {
        if ((brick.id + this.currentLevel * 3) % 10 !== 0) {
            return;
        }
        const kinds: readonly BrickBreakerPowerupKind[] = [
            'expand',
            'multiball',
            'pierce',
        ];
        this.powerups.push({
            active: true,
            kind: kinds[(brick.id + this.currentLevel) % kinds.length],
            x: brick.x,
            y: brick.y,
            velocityY: -POWERUP_FALL_SPEED,
        });
    }

    private loseLife(): void {
        this.currentLives -= 1;
        this.expandRemainingTime = 0;
        this.pierceRemainingTime = 0;
        this.paddle.width = PADDLE_BASE_WIDTH;
        this.paddle.x = 0;
        this.powerups.length = 0;
        if (this.currentLives <= 0) {
            this.currentLives = 0;
            this.currentPhase = 'lost';
            return;
        }
        this.resetRound();
    }

    private replaceLevel(): void {
        this.bricks.splice(
            0,
            this.bricks.length,
            ...createBrickBreakerLevel(this.currentLevel, WORLD_HALF_WIDTH),
        );
    }

    private levelBallSpeed(): number {
        return Math.min(
            BALL_MAXIMUM_SPEED,
            BALL_BASE_SPEED + (this.currentLevel - 1) * 12,
        );
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
