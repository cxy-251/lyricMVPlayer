import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode, palette } from '../../../ui/UiFactory';
import { RollingBodyRaceModel } from './RollingBodyRaceModel';

const BODY_COLORS = [
    new Color(126, 190, 166, 255),
    new Color(210, 167, 96, 255),
    new Color(151, 165, 211, 255),
    new Color(188, 137, 151, 255),
] as const;

function drawRollingBodyRace(parent: Node, width: number, height: number): void {
    const model = new RollingBodyRaceModel({
        gravity: 9.81,
        slopeAngleRadians: 20 * Math.PI / 180,
        rampLength: 7,
        radius: 0.23,
    });
    model.step(1.45);
    const snapshot = model.snapshot();
    const graphics = createUiNode(
        parent,
        'RollingRaceCoverGraphics',
        width,
        height,
    ).addComponent(Graphics);
    const angle = 20 * Math.PI / 180;
    const direction = { x: Math.cos(angle), y: -Math.sin(angle) };
    const normal = { x: Math.sin(angle), y: Math.cos(angle) };
    const laneGap = Math.min(width, height) * 0.09;
    const rampPixels = Math.min(width * 0.62, height * 0.72);
    const radius = Math.max(5, Math.min(width, height) * 0.025);

    snapshot.bodies.forEach((body, index) => {
        const offset = (1.5 - index) * laneGap;
        const center = { x: normal.x * offset, y: normal.y * offset };
        const start = {
            x: center.x - direction.x * rampPixels / 2,
            y: center.y - direction.y * rampPixels / 2,
        };
        const end = {
            x: center.x + direction.x * rampPixels / 2,
            y: center.y + direction.y * rampPixels / 2,
        };
        const bodyCenter = {
            x: start.x + direction.x * (
                radius + body.progress * (rampPixels - radius * 2)
            ) + normal.x * radius,
            y: start.y + direction.y * (
                radius + body.progress * (rampPixels - radius * 2)
            ) + normal.y * radius,
        };

        graphics.strokeColor = palette.subtle;
        graphics.lineWidth = Math.max(1, Math.min(width, height) * 0.0035);
        graphics.moveTo(start.x, start.y);
        graphics.lineTo(end.x, end.y);
        graphics.stroke();

        const color = BODY_COLORS[index] ?? BODY_COLORS[0];
        graphics.fillColor = index === 3 ? palette.surface : color;
        graphics.strokeColor = color;
        graphics.lineWidth = index === 3 ? 3 : 1.5;
        graphics.circle(bodyCenter.x, bodyCenter.y, radius);
        graphics.fill();
        graphics.stroke();

        graphics.strokeColor = index === 3 ? color : palette.surface;
        graphics.lineWidth = 1.5;
        graphics.moveTo(bodyCenter.x, bodyCenter.y);
        graphics.lineTo(
            bodyCenter.x + Math.cos(-body.angularPosition) * radius * 0.8,
            bodyCenter.y + Math.sin(-body.angularPosition) * radius * 0.8,
        );
        graphics.stroke();
    });
}

registerCatalogCover('rolling-body-race', drawRollingBodyRace);
