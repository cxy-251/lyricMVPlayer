export interface GridFitOptions {
    readonly availableWidth: number;
    readonly availableHeight: number;
    readonly columns: number;
    readonly rows: number;
    readonly minimumCellSize?: number;
    readonly maximumCellSize?: number;
}

export function fitGridCell(options: GridFitOptions): number {
    const columns = Math.max(1, Math.floor(options.columns));
    const rows = Math.max(1, Math.floor(options.rows));
    const minimum = Math.max(1, options.minimumCellSize ?? 1);
    const maximum = Math.max(minimum, options.maximumCellSize ?? Number.POSITIVE_INFINITY);
    return Math.max(
        minimum,
        Math.min(
            maximum,
            Math.floor(Math.min(
                Math.max(1, options.availableWidth) / columns,
                Math.max(1, options.availableHeight) / rows,
            )),
        ),
    );
}
