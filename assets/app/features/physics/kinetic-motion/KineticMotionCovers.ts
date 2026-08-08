import { Color, Graphics, Node } from 'cc';
import { registerCatalogCover } from '../../home/CatalogCovers';
import { createUiNode } from '../../../ui/UiFactory';

const TRACK = new Color(241, 232, 210, 225);
const TRACK_SOFT = new Color(241, 232, 210, 70);
const AMBER = new Color(255, 177, 59, 255);
const RED = new Color(228, 86, 60, 255);
const CYAN = new Color(98, 183, 198, 225);

function layer(parent: Node, name: string, width: number, height: number): Graphics {
    return createUiNode(parent, name, width, height).addComponent(Graphics);
}

registerCatalogCover('mechanics-kinetic-tracks', (parent, width, height) => {
    const unit = Math.min(width, height);
    const span = unit * 0.72;
    const graphics = layer(parent, 'KineticTracksCover', width, height);
    graphics.strokeColor = TRACK_SOFT;
    graphics.lineWidth = Math.max(5, unit * 0.02);
    for (let index = 0; index <= 100; index += 1) {
        const t = index / 100;
        const x = -span / 2 + span * t;
        const y = Math.sin(t * Math.PI * 2.4) * unit * 0.13;
        if (index === 0) {
            graphics.moveTo(x, y);
        } else {
            graphics.lineTo(x, y);
        }
    }
    graphics.stroke();
    graphics.strokeColor = TRACK;
    graphics.lineWidth = Math.max(1.5, unit * 0.006);
    for (let index = 0; index <= 100; index += 1) {
        const t = index / 100;
        const x = -span / 2 + span * t;
        const y = Math.sin(t * Math.PI * 2.4) * unit * 0.13;
        if (index === 0) {
            graphics.moveTo(x, y);
        } else {
            graphics.lineTo(x, y);
        }
    }
    graphics.stroke();
    graphics.fillColor = AMBER;
    graphics.circle(unit * 0.12, unit * 0.095, Math.max(5, unit * 0.021));
    graphics.fill();
});

registerCatalogCover('mechanics-oscillators', (parent, width, height) => {
    const unit = Math.min(width, height);
    const graphics = layer(parent, 'OscillatorsCover', width, height);
    const count = 7;
    for (let index = 0; index < count; index += 1) {
        const pivotX = (index - 3) * unit * 0.09;
        const top = unit * 0.24;
        const length = unit * (0.30 + index * 0.008);
        const angle = Math.sin(index * 0.72) * 0.36;
        const x = pivotX + Math.sin(angle) * length;
        const y = top - Math.cos(angle) * length;
        graphics.strokeColor = index % 3 === 0 ? CYAN : TRACK_SOFT;
        graphics.lineWidth = Math.max(1, unit * 0.0045);
        graphics.moveTo(pivotX, top);
        graphics.lineTo(x, y);
        graphics.stroke();
        graphics.fillColor = index === 3 ? AMBER : TRACK;
        graphics.circle(x, y, Math.max(4, unit * 0.016));
        graphics.fill();
    }
    graphics.strokeColor = TRACK;
    graphics.lineWidth = Math.max(1.5, unit * 0.006);
    graphics.moveTo(-unit * 0.34, unit * 0.24);
    graphics.lineTo(unit * 0.34, unit * 0.24);
    graphics.stroke();
});

registerCatalogCover('mechanics-collisions', (parent, width, height) => {
    const unit = Math.min(width, height);
    const graphics = layer(parent, 'CollisionsCover', width, height);
    const radius = unit * 0.052;
    const top = unit * 0.25;
    const length = unit * 0.38;
    for (let index = 0; index < 5; index += 1) {
        const pivotX = (index - 2) * radius * 2.04;
        const angle = index === 4 ? 0.65 : 0;
        const x = pivotX + Math.sin(angle) * length;
        const y = top - Math.cos(angle) * length;
        graphics.strokeColor = TRACK_SOFT;
        graphics.lineWidth = Math.max(1, unit * 0.0045);
        graphics.moveTo(pivotX, top);
        graphics.lineTo(x, y);
        graphics.stroke();
        graphics.fillColor = index === 4 ? AMBER : TRACK;
        graphics.circle(x, y, radius);
        graphics.fill();
    }
    graphics.strokeColor = RED;
    graphics.lineWidth = Math.max(1.5, unit * 0.0055);
    graphics.circle(radius * 2.6, -unit * 0.15, radius * 0.72);
    graphics.stroke();
});
