import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode, palette } from '../../../ui/UiFactory';

const towerColors: readonly Color[] = [
    new Color(112, 139, 126, 255),
    new Color(118, 158, 196, 255),
    new Color(144, 126, 190, 255),
    new Color(181, 149, 95, 255),
];

function drawBlockStackerCover(parent: Node, width: number, height: number): void {
    const unit = Math.max(1, Math.min(width, height));
    const graphics = createGraphics(parent, 'BlockStackerCover', width, height);
    const blockHeight = unit * 0.095;
    const levels = [
        { x: 0, y: -unit * 0.25, width: unit * 0.54 },
        { x: unit * 0.025, y: -unit * 0.15, width: unit * 0.46 },
        { x: -unit * 0.018, y: -unit * 0.05, width: unit * 0.38 },
        { x: unit * 0.032, y: unit * 0.05, width: unit * 0.30 },
    ];
    for (let index = 0; index < levels.length; index += 1) {
        const level = levels[index];
        graphics.fillColor = towerColors[index % towerColors.length];
        graphics.fillRect(
            level.x - level.width / 2,
            level.y - blockHeight / 2,
            level.width,
            blockHeight,
        );
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = Math.max(1.2, unit * 0.005);
        graphics.rect(
            level.x - level.width / 2,
            level.y - blockHeight / 2,
            level.width,
            blockHeight,
        );
        graphics.stroke();
    }

    const movingWidth = unit * 0.30;
    const movingX = -unit * 0.08;
    const movingY = unit * 0.22;
    graphics.fillColor = palette.warning;
    graphics.fillRect(
        movingX - movingWidth / 2,
        movingY - blockHeight / 2,
        movingWidth,
        blockHeight,
    );
    graphics.strokeColor = palette.primaryText;
    graphics.lineWidth = Math.max(1.4, unit * 0.006);
    graphics.rect(
        movingX - movingWidth / 2,
        movingY - blockHeight / 2,
        movingWidth,
        blockHeight,
    );
    graphics.stroke();

    graphics.strokeColor = new Color(126, 158, 143, 120);
    graphics.lineWidth = Math.max(1, unit * 0.004);
    graphics.moveTo(-unit * 0.34, movingY);
    graphics.lineTo(unit * 0.34, movingY);
    graphics.stroke();

    const fragment = createGraphics(parent, 'BlockStackerFragmentCover', width, height);
    fragment.fillColor = new Color(190, 104, 104, 225);
    const fragmentX = unit * 0.23;
    const fragmentY = unit * 0.01;
    const halfWidth = unit * 0.045;
    const halfHeight = blockHeight * 0.44;
    const rotation = -0.45;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const corners = [
        [-halfWidth, -halfHeight],
        [halfWidth, -halfHeight],
        [halfWidth, halfHeight],
        [-halfWidth, halfHeight],
    ] as const;
    for (let index = 0; index < corners.length; index += 1) {
        const [x, y] = corners[index];
        const worldX = fragmentX + x * cosine - y * sine;
        const worldY = fragmentY + x * sine + y * cosine;
        if (index === 0) {
            fragment.moveTo(worldX, worldY);
        } else {
            fragment.lineTo(worldX, worldY);
        }
    }
    fragment.close();
    fragment.fill();
}

function createGraphics(parent: Node, name: string, width: number, height: number): Graphics {
    return createUiNode(parent, name, width, height).addComponent(Graphics);
}

registerCatalogCover('block-stacker', drawBlockStackerCover);
