import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode, palette } from '../../../ui/UiFactory';
import type { TetrisPieceType } from './TetrisTypes';

const COLORS: Readonly<Record<TetrisPieceType, Color>> = {
    I: new Color(82, 168, 181, 255),
    O: new Color(190, 158, 78, 255),
    T: new Color(145, 116, 184, 255),
    J: new Color(91, 124, 184, 255),
    L: new Color(190, 126, 75, 255),
    S: new Color(104, 165, 112, 255),
    Z: new Color(188, 92, 92, 255),
};

function drawTetrisCover(parent: Node, width: number, height: number): void {
    const unit = Math.max(1, Math.min(width, height));
    const cell = Math.max(5, unit * 0.052);
    const boardWidth = cell * 7;
    const boardHeight = cell * 11;
    const left = -boardWidth / 2;
    const bottom = -boardHeight / 2 - unit * 0.01;
    const graphics = createUiNode(
        parent,
        'TetrisCoverGraphics',
        width,
        height,
    ).addComponent(Graphics);

    graphics.fillColor = palette.backgroundRaised;
    graphics.fillRect(left, bottom, boardWidth, boardHeight);
    graphics.strokeColor = palette.borderStrong;
    graphics.lineWidth = Math.max(1, unit * 0.006);
    graphics.rect(left, bottom, boardWidth, boardHeight);
    graphics.stroke();

    const settled: ReadonlyArray<readonly [number, number, TetrisPieceType]> = [
        [0, 0, 'J'], [1, 0, 'J'], [2, 0, 'O'], [3, 0, 'O'], [4, 0, 'S'], [5, 0, 'S'], [6, 0, 'L'],
        [0, 1, 'J'], [1, 1, 'T'], [2, 1, 'T'], [3, 1, 'O'], [4, 1, 'S'], [5, 1, 'Z'], [6, 1, 'L'],
        [0, 2, 'I'], [1, 2, 'I'], [2, 2, 'I'], [3, 2, 'I'], [4, 2, 'Z'], [5, 2, 'Z'], [6, 2, 'L'],
        [0, 3, 'T'], [1, 3, 'T'], [2, 3, 'T'], [4, 3, 'J'], [5, 3, 'J'], [6, 3, 'J'],
        [1, 4, 'T'], [4, 4, 'J'],
    ];
    for (const [x, y, type] of settled) {
        drawCell(graphics, left, bottom, cell, x, y, COLORS[type]);
    }

    const falling: ReadonlyArray<readonly [number, number]> = [
        [2, 8], [3, 8], [4, 8], [3, 9],
    ];
    for (const [x, y] of falling) {
        drawCell(graphics, left, bottom, cell, x, y, COLORS.T);
    }

    graphics.strokeColor = new Color(COLORS.T.r, COLORS.T.g, COLORS.T.b, 85);
    graphics.lineWidth = Math.max(1, unit * 0.004);
    for (const [x, y] of [[2, 5], [3, 5], [4, 5], [3, 6]] as const) {
        const cellLeft = left + x * cell + 1;
        const cellBottom = bottom + y * cell + 1;
        graphics.rect(cellLeft, cellBottom, cell - 2, cell - 2);
    }
    graphics.stroke();
}

function drawCell(
    graphics: Graphics,
    left: number,
    bottom: number,
    size: number,
    x: number,
    y: number,
    color: Color,
): void {
    const cellLeft = left + x * size + 1;
    const cellBottom = bottom + y * size + 1;
    graphics.fillColor = color;
    graphics.fillRect(cellLeft, cellBottom, size - 2, size - 2);
    graphics.strokeColor = palette.borderStrong;
    graphics.lineWidth = 1;
    graphics.rect(cellLeft, cellBottom, size - 2, size - 2);
    graphics.stroke();
}

registerCatalogCover('tetris', drawTetrisCover);
