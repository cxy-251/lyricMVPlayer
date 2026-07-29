import type { CursorSpacePlayer } from './CursorSpaceTypes';

export interface CursorSpaceFormationPoint {
    x: number;
    y: number;
}

const WING_LONGITUDINAL_OFFSET = -3;
const WING_LATERAL_OFFSET = 25;

export function cursorSpaceEscortOffset(
    index: number,
    count: number,
    singleSide: -1 | 1 = 1,
): CursorSpaceFormationPoint {
    const safeCount = Math.max(0, Math.min(2, Math.floor(count)));
    if (safeCount === 0) {
        return { x: 0, y: 0 };
    }

    if (safeCount === 1) {
        return {
            x: WING_LONGITUDINAL_OFFSET,
            y: WING_LATERAL_OFFSET * singleSide,
        };
    }

    return {
        x: WING_LONGITUDINAL_OFFSET,
        y: index <= 0 ? -WING_LATERAL_OFFSET : WING_LATERAL_OFFSET,
    };
}

export function cursorSpaceEscortLateralSide(
    player: Readonly<CursorSpacePlayer>,
    index: number,
): -1 | 1 {
    const offset = cursorSpaceEscortOffset(index, player.escortCount, player.escortSide);
    return offset.y < 0 ? -1 : 1;
}

export function cursorSpaceEscortWorldPosition(
    player: Readonly<CursorSpacePlayer>,
    index: number,
): CursorSpaceFormationPoint {
    const offset = cursorSpaceEscortOffset(index, player.escortCount, player.escortSide);
    const rotation = player.rotation;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);

    return {
        x: player.position.x + offset.x * cosine - offset.y * sine,
        y: player.position.y + offset.x * sine + offset.y * cosine,
    };
}
