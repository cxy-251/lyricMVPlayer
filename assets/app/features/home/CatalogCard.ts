import { Node } from 'cc';
import { createUiNode } from '../../ui/UiFactory';
import { createLucideIcon } from '../../ui/WebIcons';
import {
    applyRect,
    cocosRectToCss,
} from '../../ui/WebUiKit';
import type { CatalogCoverKind } from './CatalogCovers';

export interface CatalogCardOptions {
    readonly name: string;
    readonly title: string;
    readonly subtitle: string;
    readonly cover: CatalogCoverKind;
    readonly width: number;
    readonly height: number;
    readonly x: number;
    readonly y: number;
    readonly webParent: HTMLElement | null;
    readonly onOpen: () => void;
}

export function createCatalogCard(parent: Node, options: CatalogCardOptions): Node {
    const placeholder = createUiNode(
        parent,
        options.name,
        1,
        1,
        options.x,
        options.y,
    );

    if (!options.webParent) {
        return placeholder;
    }

    const card = document.createElement('wa-card') as HTMLElement;
    card.className = 'cocoslab-catalog-card';
    card.setAttribute('appearance', 'filled-outlined');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${options.title}. ${options.subtitle}`);
    card.tabIndex = 0;
    applyRect(card, cocosRectToCss(options.x, options.y, options.width, options.height));

    const inner = document.createElement('div');
    inner.className = 'cocoslab-card-inner';
    inner.dataset.tone = toneForCover(options.cover);

    const canvas = document.createElement('canvas');
    canvas.className = 'cocoslab-card-cover';
    canvas.setAttribute('aria-hidden', 'true');
    inner.appendChild(canvas);

    const copy = document.createElement('div');
    copy.className = 'cocoslab-card-copy';
    const title = document.createElement('div');
    title.className = 'cocoslab-card-title';
    title.textContent = options.title;
    const subtitle = document.createElement('div');
    subtitle.className = 'cocoslab-card-subtitle';
    subtitle.textContent = options.subtitle;
    const arrow = createLucideIcon('arrow-right', 'Open', 20);
    arrow.style.margin = '10px auto 0';
    copy.append(title, subtitle, arrow);
    inner.appendChild(copy);
    card.appendChild(inner);

    let revealed = false;
    const reveal = (value: boolean): void => {
        revealed = value;
        card.classList.toggle('is-revealed', value);
    };
    const activate = (): void => {
        const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;

        if (coarsePointer && !revealed) {
            reveal(true);
            return;
        }

        options.onOpen();
    };

    card.addEventListener('pointerenter', () => reveal(true));
    card.addEventListener('pointerleave', () => reveal(false));
    card.addEventListener('click', activate);
    card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        activate();
    });

    options.webParent.appendChild(card);
    requestAnimationFrame(() => drawCover(canvas, options.cover));
    return placeholder;
}

function toneForCover(cover: CatalogCoverKind): string {
    if (cover === 'physics') {
        return 'green';
    }

    if (cover === 'double-pendulum') {
        return 'sand';
    }

    if (cover === 'parametric-curve') {
        return 'blue';
    }

    return 'lilac';
}

function drawCover(canvas: HTMLCanvasElement, cover: CatalogCoverKind): void {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const context = canvas.getContext('2d');

    if (!context) {
        return;
    }

    context.scale(dpr, dpr);
    context.translate(width / 2, height / 2);
    context.strokeStyle = 'rgba(54, 66, 62, 0.72)';
    context.fillStyle = 'rgba(54, 66, 62, 0.72)';
    context.lineWidth = Math.max(1.2, Math.min(width, height) * 0.0045);
    context.lineCap = 'round';
    context.lineJoin = 'round';

    if (cover === 'double-pendulum') {
        drawDoublePendulum(context, width, height);
        return;
    }

    if (cover === 'physics') {
        drawPhysics(context, width, height);
        return;
    }

    drawCurve(context, width, height, cover === 'mathematics' ? 3 : 2);
}

function drawCurve(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    frequency: number,
): void {
    const radiusX = width * 0.27;
    const radiusY = height * 0.26;
    context.globalAlpha = 0.38;
    context.beginPath();
    context.moveTo(-radiusX, 0);
    context.lineTo(radiusX, 0);
    context.moveTo(0, -radiusY);
    context.lineTo(0, radiusY);
    context.stroke();
    context.globalAlpha = 1;
    context.beginPath();

    for (let index = 0; index <= 160; index += 1) {
        const t = index / 160 * Math.PI * 2;
        const x = Math.sin(frequency * t + 0.65) * radiusX;
        const y = Math.sin(2 * t) * radiusY;

        if (index === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    }

    context.stroke();
}

function drawPhysics(context: CanvasRenderingContext2D, width: number, height: number): void {
    const radius = Math.min(width, height) * 0.24;
    context.globalAlpha = 0.55;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
    context.beginPath();
    context.arc(0, 0, 4, 0, Math.PI * 2);
    context.fill();
    const angle = -0.7;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(x, y);
    context.stroke();
    context.beginPath();
    context.arc(x, y, 8, 0, Math.PI * 2);
    context.fill();
}

function drawDoublePendulum(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
): void {
    const unit = Math.min(width, height);
    const pivotY = -height * 0.2;
    const first = { x: -unit * 0.11, y: pivotY + unit * 0.19 };
    const second = { x: unit * 0.13, y: first.y + unit * 0.22 };
    context.beginPath();
    context.moveTo(0, pivotY);
    context.lineTo(first.x, first.y);
    context.lineTo(second.x, second.y);
    context.stroke();

    for (const point of [{ x: 0, y: pivotY }, first, second]) {
        context.beginPath();
        context.arc(point.x, point.y, point === second ? 10 : 7, 0, Math.PI * 2);
        context.fill();
    }
}
