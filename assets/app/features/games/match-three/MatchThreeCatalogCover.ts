import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode, palette } from '../../../ui/UiFactory';

const COLORS = [
    new Color(190, 104, 104, 255),
    new Color(202, 169, 91, 255),
    new Color(112, 151, 184, 255),
    new Color(126, 158, 143, 255),
    new Color(155, 126, 177, 255),
] as const;

function drawMatchThreeCover(parent: Node, width: number, height: number): void {
    const unit = Math.min(width, height);
    const cell = unit * 0.14;
    const gap = cell * 0.13;
    const boardSize = cell * 5 + gap * 6;
    const graphics = createUiNode(
        parent,
        'MatchThreeCoverGraphics',
        width,
        height,
    ).addComponent(Graphics);

    graphics.fillColor = palette.surfaceStrong;
    graphics.roundRect(
        -boardSize / 2,
        -boardSize / 2,
        boardSize,
        boardSize,
        cell * 0.16,
    );
    graphics.fill();

    const pattern = [
        0, 1, 2, 3, 4,
        2, 3, 1, 4, 0,
        1, 1, 1, 3, 2,
        4, 2, 0, 3, 1,
        3, 0, 4, 2, 0,
    ];
    for (let index = 0; index < pattern.length; index += 1) {
        const row = Math.floor(index / 5);
        const column = index % 5;
        const x = -boardSize / 2 + gap + column * (cell + gap);
        const y = boardSize / 2 - gap - cell - row * (cell + gap);
        graphics.fillColor = COLORS[pattern[index]];
        graphics.roundRect(x, y, cell, cell, cell * 0.22);
        graphics.fill();
        if (row === 2 && column === 2) {
            graphics.strokeColor = palette.primaryText;
            graphics.lineWidth = Math.max(1.5, cell * 0.1);
            graphics.moveTo(x + cell * 0.18, y + cell / 2);
            graphics.lineTo(x + cell * 0.82, y + cell / 2);
            graphics.stroke();
        }
    }
}

registerCatalogCover('match-three', drawMatchThreeCover);
