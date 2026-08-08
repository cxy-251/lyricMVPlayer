import {
    Button,
    Color,
    Graphics,
    Label,
    Node,
    UITransform,
} from 'cc';
import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import {
    clearNode,
    createLabel,
    createUiNode,
    fillNode,
} from '../../../ui/UiFactory';

export type MechanicsFamilyId = 'kinetic-tracks' | 'oscillator-fields' | 'collision-machines';

interface Point {
    readonly x: number;
    readonly y: number;
}

interface MechanicsFamily {
    readonly eyebrow: string;
    readonly variants: readonly string[];
    readonly details: readonly string[];
}

const TAU = Math.PI * 2;
const BACKGROUND = new Color(23, 22, 18, 255);
const PANEL = new Color(31, 29, 23, 255);
const GRID = new Color(111, 102, 80, 55);
const TRACK = new Color(241, 232, 210, 235);
const TRACK_SOFT = new Color(241, 232, 210, 65);
const AMBER = new Color(255, 177, 59, 255);
const AMBER_SOFT = new Color(255, 177, 59, 90);
const RED = new Color(228, 86, 60, 255);
const CYAN = new Color(98, 183, 198, 245);
const CYAN_SOFT = new Color(98, 183, 198, 80);
const MUTED = new Color(171, 161, 140, 255);

const FAMILIES: Record<MechanicsFamilyId, MechanicsFamily> = {
    'kinetic-tracks': {
        eyebrow: 'MECHANICS / KINETIC TRACKS',
        variants: ['Flow track', 'Vertical loop', 'Cycloid race', 'Launch return'],
        details: [
            'Phase-shifted bodies circulate on one rail so the system never empties.',
            'The loop stays alive as successive bodies trade height for speed.',
            'Three paths share endpoints; their moving bodies reveal the quickest descent.',
            'Launch, flight and hidden return form one continuous mechanical conveyor.',
        ],
    },
    'oscillator-fields': {
        eyebrow: 'MECHANICS / OSCILLATOR FIELDS',
        variants: ['Pendulum wave', 'Coupled pair', 'Spring chain', 'Resonance bank'],
        details: [
            'Slightly different periods build a wave, dissolve it and build it again.',
            'Two pendulums pass energy back and forth through a slow beat envelope.',
            'A normal mode travels through connected masses without reaching an ending.',
            'One driver exposes resonance by making nearby oscillators answer differently.',
        ],
    },
    'collision-machines': {
        eyebrow: 'MECHANICS / COLLISION MACHINES',
        variants: ['Newton cradle', 'Equal masses', 'Mixed masses', 'Moving chamber'],
        details: [
            'Momentum and energy pass through the center before the next impact arrives.',
            'Identical bodies exchange velocities, making motion appear to pass through.',
            'Unequal masses reveal recoil, speed exchange and repeating impact patterns.',
            'A breathing wall compresses a many-body gas while particles keep rebounding.',
        ],
    },
};

export class KineticMotionModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName: string;

    private phase = 0;
    private paused = false;
    private variant = 0;
    private graphics: Graphics | null = null;
    private detailLabel: Label | null = null;
    private metricLabel: Label | null = null;
    private phaseLabel: Label | null = null;
    private variantLabels: Label[] = [];
    private variantVisuals: Node[] = [];
    private plotWidth = 1;
    private plotHeight = 1;

    constructor(private readonly familyId: MechanicsFamilyId) {
        super();
        this.rootName = `KineticMotion:${familyId}`;
    }

    update(dt: number): void {
        if (this.paused || !this.graphics) {
            return;
        }
        this.phase = (this.phase + Math.min(0.05, dt) * 0.92) % TAU;
        this.paint();
    }

    pause(): void {
        this.paused = true;
    }

    resume(): void {
        this.paused = false;
    }

    reset(): void {
        this.phase = 0;
        this.paint();
    }

    protected render(viewport: ViewportSnapshot): void {
        const root = this.requireRoot();
        clearNode(root);
        fillNode(root, viewport.width, viewport.height, BACKGROUND);
        this.graphics = null;
        this.detailLabel = null;
        this.metricLabel = null;
        this.phaseLabel = null;
        this.variantLabels = [];
        this.variantVisuals = [];

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const padding = compact ? 16 : 40;
        const contentWidth = Math.max(280, Math.min(1220, safeWidth - padding * 2));
        const railHeight = compact ? 78 : 84;
        const railY = -viewport.height / 2 + viewport.safeInsets.bottom + 16 + railHeight / 2;
        const top = viewport.height / 2 - viewport.safeInsets.top - (compact ? 70 : 78);
        const bottom = railY + railHeight / 2 + 16;
        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(270, top - bottom);
        const plotY = (top + bottom) / 2;

        const family = FAMILIES[this.familyId];
        const plot = createUiNode(root, 'KineticPlot', contentWidth, this.plotHeight, centerX, plotY);
        fillNode(plot, contentWidth, this.plotHeight, PANEL, compact ? 2 : 4);
        const art = createUiNode(plot, 'KineticArt', contentWidth, this.plotHeight);
        this.graphics = art.addComponent(Graphics);

        createLabel(root, family.eyebrow, contentWidth, 24, compact ? 10 : 11, AMBER, centerX, top - 15);
        const detailNode = createLabel(
            root,
            family.details[this.variant],
            Math.min(contentWidth - 28, 780),
            compact ? 42 : 34,
            compact ? 11 : 13,
            MUTED,
            centerX,
            bottom + (compact ? 22 : 18),
        );
        this.detailLabel = detailNode.getComponent(Label);
        const metricNode = createLabel(
            root,
            this.metricText(),
            Math.min(contentWidth - 120, 650),
            24,
            compact ? 9 : 11,
            TRACK,
            centerX - (compact ? 34 : 60),
            top - 42,
        );
        this.metricLabel = metricNode.getComponent(Label);
        const phaseNode = createLabel(
            root,
            'RUN  t 0.00',
            compact ? 92 : 120,
            24,
            compact ? 8 : 10,
            RED,
            centerX + contentWidth / 2 - (compact ? 54 : 72),
            top - 42,
        );
        this.phaseLabel = phaseNode.getComponent(Label);
        this.createVariantRail(root, centerX, railY, contentWidth, railHeight, compact);
        this.paint();
    }

    private createVariantRail(
        root: Node,
        centerX: number,
        centerY: number,
        width: number,
        height: number,
        compact: boolean,
    ): void {
        const rail = createUiNode(root, 'MechanicsVariantRail', width, height, centerX, centerY);
        const guide = rail.addComponent(Graphics);
        guide.strokeColor = new Color(118, 105, 77, 180);
        guide.lineWidth = 1;
        guide.moveTo(-width / 2 + 10, height / 2 - 1);
        guide.lineTo(width / 2 - 10, height / 2 - 1);
        guide.stroke();

        const variants = FAMILIES[this.familyId].variants;
        const segmentWidth = width / variants.length;
        variants.forEach((name, index) => {
            const buttonRoot = createUiNode(
                rail,
                `MechanicsVariant:${index}`,
                segmentWidth,
                height,
                -width / 2 + segmentWidth * (index + 0.5),
                0,
            );
            const visual = createUiNode(buttonRoot, '__Visual', segmentWidth - 6, 40, 0, -3);
            const labelNode = createLabel(
                visual,
                name.toUpperCase(),
                segmentWidth - 12,
                38,
                compact ? 8 : 10,
                index === this.variant ? TRACK : MUTED,
            );
            const label = labelNode.getComponent(Label);
            if (label) {
                this.variantLabels.push(label);
            }
            this.variantVisuals.push(visual);
            const button = buttonRoot.addComponent(Button);
            button.target = visual;
            button.transition = Button.Transition.SCALE;
            button.zoomScale = 0.94;
            button.duration = 0.08;
            buttonRoot.on(Button.EventType.CLICK, () => this.selectVariant(index));
        });
        this.paintRail();
    }

    private selectVariant(index: number): void {
        this.variant = index;
        if (this.detailLabel) {
            this.detailLabel.string = FAMILIES[this.familyId].details[index];
        }
        if (this.metricLabel) {
            this.metricLabel.string = this.metricText();
        }
        this.paintRail();
        this.paint();
    }

    private paintRail(): void {
        this.variantVisuals.forEach((visual, index) => {
            const width = visual.getComponent(UITransform)?.contentSize.width ?? 64;
            fillNode(
                visual,
                width,
                40,
                index === this.variant ? new Color(67, 55, 31, 255) : new Color(0, 0, 0, 0),
                3,
            );
            const label = this.variantLabels[index];
            if (label) {
                label.color = index === this.variant ? TRACK : MUTED;
            }
        });
    }

    private paint(): void {
        const graphics = this.graphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        if (this.phaseLabel) {
            this.phaseLabel.string = `RUN  t ${this.phase.toFixed(2)}`;
        }
        this.drawGrid(graphics);
        if (this.familyId === 'kinetic-tracks') {
            this.drawTracks(graphics);
        } else if (this.familyId === 'oscillator-fields') {
            this.drawOscillators(graphics);
        } else {
            this.drawCollisions(graphics);
        }
        this.drawHud(graphics);
    }

    private drawGrid(graphics: Graphics): void {
        const step = Math.max(34, Math.min(54, this.plotWidth / 11));
        graphics.strokeColor = GRID;
        graphics.lineWidth = 1;
        for (let x = -this.plotWidth / 2; x <= this.plotWidth / 2; x += step) {
            graphics.moveTo(x, -this.plotHeight / 2);
            graphics.lineTo(x, this.plotHeight / 2);
        }
        for (let y = -this.plotHeight / 2; y <= this.plotHeight / 2; y += step) {
            graphics.moveTo(-this.plotWidth / 2, y);
            graphics.lineTo(this.plotWidth / 2, y);
        }
        graphics.stroke();
    }

    private drawTracks(graphics: Graphics): void {
        if (this.variant === 0) {
            const path: Point[] = [];
            const left = -this.plotWidth * 0.42;
            const loopX = this.plotWidth * 0.08;
            const loopRadius = Math.min(this.plotWidth, this.plotHeight) * 0.145;
            for (let index = 0; index <= 100; index += 1) {
                const t = index / 100;
                const startY = this.plotHeight * 0.24;
                const loopBottom = -this.plotHeight * 0.13 - loopRadius;
                path.push({
                    x: left + (loopX - left) * t,
                    y: startY + (loopBottom - startY) * t
                        - Math.sin(Math.PI * t) * this.plotHeight * 0.20,
                });
            }
            for (let index = 0; index <= 150; index += 1) {
                const angle = -Math.PI / 2 + index / 150 * TAU;
                path.push({
                    x: loopX + Math.cos(angle) * loopRadius,
                    y: -this.plotHeight * 0.13 + Math.sin(angle) * loopRadius,
                });
            }
            for (let index = 0; index <= 80; index += 1) {
                const t = index / 80;
                path.push({
                    x: loopX + (this.plotWidth * 0.42 - loopX) * t,
                    y: -this.plotHeight * 0.13 - loopRadius
                        + Math.sin(t * Math.PI) * this.plotHeight * 0.25,
                });
            }
            for (let index = 0; index <= 90; index += 1) {
                const t = index / 90;
                path.push({
                    x: this.plotWidth * 0.42 - this.plotWidth * 0.84 * t,
                    y: -this.plotHeight * 0.36
                        + Math.sin(t * Math.PI) * this.plotHeight * 0.035,
                });
            }
            path.push(path[0]);
            this.drawRail(graphics, path.slice(0, 333));
            this.drawRail(graphics, path.slice(332), CYAN_SOFT);
            const floorY = -this.plotHeight * 0.38;
            [18, 48, 78, 268, 305].forEach((pathIndex) => {
                const anchor = path[Math.min(path.length - 1, pathIndex)];
                if (anchor.y > floorY + 18) {
                    this.drawSupport(graphics, anchor, floorY);
                }
            });
            const loopCenter = { x: loopX, y: -this.plotHeight * 0.13 };
            const loopTop = { x: loopX, y: loopCenter.y + loopRadius };
            this.line(graphics, loopCenter, loopTop, CYAN, 1.2);
            graphics.strokeColor = CYAN_SOFT;
            graphics.lineWidth = 1;
            graphics.circle(loopCenter.x, loopCenter.y, 3.5);
            graphics.stroke();
            const leadT = this.wrap01(this.phase / TAU);
            for (let echo = 7; echo >= 1; echo -= 1) {
                const point = this.samplePath(path, this.wrap01(leadT - echo * 0.012));
                graphics.fillColor = new Color(255, 177, 59, 18 + (7 - echo) * 9);
                graphics.circle(point.x, point.y, 3 + (7 - echo) * 0.35);
                graphics.fill();
            }
            for (let index = 0; index < 8; index += 1) {
                const t = this.wrap01(leadT + index / 8);
                this.drawBody(graphics, this.samplePath(path, t), 6.5 + (index === 0 ? 2 : 0), index === 0);
            }
            const lead = this.samplePath(path, leadT);
            const ahead = this.samplePath(path, this.wrap01(leadT + 0.008));
            this.drawArrow(graphics, lead, ahead, AMBER, 38);
        } else if (this.variant === 1) {
            const radius = Math.min(this.plotWidth, this.plotHeight) * 0.21;
            const path: Point[] = [
                { x: -this.plotWidth * 0.42, y: this.plotHeight * 0.28 },
                { x: -this.plotWidth * 0.18, y: -radius },
                { x: 0, y: -radius },
            ];
            for (let index = 0; index <= 150; index += 1) {
                const angle = -Math.PI / 2 + index / 150 * TAU;
                path.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
            }
            path.push({ x: this.plotWidth * 0.43, y: -radius });
            this.drawRail(graphics, path);
            for (let index = 0; index < 5; index += 1) {
                const t = this.wrap01(this.phase / TAU + index / 5);
                this.drawBody(graphics, this.samplePath(path, t), 8, index === 0);
            }
            this.drawVelocityTicks(graphics, path);
        } else if (this.variant === 2) {
            const left = -this.plotWidth * 0.40;
            const span = this.plotWidth * 0.80;
            const top = this.plotHeight * 0.24;
            for (let row = 0; row < 3; row += 1) {
                const path: Point[] = [];
                const amplitude = this.plotHeight * (0.16 + row * 0.035);
                for (let index = 0; index <= 180; index += 1) {
                    const t = index / 180;
                    path.push({
                        x: left + span * t,
                        y: top - row * this.plotHeight * 0.22 - amplitude * Math.sin(Math.PI * t) * (0.65 + row * 0.17),
                    });
                }
                this.drawRail(graphics, path, row === 1 ? CYAN : TRACK_SOFT);
                const t = 0.5 - 0.5 * Math.cos(this.phase * (1 + row * 0.08));
                this.drawBody(graphics, this.samplePath(path, t), 7.5, row === 1);
            }
        } else {
            const path: Point[] = [];
            const left = -this.plotWidth * 0.42;
            const span = this.plotWidth * 0.84;
            for (let index = 0; index <= 220; index += 1) {
                const t = index / 220;
                path.push({
                    x: left + span * t,
                    y: -this.plotHeight * 0.18 + Math.sin(Math.PI * t) * this.plotHeight * 0.44,
                });
            }
            for (let index = 220; index >= 0; index -= 1) {
                const t = index / 220;
                path.push({
                    x: left + span * t,
                    y: -this.plotHeight * 0.24 - Math.sin(Math.PI * t) * this.plotHeight * 0.06,
                });
            }
            this.drawRail(graphics, path, CYAN);
            for (let index = 0; index < 5; index += 1) {
                const t = this.wrap01(this.phase / TAU + index / 5);
                this.drawBody(graphics, this.samplePath(path, t), 7.5, index === 0);
            }
        }
    }

    private drawOscillators(graphics: Graphics): void {
        if (this.variant === 0) {
            const count = this.plotWidth < 520 ? 9 : 13;
            const spacing = this.plotWidth * 0.76 / (count - 1);
            const top = this.plotHeight * 0.29;
            for (let index = 0; index < count; index += 1) {
                const length = this.plotHeight * (0.28 + index * 0.008);
                const angle = 0.54 * Math.sin(this.phase * (1 + index * 0.018));
                const pivot = { x: -spacing * (count - 1) / 2 + index * spacing, y: top };
                const bob = { x: pivot.x + Math.sin(angle) * length, y: pivot.y - Math.cos(angle) * length };
                this.line(graphics, pivot, bob, index % 3 === 0 ? CYAN : TRACK_SOFT, 1.4);
                this.drawBody(graphics, bob, 4.6, index % 4 === 0);
            }
            this.line(graphics, { x: -this.plotWidth * 0.42, y: top }, { x: this.plotWidth * 0.42, y: top }, TRACK, 2);
        } else if (this.variant === 1) {
            const top = this.plotHeight * 0.26;
            const length = this.plotHeight * 0.42;
            const beat = Math.sin(this.phase * 0.23);
            const angles = [
                0.72 * beat * Math.cos(this.phase * 1.8),
                0.72 * Math.cos(this.phase * 0.23) * Math.sin(this.phase * 1.8),
            ];
            [-1, 1].forEach((sign, index) => {
                const pivot = { x: sign * this.plotWidth * 0.16, y: top };
                const bob = {
                    x: pivot.x + Math.sin(angles[index]) * length,
                    y: pivot.y - Math.cos(angles[index]) * length,
                };
                this.line(graphics, pivot, bob, index === 0 ? CYAN : TRACK, 2.2);
                this.drawBody(graphics, bob, 11, index === 0);
            });
            this.line(graphics, { x: -this.plotWidth * 0.16, y: top }, { x: this.plotWidth * 0.16, y: top }, AMBER, 3);
        } else if (this.variant === 2) {
            const count = 10;
            const span = this.plotWidth * 0.74;
            const spacing = span / (count - 1);
            const points: Point[] = [];
            for (let index = 0; index < count; index += 1) {
                const x = -span / 2 + spacing * index;
                const y = Math.sin(this.phase * 1.8 - index * 0.72) * this.plotHeight * 0.18
                    + Math.sin(this.phase * 0.82 + index * 0.38) * this.plotHeight * 0.055;
                points.push({ x, y });
            }
            this.drawSpring(graphics, points);
            points.forEach((point, index) => this.drawBody(graphics, point, index % 3 === 0 ? 8 : 6, index === 0));
        } else {
            const rows = 6;
            const left = -this.plotWidth * 0.34;
            const span = this.plotWidth * 0.68;
            for (let index = 0; index < rows; index += 1) {
                const y = this.plotHeight * 0.28 - index * this.plotHeight * 0.112;
                const detune = Math.abs(index - 2.5);
                const amplitude = this.plotWidth * 0.12 / (0.42 + detune * 0.55);
                const x = left + span / 2 + Math.sin(this.phase * 2.0 - index * 0.2) * amplitude;
                this.line(graphics, { x: left, y }, { x: left + span, y }, TRACK_SOFT, 1);
                this.drawBody(graphics, { x, y }, 6 + (2.5 - Math.min(2.5, detune)), index === 2 || index === 3);
            }
            const driverX = Math.sin(this.phase * 2.0) * this.plotWidth * 0.07;
            this.line(graphics, { x: driverX, y: -this.plotHeight * 0.40 }, { x: driverX, y: this.plotHeight * 0.40 }, AMBER_SOFT, 2);
        }
    }

    private drawCollisions(graphics: Graphics): void {
        if (this.variant === 0) {
            const count = 5;
            const radius = Math.min(this.plotWidth, this.plotHeight) * 0.038;
            const length = this.plotHeight * 0.42;
            const spacing = radius * 2.05;
            const top = this.plotHeight * 0.30;
            const cycle = Math.sin(this.phase * 1.45);
            for (let index = 0; index < count; index += 1) {
                let angle = 0;
                if (index === 0 && cycle < 0) {
                    angle = cycle * 0.72;
                } else if (index === count - 1 && cycle > 0) {
                    angle = cycle * 0.72;
                }
                const pivot = { x: (index - 2) * spacing, y: top };
                const bob = { x: pivot.x + Math.sin(angle) * length, y: pivot.y - Math.cos(angle) * length };
                this.line(graphics, pivot, bob, TRACK_SOFT, 1.4);
                this.drawBody(graphics, bob, radius, index === 0 || index === count - 1);
            }
            this.line(graphics, { x: -spacing * 3.2, y: top }, { x: spacing * 3.2, y: top }, TRACK, 3);
        } else if (this.variant === 1) {
            const laneLeft = -this.plotWidth * 0.38;
            const laneRight = this.plotWidth * 0.38;
            this.line(graphics, { x: laneLeft, y: 0 }, { x: laneRight, y: 0 }, TRACK, 2.5);
            for (let index = 0; index < 4; index += 1) {
                const p = this.triangleWave(this.phase / TAU * 1.6 + index * 0.25);
                const x = laneLeft + (laneRight - laneLeft) * p;
                this.drawBody(graphics, { x, y: 0 }, 9, index === 0);
            }
            this.drawImpactPulse(graphics, 0, 0, Math.abs(Math.sin(this.phase * 3.2)));
        } else if (this.variant === 2) {
            const left = -this.plotWidth * 0.36;
            const right = this.plotWidth * 0.36;
            this.line(graphics, { x: left, y: -32 }, { x: right, y: -32 }, TRACK, 2);
            const p1 = this.triangleWave(this.phase / TAU * 1.25);
            const p2 = this.triangleWave(this.phase / TAU * 0.72 + 0.46);
            const first = { x: left + (right - left) * p1, y: -18 };
            const second = { x: left + (right - left) * p2, y: 4 };
            this.drawBody(graphics, first, 14, true);
            this.drawBody(graphics, second, 8, false);
            if (Math.abs(first.x - second.x) < 26) {
                this.drawImpactPulse(graphics, (first.x + second.x) / 2, -7, 1);
            }
        } else {
            const halfWidth = this.plotWidth * (0.31 + 0.04 * Math.sin(this.phase * 0.63));
            const halfHeight = this.plotHeight * 0.31;
            const chamber: Point[] = [
                { x: -halfWidth, y: -halfHeight }, { x: halfWidth, y: -halfHeight },
                { x: halfWidth, y: halfHeight }, { x: -halfWidth, y: halfHeight },
                { x: -halfWidth, y: -halfHeight },
            ];
            this.polyline(graphics, chamber, TRACK, 2.2);
            for (let index = 0; index < 22; index += 1) {
                const px = this.triangleWave(this.phase / TAU * (0.8 + index * 0.037) + index * 0.137);
                const py = this.triangleWave(this.phase / TAU * (1.1 + index * 0.021) + index * 0.211);
                const point = { x: -halfWidth + px * halfWidth * 2, y: -halfHeight + py * halfHeight * 2 };
                this.drawBody(graphics, point, 3.5 + index % 3, index % 7 === 0);
            }
        }
    }

    private drawRail(graphics: Graphics, path: readonly Point[], color = TRACK): void {
        this.polyline(graphics, path, color === TRACK ? TRACK_SOFT : color, color === TRACK ? 8 : 5);
        this.polyline(graphics, path, color, 2.2);
    }

    private drawHud(graphics: Graphics): void {
        const left = -this.plotWidth / 2 + 22;
        const top = this.plotHeight / 2 - 66;
        const barWidth = Math.min(90, this.plotWidth * 0.20);
        const kinetic = 0.18 + 0.78 * (0.5 + 0.5 * Math.sin(this.phase * 1.35));
        const potential = 1 - kinetic * 0.78;

        graphics.strokeColor = TRACK_SOFT;
        graphics.lineWidth = 1;
        for (let index = 0; index <= 4; index += 1) {
            const x = left + barWidth * index / 4;
            graphics.moveTo(x, top - 10);
            graphics.lineTo(x, top + 12);
        }
        graphics.stroke();
        graphics.fillColor = AMBER_SOFT;
        graphics.fillRect(left, top + 2, barWidth, 5);
        graphics.fillColor = AMBER;
        graphics.fillRect(left, top + 2, barWidth * kinetic, 5);
        graphics.fillColor = CYAN_SOFT;
        graphics.fillRect(left, top - 8, barWidth, 4);
        graphics.fillColor = CYAN;
        graphics.fillRect(left, top - 8, barWidth * potential, 4);

        const dial = { x: this.plotWidth / 2 - 48, y: top - 1 };
        graphics.strokeColor = TRACK_SOFT;
        graphics.lineWidth = 1.2;
        graphics.circle(dial.x, dial.y, 22);
        graphics.stroke();
        const needle = {
            x: dial.x + Math.cos(this.phase * 1.1) * 17,
            y: dial.y + Math.sin(this.phase * 1.1) * 17,
        };
        this.line(graphics, dial, needle, RED, 2);
        graphics.fillColor = TRACK;
        graphics.circle(dial.x, dial.y, 2.8);
        graphics.fill();

        const rulerX = -this.plotWidth / 2 + 12;
        graphics.strokeColor = TRACK_SOFT;
        graphics.lineWidth = 1;
        graphics.moveTo(rulerX, -this.plotHeight * 0.30);
        graphics.lineTo(rulerX, this.plotHeight * 0.25);
        for (let index = 0; index <= 8; index += 1) {
            const y = -this.plotHeight * 0.30 + this.plotHeight * 0.55 * index / 8;
            graphics.moveTo(rulerX, y);
            graphics.lineTo(rulerX + (index % 2 === 0 ? 9 : 5), y);
        }
        graphics.stroke();
    }

    private drawArrow(
        graphics: Graphics,
        origin: Point,
        toward: Point,
        color: Color,
        length: number,
    ): void {
        const dx = toward.x - origin.x;
        const dy = toward.y - origin.y;
        const magnitude = Math.max(0.001, Math.hypot(dx, dy));
        const ux = dx / magnitude;
        const uy = dy / magnitude;
        const end = { x: origin.x + ux * length, y: origin.y + uy * length };
        this.line(graphics, origin, end, color, 2.2);
        this.polyline(graphics, [
            { x: end.x - ux * 9 - uy * 5, y: end.y - uy * 9 + ux * 5 },
            end,
            { x: end.x - ux * 9 + uy * 5, y: end.y - uy * 9 - ux * 5 },
        ], color, 2.2);
    }

    private metricText(): string {
        if (this.familyId === 'kinetic-tracks') {
            return [
                'ENERGY FLOW  ·  Ep + Ek = constant',
                'LOOP CONDITION  ·  v² / r ≥ g',
                'DESCENT TIMER  ·  equal endpoints',
                'FLIGHT  ·  x = v₀t  /  y = v₀yt − ½gt²',
            ][this.variant];
        }
        if (this.familyId === 'oscillator-fields') {
            return [
                'PERIOD FIELD  ·  ΔT = 0.018 s',
                'ENERGY EXCHANGE  ·  A₁² + A₂² = constant',
                'NORMAL MODE  ·  k = 4',
                'DRIVE  ·  ω / ω₀ sweep',
            ][this.variant];
        }
        return [
            'MOMENTUM TRANSFER  ·  Σp conserved',
            'm₁ = m₂  ·  velocities exchange',
            'IMPULSE  ·  Δp = ∫Fdt',
            'COMPRESSION  ·  P · A wall work',
        ][this.variant];
    }

    private drawVelocityTicks(graphics: Graphics, path: readonly Point[]): void {
        for (let index = 22; index < path.length - 1; index += 34) {
            const point = path[index];
            graphics.fillColor = CYAN_SOFT;
            graphics.circle(point.x, point.y, 3);
            graphics.fill();
        }
    }

    private drawSupport(graphics: Graphics, anchor: Point, floorY: number): void {
        const postBottom = { x: anchor.x, y: floorY };
        this.line(graphics, anchor, postBottom, TRACK_SOFT, 1.2);
        this.line(
            graphics,
            { x: postBottom.x - 10, y: floorY },
            { x: postBottom.x + 10, y: floorY },
            TRACK_SOFT,
            1.2,
        );
        this.polyline(graphics, [
            { x: anchor.x - 3, y: anchor.y - 8 },
            { x: postBottom.x + 7, y: floorY + 8 },
            { x: postBottom.x, y: floorY },
        ], TRACK_SOFT, 0.8);
    }

    private drawSpring(graphics: Graphics, anchors: readonly Point[]): void {
        graphics.strokeColor = CYAN;
        graphics.lineWidth = 1.8;
        anchors.forEach((point, index) => {
            if (index === 0) {
                graphics.moveTo(point.x, point.y);
            } else {
                const previous = anchors[index - 1];
                const steps = 5;
                for (let step = 1; step <= steps; step += 1) {
                    const t = step / steps;
                    const normal = step === steps ? 0 : (step % 2 === 0 ? -1 : 1) * 5;
                    graphics.lineTo(
                        previous.x + (point.x - previous.x) * t,
                        previous.y + (point.y - previous.y) * t + normal,
                    );
                }
            }
        });
        graphics.stroke();
    }

    private drawBody(graphics: Graphics, point: Point, radius: number, highlighted: boolean): void {
        graphics.fillColor = highlighted ? AMBER_SOFT : CYAN_SOFT;
        graphics.circle(point.x, point.y, radius + 5);
        graphics.fill();
        graphics.fillColor = highlighted ? AMBER : TRACK;
        graphics.circle(point.x, point.y, radius);
        graphics.fill();
    }

    private drawImpactPulse(graphics: Graphics, x: number, y: number, strength: number): void {
        if (strength < 0.7) {
            return;
        }
        graphics.strokeColor = new Color(RED.r, RED.g, RED.b, Math.round(255 * strength));
        graphics.lineWidth = 2;
        const radius = 12 + strength * 12;
        graphics.circle(x, y, radius);
        graphics.stroke();
    }

    private samplePath(path: readonly Point[], t: number): Point {
        const index = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
        const local = t * (path.length - 1) - index;
        const a = path[index];
        const b = path[index + 1];
        return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
    }

    private polyline(graphics: Graphics, points: readonly Point[], color: Color, width: number): void {
        if (points.length === 0) {
            return;
        }
        graphics.strokeColor = color;
        graphics.lineWidth = width;
        graphics.moveTo(points[0].x, points[0].y);
        for (let index = 1; index < points.length; index += 1) {
            graphics.lineTo(points[index].x, points[index].y);
        }
        graphics.stroke();
    }

    private line(graphics: Graphics, a: Point, b: Point, color: Color, width: number): void {
        this.polyline(graphics, [a, b], color, width);
    }

    private triangleWave(value: number): number {
        const wrapped = this.wrap01(value);
        return 1 - Math.abs(wrapped * 2 - 1);
    }

    private wrap01(value: number): number {
        return ((value % 1) + 1) % 1;
    }
}
