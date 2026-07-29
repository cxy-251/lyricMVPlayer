export interface CursorSpaceFireControlPolicy {
    canEngage(
        sourceX: number,
        sourceY: number,
        targetX: number,
        targetY: number,
        projectileRadius: number,
    ): boolean;
}
