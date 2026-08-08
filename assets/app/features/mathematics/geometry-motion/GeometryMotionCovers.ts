import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode } from '../../../ui/UiFactory';

const PAPER = new Color(237, 231, 216, 225);
const PAPER_SOFT = new Color(237, 231, 216, 70);
const CYAN = new Color(79, 214, 226, 240);
const CORAL = new Color(255, 108, 105, 255);

function layer(parent: Node, name: string, width: number, height: number): Graphics {
    return createUiNode(parent, name, width, height).addComponent(Graphics);
}

registerCatalogCover('geometry-triangle-motion', (parent, width, height) => {
    const unit = Math.min(width, height);
    const a = { x: -unit * 0.28, y: -unit * 0.22 };
    const b = { x: unit * 0.29, y: -unit * 0.18 };
    const c = { x: unit * 0.05, y: unit * 0.28 };
    const geometry = layer(parent, 'TriangleMotionCover', width, height);
    geometry.strokeColor = PAPER;
    geometry.lineWidth = Math.max(1.5, unit * 0.006);
    geometry.moveTo(a.x, a.y);
    geometry.lineTo(b.x, b.y);
    geometry.lineTo(c.x, c.y);
    geometry.lineTo(a.x, a.y);
    geometry.stroke();
    geometry.strokeColor = CYAN;
    geometry.lineWidth = Math.max(1.4, unit * 0.005);
    geometry.moveTo(-unit * 0.22, unit * 0.04);
    geometry.lineTo(unit * 0.24, -unit * 0.02);
    geometry.stroke();
    [a, b, c].forEach((point, index) => {
        geometry.fillColor = index === 2 ? CORAL : PAPER;
        geometry.circle(point.x, point.y, Math.max(4, unit * 0.016));
        geometry.fill();
    });
});

registerCatalogCover('geometry-circle-motion', (parent, width, height) => {
    const unit = Math.min(width, height);
    const radius = unit * 0.26;
    const geometry = layer(parent, 'CircleMotionCover', width, height);
    geometry.strokeColor = PAPER;
    geometry.lineWidth = Math.max(1.5, unit * 0.006);
    geometry.circle(0, 0, radius);
    geometry.stroke();
    geometry.strokeColor = CYAN;
    geometry.moveTo(-radius * 0.92, radius * 0.45);
    geometry.lineTo(radius * 0.88, -radius * 0.52);
    geometry.stroke();
    geometry.fillColor = CORAL;
    geometry.circle(radius * 0.88, -radius * 0.52, Math.max(4, unit * 0.017));
    geometry.fill();
});

registerCatalogCover('geometry-motion-curves', (parent, width, height) => {
    const unit = Math.min(width, height);
    const scaleX = unit * 0.31;
    const scaleY = unit * 0.26;
    const geometry = layer(parent, 'MotionCurvesCover', width, height);
    geometry.strokeColor = PAPER_SOFT;
    geometry.lineWidth = Math.max(1, unit * 0.004);
    geometry.moveTo(-scaleX * 1.12, 0);
    geometry.lineTo(scaleX * 1.12, 0);
    geometry.moveTo(0, -scaleY * 1.12);
    geometry.lineTo(0, scaleY * 1.12);
    geometry.stroke();
    geometry.strokeColor = CYAN;
    geometry.lineWidth = Math.max(1.6, unit * 0.0065);
    for (let index = 0; index <= 180; index += 1) {
        const t = index / 180 * Math.PI * 2;
        const x = Math.sin(3 * t + 0.6) * scaleX;
        const y = Math.sin(2 * t) * scaleY;
        if (index === 0) {
            geometry.moveTo(x, y);
        } else {
            geometry.lineTo(x, y);
        }
    }
    geometry.stroke();
    geometry.fillColor = CORAL;
    geometry.circle(scaleX * 0.76, -scaleY * 0.42, Math.max(4, unit * 0.017));
    geometry.fill();
});
