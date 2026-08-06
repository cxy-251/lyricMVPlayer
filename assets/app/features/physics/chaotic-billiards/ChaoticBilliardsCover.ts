import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode, palette } from '../../../ui/UiFactory';
import { ChaoticBilliardsModel } from './ChaoticBilliardsModel';
import type { BilliardVector } from './ChaoticBilliardsTypes';

const PRIMARY = new Color(126, 190, 166, 220);
const NEARBY = new Color(210, 167, 96, 190);

function drawChaoticBilliards(parent: Node, width: number, height: number): void {
    const halfLength = 1.1;
    const radius = 1;
    const model = new ChaoticBilliardsModel({
        boundary: 'stadium',
        radius,
        straightHalfLength: halfLength,
        particleSpeed: 1,
    });
    model.reset(0.8, 10 * Math.PI / 180, 0.001 * Math.PI / 180);

    const primaryTrail: BilliardVector[] = [];
    const nearbyTrail: BilliardVector[] = [];
    for (let index = 0; index < 1800; index += 1) {
        model.step(1 / 120);
        if (index % 3 === 0) {
            const snapshot = model.snapshot();
            primaryTrail.push(snapshot.primary);
            nearbyTrail.push(snapshot.nearby);
        }
    }

    const scale = Math.min(
        (width - 34) / (2 * (halfLength + radius)),
        (height - 34) / (2 * radius),
    );
    const project = (point: BilliardVector) => ({
        x: point.x * scale,
        y: point.y * scale,
    });

    const boundary = createUiNode(
        parent,
        'ChaoticBilliardsCoverBoundary',
        width,
        height,
    ).addComponent(Graphics);
    boundary.strokeColor = palette.borderStrong;
    boundary.lineWidth = Math.max(1.5, Math.min(width, height) * 0.006);
    const points = stadiumBoundary(halfLength, radius);
    points.forEach((point, index) => {
        const projected = project(point);
        if (index === 0) {
            boundary.moveTo(projected.x, projected.y);
        } else {
            boundary.lineTo(projected.x, projected.y);
        }
    });
    const first = project(points[0]);
    boundary.lineTo(first.x, first.y);
    boundary.stroke();

    drawTrail(
        parent,
        'ChaoticBilliardsCoverPrimary',
        primaryTrail,
        PRIMARY,
        scale,
        width,
        height,
        1.8,
    );
    drawTrail(
        parent,
        'ChaoticBilliardsCoverNearby',
        nearbyTrail,
        NEARBY,
        scale,
        width,
        height,
        1.4,
    );

    const particles = createUiNode(
        parent,
        'ChaoticBilliardsCoverParticles',
        width,
        height,
    ).addComponent(Graphics);
    const snapshot = model.snapshot();
    const primary = project(snapshot.primary);
    const nearby = project(snapshot.nearby);

    particles.strokeColor = palette.warning;
    particles.lineWidth = 1;
    particles.moveTo(primary.x, primary.y);
    particles.lineTo(nearby.x, nearby.y);
    particles.stroke();

    particles.fillColor = PRIMARY;
    particles.circle(primary.x, primary.y, Math.max(4, Math.min(width, height) * 0.016));
    particles.fill();
    particles.fillColor = NEARBY;
    particles.circle(nearby.x, nearby.y, Math.max(3, Math.min(width, height) * 0.012));
    particles.fill();
}

function drawTrail(
    parent: Node,
    name: string,
    points: readonly BilliardVector[],
    color: Color,
    scale: number,
    width: number,
    height: number,
    lineWidth: number,
): void {
    const graphics = createUiNode(parent, name, width, height).addComponent(Graphics);
    graphics.strokeColor = color;
    graphics.lineWidth = lineWidth;
    points.forEach((point, index) => {
        const x = point.x * scale;
        const y = point.y * scale;
        if (index === 0) {
            graphics.moveTo(x, y);
        } else {
            graphics.lineTo(x, y);
        }
    });
    graphics.stroke();
}

function stadiumBoundary(
    halfLength: number,
    radius: number,
): BilliardVector[] {
    const points: BilliardVector[] = [
        { x: -halfLength, y: radius },
        { x: halfLength, y: radius },
    ];
    for (let index = 1; index <= 40; index += 1) {
        const angle = Math.PI / 2 - Math.PI * index / 40;
        points.push({
            x: halfLength + Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
        });
    }
    points.push({ x: -halfLength, y: -radius });
    for (let index = 1; index <= 40; index += 1) {
        const angle = -Math.PI / 2 - Math.PI * index / 40;
        points.push({
            x: -halfLength + Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
        });
    }
    return points;
}

registerCatalogCover('chaotic-billiards', drawChaoticBilliards);
