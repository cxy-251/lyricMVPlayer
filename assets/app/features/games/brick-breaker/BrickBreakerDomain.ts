import type {
    BrickBreakerBrickKind,
    BrickBreakerPowerupKind,
} from './BrickBreakerTypes';

export interface MutableBrickBreakerBall {
    active: boolean;
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    radius: number;
}

export interface MutableBrickBreakerPaddle {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface MutableBrickBreakerBrick {
    id: number;
    active: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    hitPoints: number;
    maximumHitPoints: number;
    kind: BrickBreakerBrickKind;
}

export interface MutableBrickBreakerPowerup {
    active: boolean;
    kind: BrickBreakerPowerupKind;
    x: number;
    y: number;
    velocityY: number;
}
