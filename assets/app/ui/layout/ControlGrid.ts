export interface ControlGridOptions {
    readonly centerX: number;
    readonly centerY: number;
    readonly columns: number;
    readonly rows: number;
    readonly columnStep: number;
    readonly rowStep: number;
}

export interface ControlGridPoint {
    readonly x: number;
    readonly y: number;
}

export function createControlGrid(
    options: ControlGridOptions,
): readonly ControlGridPoint[] {
    const columns = Math.max(1, Math.floor(options.columns));
    const rows = Math.max(1, Math.floor(options.rows));
    const points: ControlGridPoint[] = [];
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            points.push({
                x: options.centerX
                    + (column - (columns - 1) / 2) * options.columnStep,
                y: options.centerY
                    + (row - (rows - 1) / 2) * options.rowStep,
            });
        }
    }
    return points;
}
