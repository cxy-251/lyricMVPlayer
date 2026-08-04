import { Graphics, Node } from 'cc';
import { createUiNode, palette } from '../../../ui/UiFactory';
import { registerCatalogCover } from '../../home/CatalogCovers';

function drawMazeChaseCover(parent: Node, width: number, height: number): void {
    const unit = Math.min(width, height);
    const graphics = createUiNode(parent, 'MazeChaseCoverGraphics', width, height).addComponent(Graphics);
    const cell = unit * 0.075;
    const maze = [
        '111111111',
        '100010001',
        '101010101',
        '100000001',
        '101110101',
        '100000001',
        '111111111',
    ];
    const totalWidth = maze[0].length * cell;
    const totalHeight = maze.length * cell;
    for (let row = 0; row < maze.length; row += 1) {
        for (let column = 0; column < maze[row].length; column += 1) {
            if (maze[row][column] === '1') {
                graphics.fillColor = palette.surfaceStrong;
                graphics.fillRect(
                    -totalWidth / 2 + column * cell,
                    totalHeight / 2 - (row + 1) * cell,
                    cell - 1,
                    cell - 1,
                );
            }
        }
    }
    graphics.fillColor = palette.accent;
    graphics.moveTo(-cell * 2.1, 0);
    graphics.lineTo(-cell * 3.1, cell * 0.75);
    graphics.lineTo(-cell * 2.8, 0);
    graphics.lineTo(-cell * 3.1, -cell * 0.75);
    graphics.close();
    graphics.fill();
    graphics.fillColor = palette.warning;
    graphics.circle(cell * 0.2, 0, cell * 0.18);
    graphics.circle(cell * 1.2, 0, cell * 0.18);
    graphics.fill();
    graphics.fillColor = palette.danger;
    graphics.roundRect(cell * 2.3, -cell * 0.45, cell * 0.9, cell * 0.9, cell * 0.18);
    graphics.fill();
}

registerCatalogCover('maze-chase', drawMazeChaseCover);
