import type {
    MutableBrickBreakerBall,
    MutableBrickBreakerBrick,
    MutableBrickBreakerPaddle,
} from './BrickBreakerDomain';

const MAXIMUM_COLLISIONS_PER_STEP = 7;
const COLLISION_EPSILON = 0.035;
const BALL_BASE_SPEED = 252;
const BALL_MAXIMUM_SPEED = 390;

interface SweepHit {
    readonly time: number;
    readonly normalX: number;
    readonly normalY: number;
    readonly kind: 'wall' | 'bottom' | 'paddle' | 'brick';
    readonly brickIndex?: number;
}

export interface BrickBreakerBallStepOptions {
    readonly ball: MutableBrickBreakerBall;
    readonly deltaTime: number;
    readonly worldHalfWidth: number;
    readonly worldHalfHeight: number;
    readonly paddle: MutableBrickBreakerPaddle;
    readonly bricks: readonly MutableBrickBreakerBrick[];
    readonly piercing: boolean;
    readonly hitBrick: (
        brick: MutableBrickBreakerBrick,
        forceDestroy: boolean,
    ) => boolean;
}

export function stepBrickBreakerBall(options: BrickBreakerBallStepOptions): void {
    const {
        ball,
        worldHalfWidth,
        worldHalfHeight,
        paddle,
        bricks,
    } = options;
    let remaining = options.deltaTime;

    for (
        let collisionIndex = 0;
        collisionIndex < MAXIMUM_COLLISIONS_PER_STEP && remaining > 0.00001;
        collisionIndex += 1
    ) {
        const hit = findEarliestHit(
            ball,
            remaining,
            worldHalfWidth,
            worldHalfHeight,
            paddle,
            bricks,
        );
        if (!hit) {
            ball.x += ball.velocityX * remaining;
            ball.y += ball.velocityY * remaining;
            return;
        }

        const travelTime = remaining * hit.time;
        ball.x += ball.velocityX * travelTime;
        ball.y += ball.velocityY * travelTime;
        remaining *= Math.max(0, 1 - hit.time);

        if (hit.kind === 'bottom') {
            ball.active = false;
            return;
        }

        let shouldReflect = true;
        if (hit.kind === 'brick' && hit.brickIndex !== undefined) {
            const brick = bricks[hit.brickIndex];
            const piercing = options.piercing && brick.kind !== 'solid';
            const stop = options.hitBrick(brick, piercing);
            if (stop) {
                return;
            }
            shouldReflect = !piercing;
        }

        if (hit.kind === 'paddle') {
            reflectFromPaddle(ball, paddle);
        } else if (shouldReflect) {
            reflectVelocity(ball, hit.normalX, hit.normalY);
        }

        if (!shouldReflect) {
            const speed = Math.max(1, Math.hypot(ball.velocityX, ball.velocityY));
            ball.x += ball.velocityX / speed * COLLISION_EPSILON;
            ball.y += ball.velocityY / speed * COLLISION_EPSILON;
        } else {
            ball.x += hit.normalX * COLLISION_EPSILON;
            ball.y += hit.normalY * COLLISION_EPSILON;
        }
    }

    if (remaining > 0) {
        ball.x += ball.velocityX * remaining;
        ball.y += ball.velocityY * remaining;
    }
}

function findEarliestHit(
    ball: MutableBrickBreakerBall,
    deltaTime: number,
    worldHalfWidth: number,
    worldHalfHeight: number,
    paddle: MutableBrickBreakerPaddle,
    bricks: readonly MutableBrickBreakerBrick[],
): SweepHit | null {
    const deltaX = ball.velocityX * deltaTime;
    const deltaY = ball.velocityY * deltaTime;
    let best: SweepHit | null = null;

    const consider = (candidate: SweepHit | null): void => {
        if (
            candidate
            && candidate.time >= 0
            && candidate.time <= 1
            && (!best || candidate.time < best.time - 0.000001)
        ) {
            best = candidate;
        }
    };

    if (deltaX < 0) {
        consider({
            time: (-worldHalfWidth + ball.radius - ball.x) / deltaX,
            normalX: 1,
            normalY: 0,
            kind: 'wall',
        });
    } else if (deltaX > 0) {
        consider({
            time: (worldHalfWidth - ball.radius - ball.x) / deltaX,
            normalX: -1,
            normalY: 0,
            kind: 'wall',
        });
    }
    if (deltaY > 0) {
        consider({
            time: (worldHalfHeight - ball.radius - ball.y) / deltaY,
            normalX: 0,
            normalY: -1,
            kind: 'wall',
        });
    } else if (deltaY < 0) {
        consider({
            time: (-worldHalfHeight + ball.radius - ball.y) / deltaY,
            normalX: 0,
            normalY: 1,
            kind: 'bottom',
        });
    }

    if (deltaY < 0 && ball.y >= paddle.y) {
        consider(sweepPointAgainstBox(
            ball.x,
            ball.y,
            deltaX,
            deltaY,
            paddle.x - paddle.width / 2 - ball.radius,
            paddle.x + paddle.width / 2 + ball.radius,
            paddle.y - paddle.height / 2 - ball.radius,
            paddle.y + paddle.height / 2 + ball.radius,
            'paddle',
        ));
    }

    for (let index = 0; index < bricks.length; index += 1) {
        const brick = bricks[index];
        if (!brick.active) {
            continue;
        }
        const candidate = sweepPointAgainstBox(
            ball.x,
            ball.y,
            deltaX,
            deltaY,
            brick.x - brick.width / 2 - ball.radius,
            brick.x + brick.width / 2 + ball.radius,
            brick.y - brick.height / 2 - ball.radius,
            brick.y + brick.height / 2 + ball.radius,
            'brick',
        );
        if (candidate) {
            consider({ ...candidate, brickIndex: index });
        }
    }

    return best;
}

function sweepPointAgainstBox(
    originX: number,
    originY: number,
    deltaX: number,
    deltaY: number,
    left: number,
    right: number,
    bottom: number,
    top: number,
    kind: 'paddle' | 'brick',
): SweepHit | null {
    let enter = 0;
    let exit = 1;
    let normalX = 0;
    let normalY = 0;

    const solveAxis = (
        origin: number,
        delta: number,
        minimum: number,
        maximum: number,
        axisX: number,
        axisY: number,
    ): boolean => {
        if (Math.abs(delta) < 0.0000001) {
            return origin >= minimum && origin <= maximum;
        }
        let first = (minimum - origin) / delta;
        let second = (maximum - origin) / delta;
        let entryNormalX = -axisX;
        let entryNormalY = -axisY;
        if (first > second) {
            [first, second] = [second, first];
            entryNormalX = axisX;
            entryNormalY = axisY;
        }
        if (first > enter) {
            enter = first;
            normalX = entryNormalX;
            normalY = entryNormalY;
        }
        exit = Math.min(exit, second);
        return enter <= exit;
    };

    if (!solveAxis(originX, deltaX, left, right, 1, 0)) {
        return null;
    }
    if (!solveAxis(originY, deltaY, bottom, top, 0, 1)) {
        return null;
    }
    if (enter < 0 || enter > 1 || exit < 0) {
        return null;
    }
    return {
        time: enter,
        normalX,
        normalY,
        kind,
    };
}

function reflectFromPaddle(
    ball: MutableBrickBreakerBall,
    paddle: MutableBrickBreakerPaddle,
): void {
    const speed = clamp(
        Math.hypot(ball.velocityX, ball.velocityY) * 1.008,
        BALL_BASE_SPEED,
        BALL_MAXIMUM_SPEED,
    );
    const normalized = clamp(
        (ball.x - paddle.x) / Math.max(1, paddle.width / 2),
        -1,
        1,
    );
    const angleFromVertical = normalized * 1.08;
    ball.velocityX = Math.sin(angleFromVertical) * speed;
    ball.velocityY = Math.max(72, Math.cos(angleFromVertical) * speed);
}

function reflectVelocity(
    ball: MutableBrickBreakerBall,
    normalX: number,
    normalY: number,
): void {
    const dot = ball.velocityX * normalX + ball.velocityY * normalY;
    ball.velocityX -= 2 * dot * normalX;
    ball.velocityY -= 2 * dot * normalY;
    const speed = clamp(
        Math.hypot(ball.velocityX, ball.velocityY),
        BALL_BASE_SPEED,
        BALL_MAXIMUM_SPEED,
    );
    const length = Math.max(0.0001, Math.hypot(ball.velocityX, ball.velocityY));
    ball.velocityX = ball.velocityX / length * speed;
    ball.velocityY = ball.velocityY / length * speed;
    if (Math.abs(ball.velocityY) < 58) {
        const verticalSign = ball.velocityY >= 0 ? 1 : -1;
        ball.velocityY = verticalSign * 58;
        const horizontalSign = ball.velocityX >= 0 ? 1 : -1;
        ball.velocityX = horizontalSign * Math.sqrt(
            Math.max(1, speed * speed - ball.velocityY * ball.velocityY),
        );
    }
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
}
