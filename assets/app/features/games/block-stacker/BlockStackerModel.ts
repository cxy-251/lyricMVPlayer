import type {
    BlockStackerBlockState,
    BlockStackerDropResult,
    BlockStackerFragmentState,
    BlockStackerMovingBlockState,
    BlockStackerObservation,
} from './BlockStackerTypes';

const WORLD_HALF_WIDTH = 160;
const BLOCK_HEIGHT = 22;
const START_WIDTH = 220;
const START_SPEED = 118;
const MAXIMUM_SPEED = 312;
const SPEED_PER_LEVEL = 6.4;
const PERFECT_MINIMUM_TOLERANCE = 1.8;
const FRAGMENT_GRAVITY = 760;
const MAXIMUM_VISIBLE_BLOCKS = 72;
const SHIELD_COMBO_TARGET = 4;
const WIND_LEVEL_SPAN = 4;
const WIND_PATTERN: readonly number[] = [0, -28, 22, -38, 34, 16, -20];

interface MutableBlock {
    x: number;
    y: number;
    width: number;
    height: number;
    level: number;
    perfect: boolean;
}

interface MutableMovingBlock {
    x: number;
    y: number;
    width: number;
    height: number;
    direction: -1 | 1;
    speed: number;
    level: number;
}

interface MutableFragment {
    x: number;
    y: number;
    width: number;
    height: number;
    velocityX: number;
    velocityY: number;
    rotation: number;
    angularVelocity: number;
}

export class BlockStackerModel {
    readonly blocks: MutableBlock[] = [];
    readonly fragments: MutableFragment[] = [];

    private movingBlock: MutableMovingBlock | null = null;
    private currentPhase: 'playing' | 'lost' = 'playing';
    private currentScore = 0;
    private currentCombo = 0;
    private currentShield = 0;
    private currentWind = 0;

    constructor() {
        this.reset();
    }

    get phase(): 'playing' | 'lost' {
        return this.currentPhase;
    }

    get score(): number {
        return this.currentScore;
    }

    get combo(): number {
        return this.currentCombo;
    }

    get shield(): number {
        return this.currentShield;
    }

    get wind(): number {
        return this.currentWind;
    }

    get level(): number {
        return this.movingBlock?.level ?? Math.max(1, this.blocks.length);
    }

    get worldHalfWidth(): number {
        return WORLD_HALF_WIDTH;
    }

    get blockHeight(): number {
        return BLOCK_HEIGHT;
    }

    get cameraTargetY(): number {
        const movingY = this.movingBlock?.y ?? this.blocks[this.blocks.length - 1]?.y ?? 0;
        return Math.max(0, movingY - 150);
    }

    get moving(): Readonly<BlockStackerMovingBlockState> | null {
        return this.movingBlock;
    }

    reset(): void {
        this.blocks.length = 0;
        this.fragments.length = 0;
        this.blocks.push({
            x: 0,
            y: 0,
            width: START_WIDTH,
            height: BLOCK_HEIGHT,
            level: 0,
            perfect: false,
        });
        this.currentPhase = 'playing';
        this.currentScore = 0;
        this.currentCombo = 0;
        this.currentShield = 0;
        this.currentWind = 0;
        this.spawnMovingBlock(START_WIDTH, 1);
    }

    step(deltaTime: number): void {
        const dt = Math.max(0, Math.min(0.05, deltaTime));
        if (dt <= 0) {
            return;
        }
        if (this.currentPhase === 'playing' && this.movingBlock) {
            this.moveCurrentBlock(dt);
        }
        this.updateFragments(dt);
    }

    drop(): BlockStackerDropResult {
        const moving = this.movingBlock;
        const support = this.blocks[this.blocks.length - 1];
        if (this.currentPhase !== 'playing' || !moving || !support) {
            return {
                changed: false,
                lost: this.currentPhase === 'lost',
                perfect: false,
                rescued: false,
            };
        }

        const movingLeft = moving.x - moving.width / 2;
        const movingRight = moving.x + moving.width / 2;
        const supportLeft = support.x - support.width / 2;
        const supportRight = support.x + support.width / 2;
        const overlapLeft = Math.max(movingLeft, supportLeft);
        const overlapRight = Math.min(movingRight, supportRight);
        const overlapWidth = overlapRight - overlapLeft;

        if (overlapWidth <= 0.001) {
            this.fragments.push(this.createFragment(
                moving.x,
                moving.y,
                moving.width,
                moving.direction * 42 + this.currentWind * 0.35,
            ));
            this.currentCombo = 0;
            if (this.currentShield > 0) {
                this.currentShield -= 1;
                this.spawnMovingBlock(
                    Math.max(12, support.width * 0.92),
                    moving.level + 1,
                );
                return { changed: true, lost: false, perfect: false, rescued: true };
            }
            this.movingBlock = null;
            this.currentPhase = 'lost';
            return { changed: true, lost: true, perfect: false, rescued: false };
        }

        const centerError = Math.abs(moving.x - support.x);
        const perfectTolerance = Math.max(
            PERFECT_MINIMUM_TOLERANCE,
            support.width * 0.009,
        );
        const perfect = centerError <= perfectTolerance;
        let retainedX = (overlapLeft + overlapRight) / 2;
        let retainedWidth = overlapWidth;

        if (perfect) {
            this.currentCombo += 1;
            retainedX = support.x;
            retainedWidth = Math.min(
                START_WIDTH,
                support.width + Math.min(5.5, 1.5 + this.currentCombo * 0.45),
            );
            if (this.currentCombo % SHIELD_COMBO_TARGET === 0) {
                this.currentShield = 1;
            }
        } else {
            this.currentCombo = 0;
            if (movingLeft < overlapLeft - 0.001) {
                const cutWidth = overlapLeft - movingLeft;
                this.fragments.push(this.createFragment(
                    movingLeft + cutWidth / 2,
                    moving.y,
                    cutWidth,
                    -38 + this.currentWind * 0.25,
                ));
            }
            if (movingRight > overlapRight + 0.001) {
                const cutWidth = movingRight - overlapRight;
                this.fragments.push(this.createFragment(
                    overlapRight + cutWidth / 2,
                    moving.y,
                    cutWidth,
                    38 + this.currentWind * 0.25,
                ));
            }
        }

        const overlapRatio = overlapWidth / Math.max(1, moving.width);
        this.currentScore += Math.round(overlapRatio * 100)
            + this.currentCombo * 16
            + (perfect ? 70 : 0);
        this.blocks.push({
            x: retainedX,
            y: moving.y,
            width: retainedWidth,
            height: BLOCK_HEIGHT,
            level: moving.level,
            perfect,
        });
        if (this.blocks.length > MAXIMUM_VISIBLE_BLOCKS) {
            this.blocks.shift();
        }
        this.spawnMovingBlock(retainedWidth, moving.level + 1);
        return { changed: true, lost: false, perfect, rescued: false };
    }

    createObservation(): BlockStackerObservation {
        const moving = this.movingBlock;
        const support = this.blocks[this.blocks.length - 1];
        return {
            phase: this.currentPhase,
            movingX: moving?.x ?? 0,
            movingWidth: moving?.width ?? 0,
            direction: moving?.direction ?? 1,
            speed: moving?.speed ?? 0,
            wind: this.currentWind,
            shield: this.currentShield,
            supportX: support?.x ?? 0,
            supportWidth: support?.width ?? START_WIDTH,
            level: moving?.level ?? Math.max(1, this.blocks.length),
        };
    }

    createBlockViewStates(): readonly BlockStackerBlockState[] {
        return this.blocks;
    }

    createFragmentViewStates(): readonly BlockStackerFragmentState[] {
        return this.fragments;
    }

    private spawnMovingBlock(width: number, level: number): void {
        const safeWidth = Math.max(2.5, Math.min(START_WIDTH, width));
        const fromLeft = level % 2 === 1;
        const minimumX = -WORLD_HALF_WIDTH + safeWidth / 2;
        const maximumX = WORLD_HALF_WIDTH - safeWidth / 2;
        const support = this.blocks[this.blocks.length - 1];
        this.currentWind = this.windForLevel(level);
        this.movingBlock = {
            x: fromLeft ? minimumX : maximumX,
            y: (support?.y ?? 0) + BLOCK_HEIGHT,
            width: safeWidth,
            height: BLOCK_HEIGHT,
            direction: fromLeft ? 1 : -1,
            speed: Math.min(MAXIMUM_SPEED, START_SPEED + (level - 1) * SPEED_PER_LEVEL),
            level,
        };
    }

    private windForLevel(level: number): number {
        const band = Math.floor(Math.max(0, level - 1) / WIND_LEVEL_SPAN);
        return WIND_PATTERN[band % WIND_PATTERN.length];
    }

    private moveCurrentBlock(dt: number): void {
        const moving = this.movingBlock;
        if (!moving) {
            return;
        }
        const minimumX = -WORLD_HALF_WIDTH + moving.width / 2;
        const maximumX = WORLD_HALF_WIDTH - moving.width / 2;
        moving.x += (moving.direction * moving.speed + this.currentWind) * dt;
        if (moving.x < minimumX) {
            moving.x = minimumX + (minimumX - moving.x);
            moving.direction = 1;
        } else if (moving.x > maximumX) {
            moving.x = maximumX - (moving.x - maximumX);
            moving.direction = -1;
        }
    }

    private createFragment(
        x: number,
        y: number,
        width: number,
        velocityX: number,
    ): MutableFragment {
        return {
            x,
            y,
            width: Math.max(0.5, width),
            height: BLOCK_HEIGHT,
            velocityX,
            velocityY: -28,
            rotation: 0,
            angularVelocity: velocityX >= 0 ? -2.4 : 2.4,
        };
    }

    private updateFragments(dt: number): void {
        const cullY = this.cameraTargetY - 280;
        for (let index = this.fragments.length - 1; index >= 0; index -= 1) {
            const fragment = this.fragments[index];
            fragment.velocityY -= FRAGMENT_GRAVITY * dt;
            fragment.x += fragment.velocityX * dt;
            fragment.y += fragment.velocityY * dt;
            fragment.rotation += fragment.angularVelocity * dt;
            if (fragment.y < cullY) {
                this.fragments.splice(index, 1);
            }
        }
    }
}
