import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode, palette } from '../../../ui/UiFactory';

const INPUT_COLOR = new Color(92, 151, 211, 245);
const COUPLER_COLOR = new Color(210, 167, 96, 245);
const OUTPUT_COLOR = new Color(126, 190, 166, 245);

function drawMechanicalLinkages(parent: Node, width: number, height: number): void {
    const graphics = createUiNode(
        parent,
        'MechanicalLinkagesCoverGraphics',
        width,
        height,
    ).addComponent(Graphics);
    const columnWidth = width / 3;
    const size = Math.max(18, Math.min(columnWidth * 0.76, height * 0.56));
    const centerY = height * 0.04;

    drawSliderCrank(graphics, -columnWidth, centerY, size);
    drawFourBar(graphics, 0, centerY, size);
    drawGeneva(graphics, columnWidth, centerY, size);

    graphics.strokeColor = palette.border;
    graphics.lineWidth = 1;
    for (const x of [-columnWidth / 2, columnWidth / 2]) {
        graphics.moveTo(x, -height * 0.31);
        graphics.lineTo(x, height * 0.31);
    }
    graphics.stroke();
}

function drawSliderCrank(
    graphics: Graphics,
    centerX: number,
    centerY: number,
    size: number,
): void {
    const radius = size * 0.20;
    const crankCenter = { x: centerX - size * 0.27, y: centerY };
    const angle = 52 * Math.PI / 180;
    const crankPin = {
        x: crankCenter.x + Math.cos(angle) * radius,
        y: crankCenter.y + Math.sin(angle) * radius,
    };
    const sliderPin = { x: centerX + size * 0.31, y: centerY };

    graphics.strokeColor = palette.borderStrong;
    graphics.lineWidth = 1.4;
    graphics.circle(crankCenter.x, crankCenter.y, radius);
    graphics.moveTo(centerX + size * 0.12, centerY + size * 0.12);
    graphics.lineTo(centerX + size * 0.47, centerY + size * 0.12);
    graphics.moveTo(centerX + size * 0.12, centerY - size * 0.12);
    graphics.lineTo(centerX + size * 0.47, centerY - size * 0.12);
    graphics.stroke();

    drawLink(graphics, crankCenter, crankPin, INPUT_COLOR, 4);
    drawLink(graphics, crankPin, sliderPin, COUPLER_COLOR, 5);
    graphics.fillColor = OUTPUT_COLOR;
    graphics.rect(
        sliderPin.x - size * 0.08,
        sliderPin.y - size * 0.10,
        size * 0.16,
        size * 0.20,
    );
    graphics.fill();
    drawJoint(graphics, crankCenter, 4);
    drawJoint(graphics, crankPin, 3.5);
    drawJoint(graphics, sliderPin, 3.5);
}

function drawFourBar(
    graphics: Graphics,
    centerX: number,
    centerY: number,
    size: number,
): void {
    const fixedInput = { x: centerX - size * 0.34, y: centerY - size * 0.20 };
    const fixedOutput = { x: centerX + size * 0.34, y: centerY - size * 0.20 };
    const crankPin = { x: centerX - size * 0.18, y: centerY + size * 0.20 };
    const couplerPin = { x: centerX + size * 0.25, y: centerY + size * 0.30 };
    drawLink(graphics, fixedInput, fixedOutput, palette.borderStrong, 4);
    drawLink(graphics, fixedInput, crankPin, INPUT_COLOR, 5);
    drawLink(graphics, crankPin, couplerPin, COUPLER_COLOR, 5);
    drawLink(graphics, fixedOutput, couplerPin, OUTPUT_COLOR, 5);
    drawJoint(graphics, fixedInput, 4);
    drawJoint(graphics, fixedOutput, 4);
    drawJoint(graphics, crankPin, 3.5);
    drawJoint(graphics, couplerPin, 3.5);
}

function drawGeneva(
    graphics: Graphics,
    centerX: number,
    centerY: number,
    size: number,
): void {
    const driverCenter = { x: centerX - size * 0.25, y: centerY };
    const wheelCenter = { x: centerX + size * 0.23, y: centerY };
    const driverRadius = size * 0.23;
    const wheelRadius = size * 0.29;
    const driverAngle = 14 * Math.PI / 180;
    const driverPin = {
        x: driverCenter.x + Math.cos(driverAngle) * driverRadius,
        y: driverCenter.y + Math.sin(driverAngle) * driverRadius,
    };

    graphics.strokeColor = palette.border;
    graphics.lineWidth = 1.4;
    graphics.circle(driverCenter.x, driverCenter.y, driverRadius * 1.05);
    graphics.stroke();
    drawLink(graphics, driverCenter, driverPin, INPUT_COLOR, 4);

    graphics.fillColor = new Color(62, 76, 90, 235);
    graphics.circle(wheelCenter.x, wheelCenter.y, wheelRadius);
    graphics.fill();
    graphics.strokeColor = OUTPUT_COLOR;
    graphics.lineWidth = 2;
    graphics.circle(wheelCenter.x, wheelCenter.y, wheelRadius);
    graphics.stroke();
    for (let slot = 0; slot < 6; slot += 1) {
        const angle = slot * Math.PI / 3;
        graphics.strokeColor = slot === 3 ? palette.accent : palette.backgroundRaised;
        graphics.lineWidth = slot === 3 ? 3 : 2;
        graphics.moveTo(
            wheelCenter.x + Math.cos(angle) * wheelRadius * 0.22,
            wheelCenter.y + Math.sin(angle) * wheelRadius * 0.22,
        );
        graphics.lineTo(
            wheelCenter.x + Math.cos(angle) * wheelRadius * 0.90,
            wheelCenter.y + Math.sin(angle) * wheelRadius * 0.90,
        );
        graphics.stroke();
    }
    drawJoint(graphics, driverCenter, 4);
    drawJoint(graphics, wheelCenter, 4.5);
    graphics.fillColor = palette.accent;
    graphics.circle(driverPin.x, driverPin.y, 3.8);
    graphics.fill();
}

function drawLink(
    graphics: Graphics,
    start: { readonly x: number; readonly y: number },
    end: { readonly x: number; readonly y: number },
    color: Color,
    width: number,
): void {
    graphics.strokeColor = color;
    graphics.lineWidth = width;
    graphics.moveTo(start.x, start.y);
    graphics.lineTo(end.x, end.y);
    graphics.stroke();
}

function drawJoint(
    graphics: Graphics,
    point: { readonly x: number; readonly y: number },
    radius: number,
): void {
    graphics.fillColor = palette.backgroundRaised;
    graphics.circle(point.x, point.y, radius);
    graphics.fill();
    graphics.strokeColor = palette.borderStrong;
    graphics.lineWidth = 1;
    graphics.circle(point.x, point.y, radius);
    graphics.stroke();
}

registerCatalogCover('slider-crank', drawMechanicalLinkages);
