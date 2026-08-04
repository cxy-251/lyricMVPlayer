import { Color, Graphics, Node } from 'cc';
import { createUiNode, palette } from '../../../ui/UiFactory';
import { registerCatalogCover } from '../../home/CatalogCovers';

const RED = new Color(190, 104, 104, 255);
const YELLOW = new Color(202, 169, 91, 255);

function drawConnectFourCover(parent: Node, width: number, height: number): void {
    const unit = Math.min(width, height);
    const cell = unit * 0.105;
    const boardWidth = cell * 7;
    const boardHeight = cell * 6;
    const graphics = createUiNode(parent, 'ConnectFourCoverGraphics', width, height)
        .addComponent(Graphics);
    graphics.fillColor = palette.primaryMuted;
    graphics.fillRect(-boardWidth / 2, -boardHeight / 2, boardWidth, boardHeight);
    const pattern = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 2, 0, 0, 0],
        [0, 0, 1, 1, 0, 0, 0],
        [0, 2, 2, 1, 0, 0, 0],
        [1, 2, 1, 2, 1, 0, 0],
    ];
    for (let row = 0; row < 6; row += 1) {
        for (let column = 0; column < 7; column += 1) {
            const x = -boardWidth / 2 + (column + 0.5) * cell;
            const y = boardHeight / 2 - (row + 0.5) * cell;
            graphics.fillColor = pattern[row][column] === 1
                ? RED
                : pattern[row][column] === 2
                    ? YELLOW
                    : palette.backgroundRaised;
            graphics.circle(x, y, cell * 0.36);
            graphics.fill();
        }
    }
}

registerCatalogCover('connect-four', drawConnectFourCover);
