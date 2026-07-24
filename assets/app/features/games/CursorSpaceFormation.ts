import type { CursorSpacePlayer } from './CursorSpaceTypes';

export interface CursorSpaceFormationPoint {
    x: number;
    y: number;
}

const ESCORTS_PER_ROW = 4;
const FIRST_ROW_DISTANCE = 31;
const ROW_SPACING = 18;
const COLUMN_SPACING = 15;

export function cursorSpaceEscortOffset(
    index: number,
    count: number,
): CursorSpaceFormationPoint {
    const safeCount = Math.max(0, Math.floor(count));
    const safeIndex = Math.max(0, Math.min(safeCount - 1, Math.floor(index)));
    const row = Math.floor(safeIndex / ESCORTS_PER_ROW);
    const rowStart = row * ESCORTS_PER_ROW;
    const rowCount = Math.min(ESCORTS_PER_ROW, safeCount - rowStart);
    const column = safeIndex - rowStart;

    return {
        x: -(FIRST_ROW_DISTANCE + row * ROW_SPACING),
        y: (column - (rowCount - 1) * 0.5) * COLUMN_SPACING,
    };
}

export function cursorSpaceEscortWorldPosition(
    player: Readonly<CursorSpacePlayer>,
    index: number,
): CursorSpaceFormationPoint {
    const offset = cursorSpaceEscortOffset(index, player.escortCount);
    const cosine = Math.cos(player.rotation);
    const sine = Math.sin(player.rotation);
    return {
        x: player.position.x + offset.x * cosine - offset.y * sine,
        y: player.position.y + offset.x * sine + offset.y * cosine,
    };
}
