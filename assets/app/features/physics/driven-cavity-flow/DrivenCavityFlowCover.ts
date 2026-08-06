import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode, palette } from '../../../ui/UiFactory';

const FLOW = new Color(126, 190, 166, 210);
const SECONDARY = new Color(210, 167, 96, 175);

function drawDrivenCavityFlow(parent: Node, width: number, height: number): void {
    const size = Math.max(1, Math.min(width, height) - 34);
    const half = size / 2;
    const graphics = createUiNode(
        parent,
        'DrivenCavityFlowCoverGraphics',
        width,
        height,
    ).addComponent(Graphics);

    graphics.strokeColor = palette.borderStrong;
    graphics.lineWidth = Math.max(1.5, Math.min(width, height) * 0.006);
    graphics.rect(-half, -half, size, size);
    graphics.stroke();

    graphics.strokeColor = palette.accent;
    graphics.lineWidth = 2;
    const arrowY = half + 7;
    for (let index = 0; index < 4; index += 1) {
        const x = -half + size * (index + 0.5) / 4;
        graphics.moveTo(x - 11, arrowY);
        graphics.lineTo(x + 11, arrowY);
        graphics.lineTo(x + 6, arrowY + 4);
        graphics.moveTo(x + 11, arrowY);
        graphics.lineTo(x + 6, arrowY - 4);
    }
    graphics.stroke();

    drawVortex(graphics, size * 0.34, size * 0.29, -size * 0.02, size * 0.02, FLOW, 1.8);
    drawVortex(graphics, size * 0.18, size * 0.14, size * 0.23, -size * 0.23, SECONDARY, 1.2);

    graphics.fillColor = palette.primary;
    for (let index = 0; index < 24; index += 1) {
        const angle = -Math.PI * 2 * index / 24 + 0.35;
        const radius = size * (0.16 + 0.13 * ((index % 5) / 4));
        graphics.circle(
            Math.cos(angle) * radius - size * 0.02,
            Math.sin(angle) * radius * 0.82 + size * 0.02,
            Math.max(1.2, size * 0.006),
        );
    }
    graphics.fill();
}

function drawVortex(
    graphics: Graphics,
    radiusX: number,
    radiusY: number,
    centerX: number,
    centerY: number,
    color: Color,
    lineWidth: number,
): void {
    graphics.strokeColor = color;
    graphics.lineWidth = lineWidth;
    for (let index = 0; index <= 80; index += 1) {
        const angle = -Math.PI * 2 * index / 80;
        const contraction = 1 - index / 240;
        const x = centerX + Math.cos(angle) * radiusX * contraction;
        const y = centerY + Math.sin(angle) * radiusY * contraction;
        if (index === 0) graphics.moveTo(x, y);
        else graphics.lineTo(x, y);
    }
    graphics.stroke();
}

registerCatalogCover('driven-cavity-flow', drawDrivenCavityFlow);
