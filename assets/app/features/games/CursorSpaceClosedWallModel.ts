import { CursorSpaceModel as CursorSpaceDynamicWallModel } from './CursorSpaceDynamicWallModel';
import type { CursorSpaceWall } from './CursorSpaceDynamicWallModel';
import {
    cursorSpaceConfig,
    type CursorSpaceBounds,
    type CursorSpaceConfig,
    type CursorSpaceEffect,
    type CursorSpaceEnemy,
    type CursorSpacePlayer,
    type CursorSpaceProjectile,
    type CursorSpaceStats,
} from './CursorSpaceTypes';

const WALL_EFFECT_LIFE = 999;
const WALL_EFFECT_MARKER = 900;
const MINIMUM_WALL_LENGTH = 0.001;
const MAX_INTERIOR_LINES_PER_WALL = 5;

interface WallLine {
    readonly x: number;
    readonly y: number;
    readonly directionX: number;
    readonly directionY: number;
    readonly radius: number;
}

/**
 * Visual facade for dynamic walls.
 *
 * The dynamic-wall model owns gameplay and collision. This facade rewrites its
 * reserved wall effects after every simulation step so each collider is shown
 * as one closed rectangle with interior fill lines instead of two open rails.
 */
export class CursorSpaceModel {
    readonly player: CursorSpacePlayer;
    readonly stats: CursorSpaceStats;
    readonly enemies: CursorSpaceEnemy[];
    readonly projectiles: CursorSpaceProjectile[];
    readonly effects: CursorSpaceEffect[];
    readonly walls: CursorSpaceWall[];

    private readonly core: CursorSpaceDynamicWallModel;

    constructor(config: CursorSpaceConfig = cursorSpaceConfig) {
        this.core = new CursorSpaceDynamicWallModel(config);
        this.player = this.core.player;
        this.stats = this.core.stats;
        this.enemies = this.core.enemies;
        this.projectiles = this.core.projectiles;
        this.effects = this.core.effects;
        this.walls = this.core.walls;
        this.rewriteWallVisuals();
    }

    get currentBounds(): Readonly<CursorSpaceBounds> {
        return this.core.currentBounds;
    }

    get wallActive(): boolean {
        return this.core.wallActive;
    }

    setBounds(bounds: CursorSpaceBounds): void {
        this.core.setBounds(bounds);
        this.rewriteWallVisuals();
    }

    setTarget(x: number, y: number, throttle?: number): void {
        this.core.setTarget(x, y, throttle);
    }

    clearTarget(): void {
        this.core.clearTarget();
    }

    reset(): void {
        this.core.reset();
        this.rewriteWallVisuals();
    }

    step(deltaTime: number): void {
        this.core.step(deltaTime);
        this.rewriteWallVisuals();
    }

    private rewriteWallVisuals(): void {
        const reservedIndices: number[] = [];
        for (let index = 0; index < this.effects.length; index += 1) {
            const effect = this.effects[index];
            if (
                effect.initialLife >= WALL_EFFECT_MARKER
                || effect.life >= WALL_EFFECT_MARKER
            ) {
                reservedIndices.push(index);
                effect.active = false;
            }
        }

        if (!this.wallActive || reservedIndices.length === 0) {
            return;
        }

        const lines = this.buildClosedWallLines(reservedIndices.length);
        const visibleCount = Math.min(lines.length, reservedIndices.length);
        for (let index = 0; index < visibleCount; index += 1) {
            const effect = this.effects[reservedIndices[index]];
            const line = lines[index];
            effect.active = true;
            effect.kind = 'fragment';
            effect.position.x = line.x;
            effect.position.y = line.y;
            effect.velocity.x = line.directionX;
            effect.velocity.y = line.directionY;
            effect.life = WALL_EFFECT_LIFE;
            effect.initialLife = WALL_EFFECT_LIFE;
            effect.radius = line.radius;
        }
    }

    private buildClosedWallLines(capacity: number): WallLine[] {
        const outlines: WallLine[] = [];
        const interiors: WallLine[] = [];

        for (const wall of this.walls) {
            this.appendWallOutline(outlines, wall);
            this.appendWallInterior(interiors, wall);
        }

        if (outlines.length >= capacity) {
            return outlines.slice(0, capacity);
        }

        return outlines.concat(interiors.slice(0, capacity - outlines.length));
    }

    private appendWallOutline(lines: WallLine[], wall: Readonly<CursorSpaceWall>): void {
        const centerX = wall.x + wall.width * 0.5;
        const centerY = wall.y + wall.height * 0.5;
        const horizontalRadius = Math.max(MINIMUM_WALL_LENGTH, wall.width * 0.5);
        const verticalRadius = Math.max(MINIMUM_WALL_LENGTH, wall.height * 0.5);

        lines.push(
            {
                x: centerX,
                y: wall.y,
                directionX: 1,
                directionY: 0,
                radius: horizontalRadius,
            },
            {
                x: centerX,
                y: wall.y + wall.height,
                directionX: 1,
                directionY: 0,
                radius: horizontalRadius,
            },
            {
                x: wall.x,
                y: centerY,
                directionX: 0,
                directionY: 1,
                radius: verticalRadius,
            },
            {
                x: wall.x + wall.width,
                y: centerY,
                directionX: 0,
                directionY: 1,
                radius: verticalRadius,
            },
        );
    }

    private appendWallInterior(lines: WallLine[], wall: Readonly<CursorSpaceWall>): void {
        const horizontal = wall.width >= wall.height;
        const thickness = horizontal ? wall.height : wall.width;
        const requestedLines = Math.max(1, Math.ceil(thickness / 5) - 1);
        const count = Math.min(MAX_INTERIOR_LINES_PER_WALL, requestedLines);

        for (let index = 1; index <= count; index += 1) {
            const progress = index / (count + 1);
            if (horizontal) {
                lines.push({
                    x: wall.x + wall.width * 0.5,
                    y: wall.y + wall.height * progress,
                    directionX: 1,
                    directionY: 0,
                    radius: Math.max(MINIMUM_WALL_LENGTH, wall.width * 0.5),
                });
            } else {
                lines.push({
                    x: wall.x + wall.width * progress,
                    y: wall.y + wall.height * 0.5,
                    directionX: 0,
                    directionY: 1,
                    radius: Math.max(MINIMUM_WALL_LENGTH, wall.height * 0.5),
                });
            }
        }
    }
}

export type { CursorSpaceWall };
