import { Color, Graphics, Node } from 'cc';
import {
    registerCatalogCover,
} from '../home/CatalogCovers';
import { createUiNode, palette } from '../../ui/UiFactory';
import { LorenzAttractorModel } from './lorenz-attractor/LorenzAttractorModel';
import { RestrictedThreeBodyModel } from './restricted-three-body/RestrictedThreeBodyModel';

const PRIMARY_TRAIL = new Color(126, 158, 143, 230);
const SECONDARY_TRAIL = new Color(181, 149, 95, 145);
const PRIMARY_BODY = new Color(215, 221, 207, 255);
const SECONDARY_BODY = new Color(181, 149, 95, 255);
const THIRD_BODY = new Color(126, 190, 166, 255);

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
    const secondary = createGraphics(parent, 'LorenzCoverNearby', width, height);
    primary.strokeColor = PRIMARY_TRAIL;
    primary.lineWidth = Math.max(1.5, Math.min(width, height) * 0.0055);
    secondary.strokeColor = SECONDARY_TRAIL;
    secondary.lineWidth = Math.max(1, Math.min(width, height) * 0.0035);

    const scale = Math.min(width / 54, height / 58);
    let started = false;
    for (let index = 0; index < 5200; index += 1) {
        model.step(1 / 240);
        if (index < 600 || index % 4 !== 0) {
            continue;
        }
        const snapshot = model.snapshot();
        const primaryX = snapshot.primary.x * scale;
        const primaryY = (snapshot.primary.z - 25) * scale;
        const shadowX = snapshot.shadow.x * scale;
        const shadowY = (snapshot.shadow.z - 25) * scale;
        if (!started) {
            primary.moveTo(primaryX, primaryY);
            secondary.moveTo(shadowX, shadowY);
            started = true;
        } else {
            primary.lineTo(primaryX, primaryY);
            secondary.lineTo(shadowX, shadowY);
        }
    }
    secondary.stroke();
    primary.stroke();

    const marker = createGraphics(parent, 'LorenzCoverMarker', width, height);
    const current = model.snapshot().primary;
    marker.fillColor = palette.text;
    marker.circle(
        current.x * scale,
        (current.z - 25) * scale,
        Math.max(3.5, Math.min(width, height) * 0.014),
    );
    marker.fill();
}

function drawRestrictedThreeBody(
    parent: Node,
    width: number,
    height: number,
): void {
    const model = new RestrictedThreeBodyModel({ mu: 0.01215 });
    model.reset({ x: 0.82, y: 0, vx: 0, vy: 0.18 });
    const samples: Array<{ x: number; y: number }> = [];

    for (let index = 0; index < 12000; index += 1) {
        model.step(1 / 720);
        if (index % 8 === 0) {
            const state = model.snapshot().state;
            samples.push({ x: state.x, y: state.y });
        }
        if (model.snapshot().status !== 'active') {
            break;
        }
    }

    let span = 1.12;
    for (const point of samples) {
        span = Math.max(span, Math.abs(point.x), Math.abs(point.y));
    }
    span = Math.min(3.8, span * 1.1);
    const scale = Math.min(width, height) / (span * 2.08);
    const project = (point: { x: number; y: number }) => ({
        x: point.x * scale,
        y: point.y * scale,
    });

    const guide = createGraphics(parent, 'ThreeBodyCoverGuide', width, height);
    const primary = project(model.primaryPosition);
    const secondary = project(model.secondaryPosition);
    guide.strokeColor = palette.subtle;
    guide.lineWidth = Math.max(1, Math.min(width, height) * 0.0035);
    guide.moveTo(primary.x, primary.y);
    guide.lineTo(secondary.x, secondary.y);
    guide.stroke();

    const trail = createGraphics(parent, 'ThreeBodyCoverTrail', width, height);
    trail.strokeColor = PRIMARY_TRAIL;
    trail.lineWidth = Math.max(1.5, Math.min(width, height) * 0.0055);
    samples.forEach((point, index) => {
        const projected = project(point);
        if (index === 0) {
            trail.moveTo(projected.x, projected.y);
        } else {
            trail.lineTo(projected.x, projected.y);
        }
    });
    trail.stroke();

    const bodies = createGraphics(parent, 'ThreeBodyCoverBodies', width, height);
    const unit = Math.min(width, height);
    bodies.fillColor = PRIMARY_BODY;
    bodies.circle(primary.x, primary.y, Math.max(8, unit * 0.04));
    bodies.fill();
    bodies.fillColor = SECONDARY_BODY;
    bodies.circle(secondary.x, secondary.y, Math.max(5, unit * 0.024));
    bodies.fill();

    const current = project(model.snapshot().state);
    bodies.fillColor = THIRD_BODY;
    bodies.circle(current.x, current.y, Math.max(4, unit * 0.018));
    bodies.fill();
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
registerCatalogCover('restricted-three-body', drawRestrictedThreeBody);
