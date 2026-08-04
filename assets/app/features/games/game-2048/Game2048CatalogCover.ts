import { Color, Graphics, Label, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createLabel, createUiNode, palette } from '../../../ui/UiFactory';

const COLORS = [
    new Color(105, 124, 114, 255),
    new Color(124, 148, 174, 255),
    new Color(177, 147, 94, 255),
    new Color(188, 96, 91, 255),
] as const;

function drawGame2048Cover(parent: Node, width: number, height: number): void {
    const unit = Math.min(width, height);
    const cell = unit * 0.16;
    const gap = cell * 0.08;
    const boardSize = cell * 3 + gap * 4;
    const graphics = createUiNode(parent, 'Game2048CoverGraphics', width, height).addComponent(Graphics);
    graphics.fillColor = palette.borderStrong;
    graphics.fillRect(-boardSize / 2, -boardSize / 2, boardSize, boardSize);
    const values = [2, 4, 8, 16, 32, 64, 128, 256, 512];
    for (let index = 0; index < values.length; index += 1) {
        const row = Math.floor(index / 3);
        const column = index % 3;
        const x = -boardSize / 2 + gap + column * (cell + gap);
        const y = boardSize / 2 - gap - (row + 1) * cell - row * gap;
        graphics.fillColor = COLORS[Math.min(COLORS.length - 1, Math.floor(index / 2))];
        graphics.fillRect(x, y, cell, cell);
        const labelNode = createLabel(
            parent,
            `${values[index]}`,
            cell,
            cell,
            Math.max(8, cell * 0.2),
            palette.primaryText,
            x + cell / 2,
            y + cell / 2,
        );
        const label = labelNode.getComponent(Label);
        if (label) {
            label.enableWrapText = false;
        }
    }
}

registerCatalogCover('game-2048', drawGame2048Cover);
