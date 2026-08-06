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
    const cellWidth = width / 2;
    const cellHeight = height * 0.40;
    const size = Math.max(16, Math.min(cellWidth * 0.62, cellHeight * 0.78));
    const topY = height * 0.22;
    const bottomY = -height * 0.17;

    drawSliderCrank(graphics, -cellWidth / 2, topY, size);
    drawFourBar(graphics, cellWidth / 2, topY, size);
    drawGeneva(graphics, -cellWidth / 2, bottomY, size);
    drawCam(graphics, cellWidth / 2, bottomY, size);

    graphics.strokeColor = palette.border;
    graphics.lineWidth = 1;
    graphics.moveTo(0, -height * 0.34);
    graphics.lineTo(0, height * 0.39);
    graphics.moveTo(-width * 0.46, height * 0.015);
    graphics.lineTo(width * 0.46, height * 0.015);
    graphics.stroke();

    const tabWidth = Math.max(10, width * 0.075);
    const gap = Math.max(3, width * 0.012);
    const total = tabWidth * 8 + gap * 7;
    const firstX = -total / 2 + tabWidth / 2;
    for (let index = 0; index < 8; index += 1) {
        graphics.fillColor = index === 0 ? palette.accent : palette.surfaceStrong;
        graphics.roundRect(
            firstX + index * (tabWidth + gap) - tabWidth / 2,
            -height * 0.46,
            tabWidth,
            5,
            2.5,
        );
        graphics.fill();
    }
}

function drawSliderCrank(
    graphics: Graphics,
    centerX: number,
    centerY: number,
    size: number,
): void {
    const radius = size * 0.19;
    const crankCenter = { x: centerX - size * 0.27, y: centerY };
    const angle = 52 * Math.PI / 180;
    const crankPin = {
        x: crankCenter.x + Math.cos(angle) * radius,
        y: crankCenter.y + Math.sin(angle) * radius,
    };
    const sliderPin = { x: centerX + size * 0.31, y: centerY };
    graphics.strokeColor = palette.borderStrong;
    graphics.lineWidth = 1.2;
    graphics.circle(crankCenter.x, crankCenter.y, radius);
    graphics.moveTo(centerX + size * 0.10, centerY + size * 0.11);
    graphics.lineTo(centerX + size * 0.46, centerY + size * 0.11);
    graphics.moveTo(centerX + size * 0.10, centerY - size * 0.11);
    graphics.lineTo(centerX + size * 0.46, centerY - size * 0.11);
    graphics.stroke();
    drawLink(graphics, crankCenter, crankPin, INPUT_COLOR, 3.5);
    drawLink(graphics, crankPin, sliderPin, COUPLER_COLOR, 4.5);
    graphics.fillColor = OUTPUT_COLOR;
    graphics.rect(
        sliderPin.x - size * 0.07,
        sliderPin.y - size * 0.09,
        size * 0.14,
        size * 0.18,
    );
    graphics.fill();
    drawJoint(graphics, crankCenter, 3.5);
    drawJoint(graphics, crankPin, 3);
    drawJoint(graphics, sliderPin, 3);
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
    const couplerPin = { x: centerX + size * 0.25, y: centerY + size * 0.29 };
    drawLink(graphics, fixedInput, fixedOutput, palette.borderStrong, 3.5);
    drawLink(graphics, fixedInput, crankPin, INPUT_COLOR, 4.5);
    drawLink(graphics, crankPin, couplerPin, COUPLER_COLOR, 4.5);
    drawLink(graphics, fixedOutput, couplerPin, OUTPUT_COLOR, 4.5);
    drawJoint(graphics, fixedInput, 3.5);
    drawJoint(graphics, fixedOutput, 3.5);
    drawJoint(graphics, crankPin, 3);
    drawJoint(graphics, couplerPin, 3);
}

function drawGeneva(
    graphics: Graphics,
    centerX: number,
    centerY: number,
    size: number,
): void {
    const driverCenter = { x: centerX - size * 0.24, y: centerY };
    const wheelCenter = { x: centerX + size * 0.22, y: centerY };
    const driverRadius = size * 0.20;
    const wheelRadius = size * 0.27;
    const driverPin = {
        x: driverCenter.x + driverRadius * 0.97,
        y: driverCenter.y + driverRadius * 0.18,
    };
    graphics.strokeColor = palette.border;
    graphics.lineWidth = 1.2;
    graphics.circle(driverCenter.x, driverCenter.y, driverRadius * 1.05);
    graphics.stroke();
    drawLink(graphics, driverCenter, driverPin, INPUT_COLOR, 3.5);
    graphics.fillColor = new Color(62, 76, 90, 235);
    graphics.circle(wheelCenter.x, wheelCenter.y, wheelRadius);
    graphics.fill();
    graphics.strokeColor = OUTPUT_COLOR;
    graphics.lineWidth = 1.8;
    graphics.circle(wheelCenter.x, wheelCenter.y, wheelRadius);
    graphics.stroke();
    for (let slot = 0; slot < 6; slot += 1) {
        const angle = slot * Math.PI / 3;
        graphics.strokeColor = slot === 3 ? palette.accent : palette.backgroundRaised;
        graphics.lineWidth = slot === 3 ? 2.8 : 1.8;
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
    drawJoint(graphics, driverCenter, 3.5);
    drawJoint(graphics, wheelCenter, 4);
    graphics.fillColor = palette.accent;
    graphics.circle(driverPin.x, driverPin.y, 3.2);
    graphics.fill();
}

function drawCam(
    graphics: Graphics,
    centerX: number,
    centerY: number,
    size: number,
): void {
    const base = size * 0.24;
    const lift = size * 0.12;
    const rotation = 0.65;
    graphics.fillColor = new Color(55, 75, 88, 235);
    for (let index = 0; index <= 64; index += 1) {
        const angle = Math.PI * 2 * index / 64;
        const radius = base + lift * (0.5 + 0.5 * Math.cos(angle - rotation));
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (index === 0) graphics.moveTo(x, y);
        else graphics.lineTo(x, y);
    }
    graphics.close();
    graphics.fill();
    graphics.strokeColor = INPUT_COLOR;
    graphics.lineWidth = 1.8;
    for (let index = 0; index <= 64; index += 1) {
        const angle = Math.PI * 2 * index / 64;
        const radius = base + lift * (0.5 + 0.5 * Math.cos(angle - rotation));
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (index === 0) graphics.moveTo(x, y);
        else graphics.lineTo(x, y);
    }
    graphics.close();
    graphics.stroke();
    const followerY = centerY + base + lift * 1.08;
    graphics.fillColor = OUTPUT_COLOR;
    graphics.circle(centerX, followerY, size * 0.055);
    graphics.fill();
    drawLink(
        graphics,
        { x: centerX, y: followerY },
        { x: centerX, y: followerY + size * 0.22 },
        OUTPUT_COLOR,
        4,
    );
    drawJoint(graphics, { x: centerX, y: centerY }, 4);
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

registerCatalogCover('mechanical-linkages', drawMechanicalLinkages);
