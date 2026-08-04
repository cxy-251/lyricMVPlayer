export type BrickBreakerPhase = 'ready' | 'playing' | 'paused' | 'won' | 'lost';
export type BrickBreakerControllerMode = 'human' | 'autopilot';
export type BrickBreakerBrickKind = 'normal' | 'strong' | 'solid';
export type BrickBreakerPowerupKind = 'expand' | 'multiball' | 'pierce';

export interface BrickBreakerBallState {
    readonly active: boolean;
    readonly x: number;
    readonly y: number;
    readonly velocityX: number;
    readonly velocityY: number;
    readonly radius: number;
}

export interface BrickBreakerPaddleState {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export interface BrickBreakerBrickState {
    readonly id: number;
    readonly active: boolean;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly hitPoints: number;
    readonly maximumHitPoints: number;
    readonly kind: BrickBreakerBrickKind;
}

export interface BrickBreakerPowerupState {
    readonly active: boolean;
    readonly kind: BrickBreakerPowerupKind;
    readonly x: number;
    readonly y: number;
    readonly velocityY: number;
}

export interface BrickBreakerObservation {
    readonly phase: BrickBreakerPhase;
    readonly worldHalfWidth: number;
    readonly paddle: BrickBreakerPaddleState;
    readonly balls: readonly BrickBreakerBallState[];
    readonly powerups: readonly BrickBreakerPowerupState[];
}

export interface BrickBreakerControl {
    readonly axis: number;
    readonly launch: boolean;
}

export interface BrickBreakerViewState {
    readonly phase: BrickBreakerPhase;
    readonly controller: BrickBreakerControllerMode;
    readonly worldHalfWidth: number;
    readonly worldHalfHeight: number;
    readonly paddle: BrickBreakerPaddleState;
    readonly balls: readonly BrickBreakerBallState[];
    readonly bricks: readonly BrickBreakerBrickState[];
    readonly powerups: readonly BrickBreakerPowerupState[];
    readonly lives: number;
    readonly score: number;
    readonly level: number;
    readonly pierceRemaining: number;
    readonly expandRemaining: number;
    readonly status: string;
    readonly scoreText: string;
    readonly hint: string;
}

export interface BrickBreakerPlayfieldLayout {
    readonly left: number;
    readonly bottom: number;
    readonly width: number;
    readonly height: number;
}
