import type {
    BrickBreakerControl,
    BrickBreakerObservation,
} from './BrickBreakerTypes';

export class BrickBreakerAutopilot {
    private filteredTargetX = 0;

    reset(): void {
        this.filteredTargetX = 0;
    }

    decide(observation: BrickBreakerObservation): BrickBreakerControl {
        if (observation.phase === 'ready') {
            return { axis: 0, launch: true };
        }
        if (observation.phase !== 'playing') {
            return { axis: 0, launch: false };
        }

        const paddle = observation.paddle;
        const downward = observation.balls
            .filter((ball) => ball.active && ball.velocityY < -0.001)
            .map((ball) => {
                const targetY = paddle.y + paddle.height / 2 + ball.radius;
                const time = (targetY - ball.y) / ball.velocityY;
                return {
                    ball,
                    time,
                    x: this.foldIntoWorld(
                        ball.x + ball.velocityX * time,
                        observation.worldHalfWidth - ball.radius,
                    ),
                };
            })
            .filter((prediction) => prediction.time >= 0)
            .sort((left, right) => left.time - right.time);

        let targetX = paddle.x;
        const urgent = downward[0];
        if (urgent) {
            targetX = urgent.x;
        } else {
            const activeBalls = observation.balls.filter((ball) => ball.active);
            if (activeBalls.length > 0) {
                targetX = activeBalls.reduce((sum, ball) => sum + ball.x, 0)
                    / activeBalls.length;
            }
        }

        const safeToCollect = !urgent || urgent.time > 0.82;
        if (safeToCollect && observation.powerups.length > 0) {
            const catchable = [...observation.powerups]
                .filter((powerup) => powerup.active && powerup.y > paddle.y)
                .sort((left, right) => left.y - right.y)[0];
            if (catchable) {
                targetX = catchable.x;
            }
        }

        const blend = urgent && urgent.time < 0.34 ? 0.72 : 0.34;
        this.filteredTargetX += (targetX - this.filteredTargetX) * blend;
        const error = this.filteredTargetX - paddle.x;
        const deadZone = urgent && urgent.time < 0.24 ? 1.2 : 3.5;
        return {
            axis: Math.abs(error) <= deadZone
                ? 0
                : Math.max(-1, Math.min(1, error / 34)),
            launch: false,
        };
    }

    private foldIntoWorld(value: number, halfExtent: number): number {
        const span = halfExtent * 2;
        if (span <= 0) {
            return 0;
        }
        let folded = (value + halfExtent) % (span * 2);
        if (folded < 0) {
            folded += span * 2;
        }
        if (folded > span) {
            folded = span * 2 - folded;
        }
        return folded - halfExtent;
    }
}
