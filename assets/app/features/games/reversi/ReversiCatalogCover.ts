import { Color, Graphics, Node } from 'cc';
import { createUiNode, palette } from '../../../ui/UiFactory';
import { registerCatalogCover } from '../../home/CatalogCovers';

const BOARD = new Color(53, 84, 67, 255);
const BLACK = new Color(20, 23, 22, 255);
const WHITE = new Color(224, 230, 226, 255);

function drawReversiCover(parent: Node, width: number, height: number): void {
    const unit = Math.min(width, height);
    const cell = unit * 0.09;
    const boardSize = cell * 8;
    const graphics = createUiNode(parent, 'ReversiCoverGraphics', width, height)
        .addComponent(Graphics);
    graphics.fillColor = BOARD;
    graphics.fillRect(-boardSize / 2, -boardSize / 2, boardSize, boardSize);
    graphics.strokeColor = palette.borderStrong;
    graphics.lineWidth = 1;
    for (let index = 0; index <= 8; index += 1) {
        const offset = -boardSize / 2 + index * cell;
        graphics.moveTo(offset, -boardSize / 2);
        graphics.lineTo(offset, boardSize / 2);
        graphics.moveTo(-boardSize / 2, offset);
        graphics.lineTo(boardSize / 2, offset);
    }
    graphics.stroke();
    const discs = [
        [3, 3, 2], [3, 4, 1], [4, 3, 1], [4, 4, 2],
        [2, 4, 1], [2, 3, 2], [5, 3, 1], [4, 5, 2],
    ] as const;
    for (const [row, column, player] of discs) {
        const x = -boardSize / 2 + (column + 0.5) * cell;
        const y = boardSize / 2 - (row + 0.5) * cell;
        graphics.fillColor = player === 1 ? BLACK : WHITE;
        graphics.circle(x, y, cell * 0.36);
        graphics.fill();
    }
}

registerCatalogCover('reversi', drawReversiCover);
