import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../home/CatalogCovers';
import { createUiNode, palette } from '../../ui/UiFactory';
import { LorenzAttractorModel } from './lorenz-attractor/LorenzAttractorModel';
import { PlanarThreeBodyModel } from './restricted-three-body/RestrictedThreeBodyModel';

const TRAIL_COLORS = [
    new Color(126, 190, 166, 225),
    new Color(210, 167, 96, 210),
    new Color(151, 165, 211, 210),
] as const;
const BODY_COLORS = [
    new Color(126, 190, 166, 255),
    new Color(210, 167, 96, 255),
    new Color(151, 165, 211, 255),
] as const;

function drawLorenzAttractor(parent: Node, width: number, height: number): void {
    const model = new LorenzAttractorModel({
        sigma: 10,
        rho: 28,
        beta: 8 / 3,
    });
    model.reset(
        { x: 1, y: 1, z: 1 },
        { x: 1.00001, y: 1, z: 1 },
    );
    const primary = createGraphics(parent, 'LorenzCoverPrimary', width, height);
    const nearby = createGraphics(parent, 'LorenzCoverNearby', width, height);
    primary.strokeColor = TRAIL_COLORS[0];
    primary.lineWidth = Math.max(1.5, Math.min(width, height) * 0.0055);
    nearby.strokeColor = new Color(210, 167, 96, 145);
    nearby.lineWidth = Math.max(1, Math.min(width, height) * 0.0035);
    const scale = Math.min(width / 54, height / 58);
    let started = false;
    for (let index = 0; index < 3400; index += 1) {
        model.step(1 / 240);
        if (index < 420 || index % 3 !== 0) {
            continue;
        }
        const snapshot = model.snapshot();
        const primaryPoint = {
            x: snapshot.primary.x * scale,
            y: (snapshot.primary.z - 25) * scale,
        };
        const nearbyPoint = {
            x: snapshot.shadow.x * scale,
            y: (snapshot.shadow.z - 25) * scale,
        };
        if (!started) {
            primary.moveTo(primaryPoint.x, primaryPoint.y);
            nearby.moveTo(nearbyPoint.x, nearbyPoint.y);
            started = true;
        } else {
            primary.lineTo(primaryPoint.x, primaryPoint.y);
            nearby.lineTo(nearbyPoint.x, nearbyPoint.y);
        }
    }
    nearby.stroke();
    primary.stroke();
}

function drawPlanarThreeBody(
    parent: Node,
    width: number,
    height: number,
): void {
    const model = new PlanarThreeBodyModel({
        gravity: 1,
        softening: 0.015,
    });
    model.reset(PlanarThreeBodyModel.createPreset(
        'hierarchical-triple',
        [1, 1, 1],
        1,
        1,
    ));
    const trails: Array<Array<{ x: number; y: number }>> = [[], [], []];
    for (let index = 0; index < 4200; index += 1) {
        model.step(1 / 600);
        if (index % 5 !== 0) {
            continue;
        }
        model.snapshot().bodies.forEach((body, bodyIndex) => {
            trails[bodyIndex].push({ x: body.x, y: body.y });
        });
    }
    let span = 1.15;
    for (const trail of trails) {
        for (const point of trail) {
            span = Math.max(span, Math.abs(point.x), Math.abs(point.y));
        }
    }
    const scale = Math.min(width, height) / (span * 2.12);
    const project = (point: { x: number; y: number }) => ({
        x: point.x * scale,
        y: point.y * scale,
    });
    const center = createGraphics(parent, 'ThreeBodyCoverCenter', width, height);
    center.strokeColor = palette.subtle;
    center.lineWidth = Math.max(1, Math.min(width, height) * 0.0035);
    center.circle(0, 0, Math.max(4, Math.min(width, height) * 0.015));
    center.moveTo(-8, 0);
    center.lineTo(8, 0);
    center.moveTo(0, -8);
    center.lineTo(0, 8);
    center.stroke();

    trails.forEach((trail, bodyIndex) => {
        const graphics = createGraphics(
            parent,
            `ThreeBodyCoverTrail${bodyIndex + 1}`,
            width,
            height,
        );
        graphics.strokeColor = TRAIL_COLORS[bodyIndex] ?? TRAIL_COLORS[0];
        graphics.lineWidth = Math.max(1.4, Math.min(width, height) * 0.005);
        trail.forEach((point, index) => {
            const projected = project(point);
            if (index === 0) {
                graphics.moveTo(projected.x, projected.y);
            } else {
                graphics.lineTo(projected.x, projected.y);
            }
        });
        graphics.stroke();
    });

    const bodies = createGraphics(parent, 'ThreeBodyCoverBodies', width, height);
    const unit = Math.min(width, height);
    model.snapshot().bodies.forEach((body, index) => {
        const projected = project(body);
        bodies.fillColor = BODY_COLORS[index] ?? BODY_COLORS[0];
        bodies.circle(projected.x, projected.y, Math.max(5, unit * 0.022));
        bodies.fill();
    });
}

function createGraphics(
    parent: Node,
    name: string,
    width: number,
    height: number,
): Graphics {
    return createUiNode(parent, name, width, height).addComponent(Graphics);
}

registerCatalogCover('lorenz-attractor', drawLorenzAttractor);
registerCatalogCover('restricted-three-body', drawPlanarThreeBody);
