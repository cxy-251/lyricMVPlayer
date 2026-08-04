import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode, palette } from '../../../ui/UiFactory';

const BODY = new Color(106, 163, 130, 255);
const HEAD = new Color(139, 196, 158, 255);
const FOOD = new Color(197, 103, 96, 255);

function drawSnakeCover(parent: Node, width: number, height: number): void {
    const unit = Math.min(width, height);
    const cell = unit * 0.105;
    const points = [
        [-2, -1], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [2, 1],
    ] as const;
    const graphics = createUiNode(parent, 'SnakeCoverGraphics', width, height).addComponent(Graphics);
    for (let index = 0; index < points.length; index += 1) {
        const [x, y] = points[index];
        const left = x * cell - cell * 0.42;
        const bottom = y * cell - cell * 0.42;
        graphics.fillColor = index === points.length - 1 ? HEAD : BODY;
        graphics.fillRect(left, bottom, cell * 0.84, cell * 0.84);
    }
    graphics.fillColor = FOOD;
    graphics.circle(-cell * 2.15, cell * 1.45, cell * 0.32);
    graphics.fill();
    graphics.strokeColor = palette.border;
    graphics.lineWidth = Math.max(1, unit * 0.005);
    graphics.rect(-cell * 3.1, -cell * 2.25, cell * 6.2, cell * 4.5);
    graphics.stroke();
}

registerCatalogCover('snake', drawSnakeCover);
