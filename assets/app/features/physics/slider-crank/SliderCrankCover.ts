import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode, palette } from '../../../ui/UiFactory';

const CRANK_COLOR = new Color(92, 151, 211, 245);
const ROD_COLOR = new Color(210, 167, 96, 245);
const PISTON_COLOR = new Color(126, 190, 166, 245);

function drawSliderCrank(parent: Node, width: number, height: number): void {
    const graphics = createUiNode(
        parent,
        'SliderCrankCoverGraphics',
        width,
        height,
    ).addComponent(Graphics);
    const scale = Math.max(1, Math.min(width / 6.4, height / 3.4));
    const originX = -width * 0.31;
    const originY = height * 0.05;
    const radius = scale * 0.82;
    const rodLength = radius * 3.35;
    const angle = 52 * Math.PI / 180;
    const crankPin = {
        x: originX + Math.cos(angle) * radius,
        y: originY + Math.sin(angle) * radius,
    };
    const pistonX = originX + Math.cos(angle) * radius
        + Math.sqrt(
            rodLength * rodLength
            - Math.sin(angle) * Math.sin(angle) * radius * radius,
        );
    const pistonWidth = radius * 0.72;
    const pistonHeight = radius * 0.72;

    graphics.strokeColor = palette.borderStrong;
    graphics.lineWidth = 1.8;
    graphics.circle(originX, originY, radius);
    graphics.moveTo(pistonX - radius * 0.8, originY + pistonHeight * 0.68);
    graphics.lineTo(pistonX + radius * 1.15, originY + pistonHeight * 0.68);
    graphics.moveTo(pistonX - radius * 0.8, originY - pistonHeight * 0.68);
    graphics.lineTo(pistonX + radius * 1.15, originY - pistonHeight * 0.68);
    graphics.stroke();

    graphics.strokeColor = CRANK_COLOR;
    graphics.lineWidth = Math.max(4, radius * 0.11);
    graphics.moveTo(originX, originY);
    graphics.lineTo(crankPin.x, crankPin.y);
    graphics.stroke();

    graphics.strokeColor = ROD_COLOR;
    graphics.lineWidth = Math.max(5, radius * 0.13);
    graphics.moveTo(crankPin.x, crankPin.y);
    graphics.lineTo(pistonX, originY);
    graphics.stroke();

    graphics.fillColor = PISTON_COLOR;
    graphics.rect(
        pistonX - pistonWidth * 0.42,
        originY - pistonHeight / 2,
        pistonWidth,
        pistonHeight,
    );
    graphics.fill();

    graphics.fillColor = palette.backgroundRaised;
    graphics.circle(originX, originY, Math.max(5, radius * 0.13));
    graphics.circle(crankPin.x, crankPin.y, Math.max(4, radius * 0.10));
    graphics.circle(pistonX, originY, Math.max(4, radius * 0.10));
    graphics.fill();

    graphics.strokeColor = palette.accent;
    graphics.lineWidth = 1.6;
    const chartLeft = -width * 0.36;
    const chartRight = width * 0.36;
    const chartY = -height * 0.34;
    for (let index = 0; index <= 80; index += 1) {
        const theta = Math.PI * 2 * index / 80;
        const x = chartLeft + (chartRight - chartLeft) * index / 80;
        const y = chartY + Math.cos(theta) * height * 0.06;
        if (index === 0) graphics.moveTo(x, y);
        else graphics.lineTo(x, y);
    }
    graphics.stroke();
}

registerCatalogCover('slider-crank', drawSliderCrank);
