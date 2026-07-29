import { Color, Graphics, Node } from 'cc';
import type { CatalogCoverId } from '../../contracts/InteractiveModule';
import { createUiNode, palette } from '../../ui/UiFactory';

export type CatalogCoverKind = CatalogCoverId;
export type CatalogCoverRenderer = (
    parent: Node,
    width: number,
    height: number,
) => void;

const coverRenderers = new Map<CatalogCoverId, CatalogCoverRenderer>();
const coverAccent = new Color(126, 158, 143, 235);
const coverAccentSoft = new Color(126, 158, 143, 125);
const coverAccentStrong = new Color(142, 174, 159, 255);
const coverWarning = new Color(181, 149, 95, 220);

export function registerCatalogCover(
    id: CatalogCoverId,
    renderer: CatalogCoverRenderer,
): void {
    const normalizedId = id.trim();
    if (!normalizedId) {
        throw new Error('Catalog cover id must be a non-empty string.');
    }
    if (coverRenderers.has(normalizedId)) {
        throw new Error(`Catalog cover already registered: ${normalizedId}`);
    }
    coverRenderers.set(normalizedId, renderer);
}

export function drawCatalogCover(
    parent: Node,
    kind: CatalogCoverId,
    width: number,
    height: number,
): Node {
    const root = createUiNode(parent, `Cover:${kind}`, width, height);
    const renderer = coverRenderers.get(kind) ?? coverRenderers.get('games');
    if (!renderer) {
        throw new Error(`No catalog cover renderer registered for: ${kind}`);
    }
    renderer(root, width, height);
    return root;
}

function registerBuiltInCatalogCovers(): void {
    registerCatalogCover('mathematics', drawMathematics);
    registerCatalogCover('physics', drawPhysics);
    registerCatalogCover('games', (parent, width, height) => {
        drawCursorSpace(parent, width, height, false);
    });
    registerCatalogCover('lissajous', drawLissajous);
    registerCatalogCover('double-pendulum', drawDoublePendulum);
    registerCatalogCover('cursor-space', (parent, width, height) => {
        drawCursorSpace(parent, width, height, true);
    });
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

function drawCursorSpace(
    parent: Node,
    width: number,
    height: number,
    showProjectiles: boolean,
): void {
    const unit = Math.max(1, Math.min(width, height));
    const scale = unit * 0.018;
    const shipX = -unit * 0.12;
    const shipY = -unit * 0.03;
    const rotation = 0.42;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const pointer = [
        [16, 0],
        [-9, 10],
        [-5, 2],
        [-13, -3],
        [-11, -7],
        [-3, -2],
        [-3, -10],
    ] as const;
    const ship = createGraphics(parent, 'CursorShip', width, height);
    ship.fillColor = coverAccentStrong;
    ship.strokeColor = palette.text;
    ship.lineWidth = Math.max(1.2, unit * 0.0045);

    for (let index = 0; index < pointer.length; index += 1) {
        const [localX, localY] = pointer[index];
        const x = shipX + (localX * cosine - localY * sine) * scale;
        const y = shipY + (localX * sine + localY * cosine) * scale;
        if (index === 0) {
            ship.moveTo(x, y);
        } else {
            ship.lineTo(x, y);
        }
    }

    const [firstX, firstY] = pointer[0];
    ship.lineTo(
        shipX + (firstX * cosine - firstY * sine) * scale,
        shipY + (firstX * sine + firstY * cosine) * scale,
    );
    ship.fill();
    ship.stroke();

    const enemies = createGraphics(parent, 'CursorEnemies', width, height);
    enemies.fillColor = coverWarning;
    const enemyRadius = Math.max(4, unit * 0.022);
    const enemyPositions = [
        [unit * 0.23, unit * 0.19],
        [unit * 0.29, -unit * 0.15],
        [-unit * 0.31, unit * 0.23],
    ] as const;
    for (const [x, y] of enemyPositions) {
        enemies.moveTo(x + enemyRadius, y);
        enemies.lineTo(x - enemyRadius * 0.75, y + enemyRadius * 0.68);
        enemies.lineTo(x - enemyRadius * 0.42, y);
        enemies.lineTo(x - enemyRadius * 0.75, y - enemyRadius * 0.68);
        enemies.lineTo(x + enemyRadius, y);
    }
    enemies.fill();

    if (!showProjectiles) {
        return;
    }
    const projectiles = createGraphics(parent, 'CursorProjectiles', width, height);
    projectiles.strokeColor = palette.text;
    projectiles.lineWidth = Math.max(1.4, unit * 0.005);
    for (let index = 0; index < 3; index += 1) {
        const offset = index * unit * 0.075;
        projectiles.moveTo(shipX + unit * 0.12 + offset, shipY + unit * 0.075 + offset * 0.22);
        projectiles.lineTo(shipX + unit * 0.17 + offset, shipY + unit * 0.095 + offset * 0.22);
    }
    projectiles.stroke();
}

function drawLissajous(parent: Node, width: number, height: number): void {
    const unit = Math.min(width, height);
    const scaleX = unit * 0.34;
    const scaleY = unit * 0.29;

    const axes = createGraphics(parent, 'LissajousAxes', width, height);
    axes.strokeColor = palette.border;
    axes.lineWidth = Math.max(1.25, unit * 0.004);
    axes.moveTo(-scaleX * 1.16, 0);
    axes.lineTo(scaleX * 1.16, 0);
    axes.moveTo(0, -scaleY * 1.16);
    axes.lineTo(0, scaleY * 1.16);
    axes.stroke();

    const curve = createGraphics(parent, 'LissajousLine', width, height);
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

registerBuiltInCatalogCovers();
