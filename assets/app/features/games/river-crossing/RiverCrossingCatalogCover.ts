import { Color, Graphics, Node } from 'cc';
import { createUiNode, palette } from '../../../ui/UiFactory';
import { registerCatalogCover } from '../../home/CatalogCovers';

function drawRiverCrossingCover(parent: Node, width: number, height: number): void {
    const unit = Math.min(width, height);
    const graphics = createUiNode(parent, 'RiverCrossingCoverGraphics', width, height).addComponent(Graphics);
    const laneHeight = unit * 0.085;
    const boardWidth = unit * 0.66;
    const startY = laneHeight * 3;
    const laneColors = [
        new Color(46, 66, 53, 255),
        new Color(42, 45, 44, 255),
        new Color(42, 45, 44, 255),
        new Color(39, 63, 76, 255),
        new Color(39, 63, 76, 255),
        new Color(68, 78, 54, 255),
    ];
    for (let row = 0; row < laneColors.length; row += 1) {
        graphics.fillColor = laneColors[row];
        graphics.fillRect(
            -boardWidth / 2,
            startY - (row + 1) * laneHeight,
            boardWidth,
            laneHeight - 1,
        );
    }
    graphics.fillColor = palette.danger;
    graphics.roundRect(-boardWidth * 0.34, startY - laneHeight * 2.7, unit * 0.18, laneHeight * 0.55, laneHeight * 0.12);
    graphics.fill();
    graphics.fillColor = palette.warning;
    graphics.roundRect(boardWidth * 0.1, startY - laneHeight * 1.72, unit * 0.2, laneHeight * 0.55, laneHeight * 0.12);
    graphics.fill();
    graphics.fillColor = new Color(112, 88, 57, 255);
    graphics.roundRect(-boardWidth * 0.38, startY - laneHeight * 4.72, unit * 0.28, laneHeight * 0.55, laneHeight * 0.2);
    graphics.roundRect(boardWidth * 0.12, startY - laneHeight * 3.72, unit * 0.3, laneHeight * 0.55, laneHeight * 0.2);
    graphics.fill();
    const playerX = 0;
    const playerY = startY - laneHeight * 0.5;
    const radius = laneHeight * 0.32;
    graphics.fillColor = palette.accent;
    graphics.moveTo(playerX, playerY + radius);
    graphics.lineTo(playerX + radius, playerY);
    graphics.lineTo(playerX, playerY - radius);
    graphics.lineTo(playerX - radius, playerY);
    graphics.close();
    graphics.fill();
}

registerCatalogCover('river-crossing', drawRiverCrossingCover);
