import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode, palette } from '../../../ui/UiFactory';
import { DrivenCavityFlowModel } from './DrivenCavityFlowModel';

const CONTOUR_COLORS = [
    new Color(24, 43, 120, 245),
    new Color(27, 78, 171, 245),
    new Color(33, 132, 202, 245),
    new Color(40, 181, 190, 245),
    new Color(72, 199, 126, 245),
    new Color(151, 205, 72, 245),
    new Color(224, 210, 55, 245),
    new Color(242, 156, 43, 245),
    new Color(220, 74, 40, 245),
] as const;

function drawDrivenCavityFlow(parent: Node, width: number, height: number): void {
    const model = new DrivenCavityFlowModel({
        width: 24,
        height: 24,
        lidSpeed: 0.08,
        kinematicViscosity: 0.04,
    });
    model.step(180);
    const snapshot = model.snapshot();
    const diagnostics = model.diagnostics();

    const size = Math.max(1, Math.min(width, height) - 42);
    const half = size / 2;
    const graphics = createUiNode(
        parent,
        'DrivenCavityFlowCoverGraphics',
        width,
        height,
    ).addComponent(Graphics);
    const cellSize = size / snapshot.width + 0.8;
    const maximum = Math.max(1e-6, diagnostics.maximumSpeed);

    for (let band = 0; band < CONTOUR_COLORS.length; band += 1) {
        graphics.fillColor = CONTOUR_COLORS[band];
        for (let y = 0; y < snapshot.height; y += 1) {
            for (let x = 0; x < snapshot.width; x += 1) {
                const cell = y * snapshot.width + x;
                const speed = Math.hypot(
                    snapshot.velocityX[cell],
                    snapshot.velocityY[cell],
                );
                const normalized = Math.max(0, Math.min(1, speed / maximum));
                const scalarBand = Math.min(
                    CONTOUR_COLORS.length - 1,
                    Math.floor(normalized * CONTOUR_COLORS.length),
                );
                if (scalarBand !== band) continue;
                graphics.rect(
                    -half + x / snapshot.width * size,
                    -half + y / snapshot.height * size,
                    cellSize,
                    cellSize,
                );
            }
        }
        graphics.fill();
    }

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
}

registerCatalogCover('driven-cavity-flow', drawDrivenCavityFlow);
