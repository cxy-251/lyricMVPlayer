import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode, palette } from '../../../ui/UiFactory';

const floorA = new Color(34, 40, 36, 255);
const floorB = new Color(39, 46, 41, 255);
const wall = new Color(74, 86, 79, 255);
const box = new Color(181, 149, 95, 255);
const player = new Color(118, 158, 196, 255);

function drawSokobanCover(parent: Node, width: number, height: number): void {
    const unit = Math.max(1, Math.min(width, height));
    const cell = unit * 0.105;
    const columns = 6;
    const rows = 5;
    const boardWidth = cell * columns;
    const boardHeight = cell * rows;
    const left = -boardWidth / 2;
    const bottom = -boardHeight / 2;
    const graphics = createGraphics(parent, 'SokobanCoverBoard', width, height);
    const walls = new Set([
        '0:0', '0:1', '0:2', '0:3', '0:4', '0:5',
        '1:0', '1:5',
        '2:0', '2:3', '2:5',
        '3:0', '3:5',
        '4:0', '4:1', '4:2', '4:3', '4:4', '4:5',
    ]);
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            const x = left + column * cell;
            const y = bottom + (rows - row - 1) * cell;
            const isWall = walls.has(`${row}:${column}`);
            graphics.fillColor = isWall
                ? wall
                : (row + column) % 2 === 0 ? floorA : floorB;
            graphics.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        }
    }

    const goalX = left + cell * 4.5;
    const goalY = bottom + cell * 3.5;
    graphics.strokeColor = palette.accent;
    graphics.lineWidth = Math.max(1.5, unit * 0.007);
    graphics.circle(goalX, goalY, cell * 0.22);
    graphics.stroke();

    const boxX = left + cell * 3.5;
    const boxY = bottom + cell * 2.5;
    const boxSize = cell * 0.66;
    graphics.fillColor = box;
    graphics.fillRect(
        boxX - boxSize / 2,
        boxY - boxSize / 2,
        boxSize,
        boxSize,
    );
    graphics.strokeColor = palette.text;
    graphics.lineWidth = Math.max(1.2, unit * 0.006);
    graphics.rect(
        boxX - boxSize / 2,
        boxY - boxSize / 2,
        boxSize,
        boxSize,
    );
    graphics.moveTo(boxX - boxSize * 0.34, boxY - boxSize * 0.34);
    graphics.lineTo(boxX + boxSize * 0.34, boxY + boxSize * 0.34);
    graphics.moveTo(boxX + boxSize * 0.34, boxY - boxSize * 0.34);
    graphics.lineTo(boxX - boxSize * 0.34, boxY + boxSize * 0.34);
    graphics.stroke();

    const playerX = left + cell * 2.5;
    const playerY = bottom + cell * 1.5;
    graphics.fillColor = player;
    graphics.circle(playerX, playerY, cell * 0.24);
    graphics.fill();
    graphics.strokeColor = palette.primaryText;
    graphics.circle(playerX, playerY, cell * 0.24);
    graphics.stroke();
}

function createGraphics(parent: Node, name: string, width: number, height: number): Graphics {
    return createUiNode(parent, name, width, height).addComponent(Graphics);
}

registerCatalogCover('sokoban', drawSokobanCover);
