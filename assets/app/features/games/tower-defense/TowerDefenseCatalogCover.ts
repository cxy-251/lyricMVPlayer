import { Graphics, Node } from 'cc';
import { createUiNode, palette } from '../../../ui/UiFactory';
import { registerCatalogCover } from '../../home/CatalogCovers';

function drawTowerDefenseCover(parent: Node, width: number, height: number): void {
    const unit = Math.min(width, height);
    const graphics = createUiNode(
        parent,
        'TowerDefenseCoverGraphics',
        width,
        height,
    ).addComponent(Graphics);
    const cell = unit * 0.075;
    const path = [
        [-4, -2], [-3, -2], [-2, -2], [-1, -2],
        [-1, -1], [-1, 0], [0, 0], [1, 0],
        [2, 0], [2, 1], [2, 2], [3, 2], [4, 2],
    ];

    graphics.strokeColor = palette.surfaceStrong;
    graphics.lineWidth = cell * 0.72;
    graphics.moveTo(path[0][0] * cell, path[0][1] * cell);
    for (let index = 1; index < path.length; index += 1) {
        graphics.lineTo(path[index][0] * cell, path[index][1] * cell);
    }
    graphics.stroke();

    const towers = [
        [-2.3, -0.5],
        [0.5, -1.3],
        [1.0, 1.4],
        [3.2, 0.6],
    ];
    for (let index = 0; index < towers.length; index += 1) {
        const [x, y] = towers[index];
        graphics.fillColor = index % 2 === 0 ? palette.accent : palette.warning;
        graphics.circle(x * cell, y * cell, cell * 0.38);
        graphics.fill();
        graphics.strokeColor = palette.primaryText;
        graphics.lineWidth = cell * 0.12;
        graphics.moveTo(x * cell, y * cell);
        graphics.lineTo((x + 0.45) * cell, y * cell);
        graphics.stroke();
    }

    for (let index = 0; index < 4; index += 1) {
        const point = path[Math.min(path.length - 1, 2 + index * 3)];
        graphics.fillColor = palette.danger;
        graphics.roundRect(
            point[0] * cell - cell * 0.22,
            point[1] * cell - cell * 0.2,
            cell * 0.44,
            cell * 0.4,
            cell * 0.12,
        );
        graphics.fill();
    }
}

registerCatalogCover('tower-defense', drawTowerDefenseCover);
