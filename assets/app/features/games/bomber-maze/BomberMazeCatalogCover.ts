import { Color, Graphics, Node } from 'cc';
import { createUiNode, palette } from '../../../ui/UiFactory';
import { registerCatalogCover } from '../../home/CatalogCovers';

function drawBomberMazeCover(parent: Node, width: number, height: number): void {
    const graphics = createUiNode(
        parent,
        'BomberMazeCoverGraphics',
        width,
        height,
    ).addComponent(Graphics);
    const unit = Math.min(width, height);
    const cell = unit * 0.095;
    const columns = 7;
    const rows = 5;
    const boardWidth = columns * cell;
    const boardHeight = rows * cell;

    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            const left = -boardWidth / 2 + column * cell;
            const bottom = -boardHeight / 2 + row * cell;
            graphics.fillColor = (row + column) % 2 === 0
                ? palette.backgroundRaised
                : palette.background;
            graphics.fillRect(left, bottom, cell, cell);
            if (
                row === 0
                || column === 0
                || row === rows - 1
                || column === columns - 1
                || (row % 2 === 0 && column % 2 === 0)
            ) {
                graphics.fillColor = palette.surfaceStrong;
                graphics.fillRect(left + 1, bottom + 1, cell - 2, cell - 2);
            }
        }
    }

    graphics.fillColor = new Color(118, 90, 61, 255);
    graphics.fillRect(-cell * 2.4, -cell * 0.42, cell * 0.84, cell * 0.84);
    graphics.fillRect(cell * 1.55, cell * 0.58, cell * 0.84, cell * 0.84);

    graphics.fillColor = palette.surfaceStrong;
    graphics.circle(0, 0, cell * 0.34);
    graphics.fill();
    graphics.strokeColor = palette.warning;
    graphics.lineWidth = Math.max(1, cell * 0.08);
    graphics.moveTo(cell * 0.12, cell * 0.24);
    graphics.lineTo(cell * 0.34, cell * 0.48);
    graphics.stroke();

    graphics.fillColor = new Color(209, 104, 78, 255);
    graphics.fillRect(-cell * 1.45, -cell * 0.15, cell * 2.9, cell * 0.3);
    graphics.fillRect(-cell * 0.15, -cell * 1.45, cell * 0.3, cell * 2.9);
    graphics.fillColor = new Color(244, 202, 100, 255);
    graphics.circle(0, 0, cell * 0.22);
    graphics.fill();
}

registerCatalogCover('bomber-maze', drawBomberMazeCover);
