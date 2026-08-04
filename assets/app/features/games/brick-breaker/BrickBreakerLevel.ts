import type { BrickBreakerBrickKind } from './BrickBreakerTypes';
import type { MutableBrickBreakerBrick } from './BrickBreakerDomain';

const BRICK_COLUMNS = 8;
const BRICK_HORIZONTAL_MARGIN = 16;
const BRICK_GAP = 4;
const BRICK_HEIGHT = 22;
const BRICK_VERTICAL_GAP = 5;

export function createBrickBreakerLevel(
    level: number,
    worldHalfWidth: number,
): MutableBrickBreakerBrick[] {
    const bricks: MutableBrickBreakerBrick[] = [];
    const rows = Math.min(8, 5 + Math.ceil(level / 2));
    const usableWidth = worldHalfWidth * 2 - BRICK_HORIZONTAL_MARGIN * 2;
    const brickWidth = (
        usableWidth - BRICK_GAP * (BRICK_COLUMNS - 1)
    ) / BRICK_COLUMNS;
    const left = -usableWidth / 2 + brickWidth / 2;
    const top = 205;

    let id = 0;
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < BRICK_COLUMNS; column += 1) {
            if (
                level >= 3
                && (row * 5 + column * 3 + level) % 19 === 0
            ) {
                id += 1;
                continue;
            }
            let kind: BrickBreakerBrickKind = 'normal';
            if (
                level >= 2
                && (row * 7 + column * 3 + level) % 17 === 0
            ) {
                kind = 'solid';
            } else if ((row + column + level) % 5 === 0) {
                kind = 'strong';
            }
            const hitPoints = kind === 'strong' ? 2 : 1;
            bricks.push({
                id,
                active: true,
                x: left + column * (brickWidth + BRICK_GAP),
                y: top - row * (BRICK_HEIGHT + BRICK_VERTICAL_GAP),
                width: brickWidth,
                height: BRICK_HEIGHT,
                hitPoints,
                maximumHitPoints: hitPoints,
                kind,
            });
            id += 1;
        }
    }
    return bricks;
}
