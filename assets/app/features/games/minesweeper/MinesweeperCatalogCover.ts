import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode, palette } from '../../../ui/UiFactory';

const revealedColor = new Color(46, 54, 50, 255);
const hiddenColor = new Color(78, 91, 84, 255);
const mineColor = new Color(190, 104, 104, 245);
const flagColor = new Color(181, 149, 95, 245);

function drawMinesweeperCover(parent: Node, width: number, height: number): void {
    const unit = Math.max(1, Math.min(width, height));
    const cellSize = unit * 0.115;
    const boardSize = cellSize * 5;
    const originX = -boardSize / 2;
    const originY = -boardSize / 2;
    const board = createGraphics(parent, 'MinesweeperBoardCover', width, height);
    board.fillColor = palette.border;
    board.fillRect(originX - 3, originY - 3, boardSize + 6, boardSize + 6);

    const revealed = new Set(['1:1', '1:2', '2:1', '2:2', '3:1']);
    for (let row = 0; row < 5; row += 1) {
        for (let column = 0; column < 5; column += 1) {
            const x = originX + column * cellSize;
            const y = originY + (4 - row) * cellSize;
            board.fillColor = revealed.has(`${row}:${column}`) ? revealedColor : hiddenColor;
            board.fillRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
        }
    }

    const number = createGraphics(parent, 'MinesweeperNumberCover', width, height);
    number.strokeColor = new Color(118, 158, 196, 255);
    number.lineWidth = Math.max(2, unit * 0.011);
    const numberX = originX + cellSize * 1.5;
    const numberY = originY + cellSize * 2.5;
    number.moveTo(numberX - cellSize * 0.08, numberY + cellSize * 0.18);
    number.lineTo(numberX + cellSize * 0.06, numberY + cellSize * 0.26);
    number.lineTo(numberX + cellSize * 0.06, numberY - cellSize * 0.24);
    number.stroke();

    const mine = createGraphics(parent, 'MinesweeperMineCover', width, height);
    const mineX = originX + cellSize * 3.5;
    const mineY = originY + cellSize * 3.5;
    const radius = cellSize * 0.17;
    mine.fillColor = mineColor;
    mine.circle(mineX, mineY, radius);
    mine.fill();
    mine.strokeColor = mineColor;
    mine.lineWidth = Math.max(1.5, unit * 0.007);
    for (let index = 0; index < 8; index += 1) {
        const angle = Math.PI * 2 * index / 8;
        mine.moveTo(
            mineX + Math.cos(angle) * radius * 0.8,
            mineY + Math.sin(angle) * radius * 0.8,
        );
        mine.lineTo(
            mineX + Math.cos(angle) * radius * 1.65,
            mineY + Math.sin(angle) * radius * 1.65,
        );
    }
    mine.stroke();

    const flag = createGraphics(parent, 'MinesweeperFlagCover', width, height);
    const poleX = originX + cellSize * 3.35;
    const poleBottom = originY + cellSize * 0.25;
    flag.strokeColor = palette.text;
    flag.lineWidth = Math.max(2, unit * 0.009);
    flag.moveTo(poleX, poleBottom);
    flag.lineTo(poleX, poleBottom + cellSize * 0.58);
    flag.moveTo(poleX - cellSize * 0.17, poleBottom);
    flag.lineTo(poleX + cellSize * 0.22, poleBottom);
    flag.stroke();
    flag.fillColor = flagColor;
    flag.moveTo(poleX, poleBottom + cellSize * 0.56);
    flag.lineTo(poleX + cellSize * 0.36, poleBottom + cellSize * 0.43);
    flag.lineTo(poleX, poleBottom + cellSize * 0.28);
    flag.close();
    flag.fill();
}

function createGraphics(parent: Node, name: string, width: number, height: number): Graphics {
    return createUiNode(parent, name, width, height).addComponent(Graphics);
}

registerCatalogCover('minesweeper', drawMinesweeperCover);
