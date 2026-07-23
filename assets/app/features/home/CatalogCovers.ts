import { Color, Graphics, Node } from 'cc';
import { createUiNode, palette } from '../../ui/UiFactory';

export type CatalogCoverKind =
    | 'mathematics'
    | 'physics'
    | 'parametric-curve'
    | 'double-pendulum';

const coverAccent = new Color(126, 158, 143, 235);
const coverAccentSoft = new Color(126, 158, 143, 125);
const coverAccentStrong = new Color(142, 174, 159, 255);

export function drawCatalogCover(
    parent: Node,
    kind: CatalogCoverKind,
    width: number,
    height: number,
): Node {
    const root = createUiNode(parent, `Cover:${kind}`, width, height);

    if (kind === 'mathematics') {
        drawMathematics(root, width, height);
    } else if (kind === 'physics') {
        drawPhysics(root, width, height);
    } else if (kind === 'parametric-curve') {
        drawParametricCurve(root, width, height);
    } else {
        drawDoublePendulum(root, width, height);
    }

    return root;
}

function drawMathematics(parent: Node, width: number, height: number): void {
    const unit = Math.min(width, height);
    const radius = unit * 0.30;
    const centerY = 10;

    const guide = createGraphics(parent, 'MathematicsGuide', width, height);
    guide.strokeColor = palette.subtle;
    guide.lineWidth = Math.max(1.25, unit * 0.0045);
    guide.circle(0, centerY, radius);
    guide.moveTo(-radius * 1.18, centerY);
    guide.lineTo(radius * 1.18, centerY);
    guide.moveTo(0, centerY - radius * 1.18);
    guide.lineTo(0, centerY + radius * 1.18);
    guide.stroke();

    const curve = createGraphics(parent, 'MathematicsCurve', width, height);
    curve.strokeColor = coverAccent;
    curve.lineWidth = Math.max(1.75, unit * 0.0065);

    for (let index = 0; index <= 128; index += 1) {
        const t = index / 128 * Math.PI * 2;
        const x = Math.sin(3 * t + 0.7) * radius * 0.94;
        const y = centerY + Math.sin(2 * t) * radius * 0.94;

        if (index === 0) {
            curve.moveTo(x, y);
        } else {
            curve.lineTo(x, y);
        }
    }

    curve.stroke();

    const marker = createGraphics(parent, 'MathematicsMarker', width, height);
    marker.fillColor = palette.text;
    marker.circle(radius * 0.62, centerY - radius * 0.28, Math.max(3.5, unit * 0.014));
    marker.fill();
}

function drawPhysics(parent: Node, width: number, height: number): void {
    const unit = Math.min(width, height);
    const radius = unit * 0.31;
    const centerY = 10;

    const orbit = createGraphics(parent, 'PhysicsOrbit', width, height);
    orbit.strokeColor = palette.subtle;
    orbit.lineWidth = Math.max(1.25, unit * 0.0045);
    orbit.circle(0, centerY, radius);
    orbit.stroke();

    const trail = createGraphics(parent, 'PhysicsTrail', width, height);
    trail.strokeColor = coverAccentSoft;
    trail.lineWidth = Math.max(1.25, unit * 0.0045);

    for (let index = 0; index < 9; index += 1) {
        const start = -0.24 + index * 0.115;
        const end = start + 0.065;
        trail.moveTo(Math.cos(start) * radius, centerY + Math.sin(start) * radius);
        trail.lineTo(Math.cos(end) * radius, centerY + Math.sin(end) * radius);
    }

    trail.stroke();

    const center = createGraphics(parent, 'PhysicsCenter', width, height);
    center.fillColor = palette.text;
    center.circle(0, centerY, Math.max(2.75, unit * 0.010));
    center.fill();

    const movingPoint = createGraphics(parent, 'PhysicsMovingPoint', width, height);
    movingPoint.fillColor = coverAccentStrong;
    movingPoint.circle(
        Math.cos(0.76) * radius,
        centerY + Math.sin(0.76) * radius,
        Math.max(5.5, unit * 0.021),
    );
    movingPoint.fill();
}

function drawParametricCurve(parent: Node, width: number, height: number): void {
    const unit = Math.min(width, height);
    const scaleX = unit * 0.34;
    const scaleY = unit * 0.29;

    const axes = createGraphics(parent, 'ParametricAxes', width, height);
    axes.strokeColor = palette.border;
    axes.lineWidth = Math.max(1.25, unit * 0.004);
    axes.moveTo(-scaleX * 1.16, 0);
    axes.lineTo(scaleX * 1.16, 0);
    axes.moveTo(0, -scaleY * 1.16);
    axes.lineTo(0, scaleY * 1.16);
    axes.stroke();

    const curve = createGraphics(parent, 'ParametricLine', width, height);
    curve.strokeColor = coverAccent;
    curve.lineWidth = Math.max(1.75, unit * 0.0065);

    for (let index = 0; index <= 160; index += 1) {
        const t = index / 160 * Math.PI * 2;
        const x = Math.sin(3 * t + 0.65) * scaleX;
        const y = Math.sin(2 * t) * scaleY;

        if (index === 0) {
            curve.moveTo(x, y);
        } else {
            curve.lineTo(x, y);
        }
    }

    curve.stroke();
}

function drawDoublePendulum(parent: Node, width: number, height: number): void {
    const unit = Math.min(width, height);
    const length1 = unit * 0.25;
    const length2 = unit * 0.29;
    const theta1 = 0.52;
    const theta2 = 0.88;
    const pivotY = unit * 0.23;
    const x1 = Math.sin(theta1) * length1;
    const y1 = pivotY - Math.cos(theta1) * length1;
    const x2 = x1 + Math.sin(theta2) * length2;
    const y2 = y1 - Math.cos(theta2) * length2;

    const path = createGraphics(parent, 'PendulumPath', width, height);
    path.strokeColor = coverAccentSoft;
    path.lineWidth = Math.max(1.25, unit * 0.004);

    for (let index = 0; index < 8; index += 1) {
        const angleA = -1.36 + index * 0.115;
        const angleB = angleA + 0.064;
        const radius = length2 * 0.76;
        path.moveTo(x1 + Math.sin(angleA) * radius, y1 - Math.cos(angleA) * radius);
        path.lineTo(x1 + Math.sin(angleB) * radius, y1 - Math.cos(angleB) * radius);
    }

    path.stroke();

    const rods = createGraphics(parent, 'PendulumRods', width, height);
    rods.strokeColor = palette.text;
    rods.lineWidth = Math.max(1.75, unit * 0.006);
    rods.moveTo(0, pivotY);
    rods.lineTo(x1, y1);
    rods.lineTo(x2, y2);
    rods.stroke();

    const pivot = createGraphics(parent, 'PendulumPivot', width, height);
    pivot.fillColor = palette.surface;
    pivot.strokeColor = palette.text;
    pivot.lineWidth = Math.max(1.25, unit * 0.0045);
    pivot.circle(0, pivotY, Math.max(5, unit * 0.017));
    pivot.fill();
    pivot.stroke();

    const firstMass = createGraphics(parent, 'PendulumFirstMass', width, height);
    firstMass.fillColor = palette.surface;
    firstMass.strokeColor = coverAccentStrong;
    firstMass.lineWidth = Math.max(1.25, unit * 0.0045);
    firstMass.circle(x1, y1, Math.max(6, unit * 0.021));
    firstMass.fill();
    firstMass.stroke();

    const secondMass = createGraphics(parent, 'PendulumSecondMass', width, height);
    secondMass.fillColor = coverAccentStrong;
    secondMass.circle(x2, y2, Math.max(7, unit * 0.026));
    secondMass.fill();
}

function createGraphics(parent: Node, name: string, width: number, height: number): Graphics {
    return createUiNode(parent, name, width, height).addComponent(Graphics);
}
