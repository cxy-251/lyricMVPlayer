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

export type GeometryFamilyId = 'triangle-motion' | 'circle-motion' | 'motion-curves';

interface Point {
    readonly x: number;
    readonly y: number;
}

interface GeometryFamily {
    readonly eyebrow: string;
    readonly variants: readonly string[];
    readonly details: readonly string[];
}

const TAU = Math.PI * 2;
const BACKGROUND = new Color(16, 15, 31, 255);
const GRID = new Color(73, 72, 112, 72);
const CONSTRUCTION = new Color(237, 231, 216, 215);
const CONSTRUCTION_SOFT = new Color(237, 231, 216, 70);
const CYAN = new Color(79, 214, 226, 245);
const CYAN_SOFT = new Color(79, 214, 226, 82);
const CORAL = new Color(255, 108, 105, 255);
const CORAL_SOFT = new Color(255, 108, 105, 105);
const INK = new Color(242, 237, 225, 255);
const MUTED = new Color(157, 154, 184, 255);

const FAMILIES: Record<GeometryFamilyId, GeometryFamily> = {
    'triangle-motion': {
        eyebrow: 'TRIANGLE / INVARIANTS',
        variants: ['Euler line', 'Nine-point', 'Napoleon', 'Simson line'],
        details: [
            'O, G and H keep one straight-line promise while the triangle breathes.',
            'Side midpoints and altitude feet keep returning to the same moving circle.',
            'Three outward equilateral triangles conceal another equilateral triangle.',
            'A point circles the circumcircle; its three projections remain collinear.',
        ],
    },
    'circle-motion': {
        eyebrow: 'CIRCLE / RELATIONS',
        variants: ['Chord power', 'Tangency', 'Radical axis', 'Inversion'],
        details: [
            'Two moving chords trade lengths while their products stay equal.',
            'A roaming exterior point keeps two tangent segments equal.',
            'Two circles change size; their equal-power line slides without bending.',
            'A point and its inverse move oppositely while OP · OP′ stays fixed.',
        ],
    },
    'motion-curves': {
        eyebrow: 'CURVES / GENERATORS',
        variants: ['Lissajous', 'Epicycloid', 'Hypocycloid', 'Cycloid'],
        details: [
            'Two perpendicular oscillations weave a closed harmonic signature.',
            'A point on a circle rolling outside another circle draws pointed petals.',
            'The same rolling point moves inside and folds the path inward.',
            'A wheel rolls forever; one rim point alternates flight and cusp.',
        ],
    },
};

export class GeometryMotionModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
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
    private annotationLabels: Label[] = [];
    private plotWidth = 1;
    private plotHeight = 1;

    constructor(private readonly familyId: GeometryFamilyId) {
        super();
        this.rootName = `GeometryMotion:${familyId}`;
    }

    update(dt: number): void {
        if (this.paused || !this.graphics) {
            return;
        }
        this.phase = (this.phase + Math.min(0.05, dt) * 0.72) % TAU;
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
        this.annotationLabels = [];

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const horizontalPadding = compact ? 18 : 42;
        const contentWidth = Math.max(280, Math.min(1220, safeWidth - horizontalPadding * 2));
        const railHeight = compact ? 76 : 82;
        const railY = -viewport.height / 2 + viewport.safeInsets.bottom + 16 + railHeight / 2;
        const top = viewport.height / 2 - viewport.safeInsets.top - (compact ? 70 : 78);
        const bottom = railY + railHeight / 2 + 16;
        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(270, top - bottom);
        const plotY = (top + bottom) / 2;

        const family = FAMILIES[this.familyId];
        const plot = createUiNode(root, 'GeometryPlot', contentWidth, this.plotHeight, centerX, plotY);
        this.graphics = plot.addComponent(Graphics);
        for (let index = 0; index < 10; index += 1) {
            const annotation = createLabel(plot, '', 38, 20, compact ? 9 : 10, INK);
            const label = annotation.getComponent(Label);
            if (label) {
                this.annotationLabels.push(label);
            }
        }

        createLabel(
            root,
            family.eyebrow,
            contentWidth,
            24,
            compact ? 10 : 11,
            CYAN,
            centerX,
            top - 15,
        );
        const detailNode = createLabel(
            root,
            family.details[this.variant],
            Math.min(contentWidth - 28, 760),
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
            Math.min(contentWidth - 120, 620),
            24,
            compact ? 9 : 11,
            INK,
            centerX - (compact ? 34 : 60),
            top - 42,
        );
        this.metricLabel = metricNode.getComponent(Label);
        const phaseNode = createLabel(
            root,
            'LIVE  φ 0.00',
            compact ? 92 : 120,
            24,
            compact ? 8 : 10,
            CORAL,
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
        const rail = createUiNode(root, 'GeometryVariantRail', width, height, centerX, centerY);
        const railGraphics = rail.addComponent(Graphics);
        railGraphics.strokeColor = new Color(91, 87, 132, 180);
        railGraphics.lineWidth = 1;
        railGraphics.moveTo(-width / 2 + 12, height / 2 - 1);
        railGraphics.lineTo(width / 2 - 12, height / 2 - 1);
        railGraphics.stroke();

        const variants = FAMILIES[this.familyId].variants;
        const segmentWidth = width / variants.length;
        variants.forEach((name, index) => {
            const buttonRoot = createUiNode(
                rail,
                `GeometryVariant:${index}`,
                segmentWidth,
                height,
                -width / 2 + segmentWidth * (index + 0.5),
                0,
            );
            const visual = createUiNode(buttonRoot, '__Visual', segmentWidth - 8, 38, 0, -3);
            const labelNode = createLabel(
                visual,
                name,
                segmentWidth - 14,
                36,
                compact ? 9 : 11,
                index === this.variant ? INK : MUTED,
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
            fillNode(
                visual,
                visual.getComponent(UITransform)?.contentSize.width ?? 64,
                38,
                index === this.variant ? new Color(46, 43, 78, 255) : new Color(0, 0, 0, 0),
                19,
            );
            const label = this.variantLabels[index];
            if (label) {
                label.color = index === this.variant ? INK : MUTED;
            }
        });
    }

    private paint(): void {
        const graphics = this.graphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        this.annotationLabels.forEach((label) => {
            label.string = '';
        });
        if (this.phaseLabel) {
            this.phaseLabel.string = `LIVE  φ ${this.phase.toFixed(2)}`;
        }
        this.drawGrid(graphics);
        if (this.familyId === 'triangle-motion') {
            this.drawTriangleFamily(graphics);
        } else if (this.familyId === 'circle-motion') {
            this.drawCircleFamily(graphics);
        } else {
            this.drawCurveFamily(graphics);
        }
    }

    private drawGrid(graphics: Graphics): void {
        const spacing = Math.max(28, Math.min(46, this.plotWidth / 12));
        graphics.fillColor = GRID;
        for (let x = -this.plotWidth / 2; x <= this.plotWidth / 2; x += spacing) {
            for (let y = -this.plotHeight / 2; y <= this.plotHeight / 2; y += spacing) {
                graphics.circle(x, y, 1.15);
                graphics.fill();
            }
        }
    }

    private drawTriangleFamily(graphics: Graphics): void {
        const scale = Math.min(this.plotWidth * 0.45, this.plotHeight * 0.43);
        for (const [offset, alpha] of [[-0.65, 28], [-0.34, 45]] as const) {
            const ghost = this.triangleAt(this.phase + offset, scale);
            this.strokePolyline(
                graphics,
                [ghost.a, ghost.b, ghost.c, ghost.a],
                new Color(CYAN.r, CYAN.g, CYAN.b, alpha),
                1.1,
            );
        }
        const { a, b, c } = this.triangleAt(this.phase, scale);
        this.strokeCircle(
            graphics,
            { x: scale * 0.02, y: scale * 0.18 },
            scale * 0.28,
            new Color(CORAL.r, CORAL.g, CORAL.b, 38),
            1,
        );
        this.strokePolyline(graphics, [a, b, c, a], CONSTRUCTION, 2.1);
        if (this.variant === 0) {
            const o = this.circumcenter(a, b, c);
            const g = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
            const h = { x: a.x + b.x + c.x - 2 * o.x, y: a.y + b.y + c.y - 2 * o.y };
            const radius = this.distance(o, a);
            this.strokeCircle(graphics, o, radius, CONSTRUCTION_SOFT, 1.2);
            this.strokePolyline(graphics, [a, this.midpoint(b, c)], CONSTRUCTION_SOFT, 1);
            this.strokePolyline(graphics, [b, this.midpoint(a, c)], CONSTRUCTION_SOFT, 1);
            this.strokePolyline(graphics, [c, this.midpoint(a, b)], CONSTRUCTION_SOFT, 1);
            this.strokePolyline(graphics, [o, h], CYAN, 2.2, 1.7);
            this.drawPoint(graphics, o, 5, CYAN);
            this.drawPoint(graphics, g, 5, CORAL);
            this.drawPoint(graphics, h, 5, CYAN);
            this.annotate(3, 'O', o, CYAN, 14, 4);
            this.annotate(4, 'G', g, CORAL, 14, -12);
            this.annotate(5, 'H', h, CYAN, 14, 4);
        } else if (this.variant === 1) {
            const o = this.circumcenter(a, b, c);
            const h = { x: a.x + b.x + c.x - 2 * o.x, y: a.y + b.y + c.y - 2 * o.y };
            const n = { x: (o.x + h.x) / 2, y: (o.y + h.y) / 2 };
            const points = [
                this.midpoint(a, b), this.midpoint(b, c), this.midpoint(c, a),
                this.foot(a, b, c), this.foot(b, a, c), this.foot(c, a, b),
            ];
            this.strokeCircle(graphics, n, this.distance(o, a) / 2, CYAN, 2);
            points.forEach((point) => this.drawPoint(graphics, point, 4.2, CORAL));
            this.annotate(3, 'N', n, CYAN, 14, 4);
            this.strokePolyline(graphics, [a, this.foot(a, b, c)], CONSTRUCTION_SOFT, 1);
            this.strokePolyline(graphics, [b, this.foot(b, a, c)], CONSTRUCTION_SOFT, 1);
            this.strokePolyline(graphics, [c, this.foot(c, a, b)], CONSTRUCTION_SOFT, 1);
        } else if (this.variant === 2) {
            const ca = this.equilateralCenter(a, b, c);
            const cb = this.equilateralCenter(b, c, a);
            const cc = this.equilateralCenter(c, a, b);
            this.strokePolyline(graphics, [a, b, this.equilateralVertex(a, b, c), a], CONSTRUCTION_SOFT, 1.2);
            this.strokePolyline(graphics, [b, c, this.equilateralVertex(b, c, a), b], CONSTRUCTION_SOFT, 1.2);
            this.strokePolyline(graphics, [c, a, this.equilateralVertex(c, a, b), c], CONSTRUCTION_SOFT, 1.2);
            this.strokePolyline(graphics, [ca, cb, cc, ca], CYAN, 2.4);
            [ca, cb, cc].forEach((point) => this.drawPoint(graphics, point, 4.5, CORAL));
            this.annotate(3, 'C₁', ca, CORAL, 16, 4);
            this.annotate(4, 'C₂', cb, CORAL, 16, 4);
            this.annotate(5, 'C₃', cc, CORAL, 16, 4);
        } else {
            const o = this.circumcenter(a, b, c);
            const radius = this.distance(o, a);
            const p = {
                x: o.x + Math.cos(this.phase * 1.35) * radius,
                y: o.y + Math.sin(this.phase * 1.35) * radius,
            };
            const feet = [this.foot(p, a, b), this.foot(p, b, c), this.foot(p, c, a)];
            this.strokeCircle(graphics, o, radius, CONSTRUCTION_SOFT, 1.2);
            feet.forEach((foot) => this.strokePolyline(graphics, [p, foot], CONSTRUCTION_SOFT, 1));
            this.strokePolyline(graphics, feet, CYAN, 2.4, 1.8);
            this.drawPoint(graphics, p, 6, CORAL);
            this.annotate(3, 'P', p, CORAL, 16, 6);
            feet.forEach((foot) => this.drawPoint(graphics, foot, 3.8, CYAN));
        }
        [a, b, c].forEach((point) => this.drawPoint(graphics, point, 5, INK));
        this.annotate(0, 'A', a, INK, -14, -14);
        this.annotate(1, 'B', b, INK, 14, -14);
        this.annotate(2, 'C', c, INK, 0, 16);
    }

    private triangleAt(phase: number, scale: number): { a: Point; b: Point; c: Point } {
        return {
            a: {
                x: -scale * (0.86 + 0.06 * Math.sin(phase * 0.74)),
                y: -scale * (0.56 + 0.035 * Math.cos(phase)),
            },
            b: {
                x: scale * (0.82 + 0.05 * Math.cos(phase * 0.83)),
                y: -scale * (0.42 + 0.06 * Math.sin(phase * 0.61)),
            },
            c: {
                x: -scale * 0.10 + Math.sin(phase * 0.77) * scale * 0.24,
                y: scale * (0.82 + 0.09 * Math.cos(phase * 0.58)),
            },
        };
    }

    private metricText(): string {
        if (this.familyId === 'triangle-motion') {
            return [
                'O — G — H  ·  OG : GH = 1 : 2',
                'R₉ = R / 2  ·  6 tracked points',
                'CENTER TRIANGLE  ·  equilateral invariant',
                'PROJECTION ERROR  < 0.001',
            ][this.variant];
        }
        if (this.familyId === 'circle-motion') {
            return [
                'PA · PB = PC · PD',
                'PT₁ = PT₂',
                'Π₁(X) = Π₂(X)',
                'OP · OP′ = R²',
            ][this.variant];
        }
        return [
            'x = sin(3t + δ)  ·  y = sin(2t)',
            'R : r = 4 : 1',
            'R : r = 3 : 1',
            'x = r(t − sin t)  ·  y = r(1 − cos t)',
        ][this.variant];
    }

    private drawCircleFamily(graphics: Graphics): void {
        const unit = Math.min(this.plotWidth, this.plotHeight);
        const radius = unit * 0.27;
        const center = { x: this.variant === 2 ? -radius * 0.55 : 0, y: 0 };
        if (this.variant === 0) {
            this.strokeCircle(graphics, center, radius, CONSTRUCTION, 2);
            const angles = [0.25 + this.phase, 2.8 - this.phase * 0.45, 1.2 - this.phase * 0.8, 4.5 + this.phase * 0.4];
            const points = angles.map((angle) => this.onCircle(center, radius, angle));
            this.strokePolyline(graphics, [points[0], points[1]], CYAN, 2);
            this.strokePolyline(graphics, [points[2], points[3]], CORAL, 2);
            const intersection = this.lineIntersection(points[0], points[1], points[2], points[3]);
            if (intersection) {
                this.strokeCircle(graphics, intersection, 12, CYAN_SOFT, 1.3);
                this.drawPoint(graphics, intersection, 4.5, INK);
            }
            points.forEach((point) => this.drawPoint(graphics, point, 4.5, INK));
        } else if (this.variant === 1) {
            this.strokeCircle(graphics, center, radius, CONSTRUCTION, 2);
            const distance = radius * (1.55 + 0.16 * Math.sin(this.phase));
            const p = this.onCircle(center, distance, this.phase * 0.42);
            this.strokeCircle(graphics, center, distance, new Color(CORAL.r, CORAL.g, CORAL.b, 42), 1);
            const alpha = Math.acos(radius / distance);
            const base = Math.atan2(p.y - center.y, p.x - center.x);
            const t1 = this.onCircle(center, radius, base + alpha);
            const t2 = this.onCircle(center, radius, base - alpha);
            this.strokePolyline(graphics, [p, t1], CYAN, 2.2);
            this.strokePolyline(graphics, [p, t2], CYAN, 2.2);
            this.drawPoint(graphics, p, 6, CORAL);
            this.drawPoint(graphics, t1, 4, INK);
            this.drawPoint(graphics, t2, 4, INK);
        } else if (this.variant === 2) {
            const second = { x: radius * 0.78, y: radius * 0.12 * Math.sin(this.phase) };
            const r1 = radius * (0.88 + 0.08 * Math.sin(this.phase));
            const r2 = radius * (0.72 + 0.11 * Math.cos(this.phase * 0.8));
            for (const offset of [-0.7, -0.35]) {
                const ghostSecond = { x: radius * 0.78, y: radius * 0.12 * Math.sin(this.phase + offset) };
                this.strokeCircle(graphics, center, radius * (0.88 + 0.08 * Math.sin(this.phase + offset)), CONSTRUCTION_SOFT, 1);
                this.strokeCircle(graphics, ghostSecond, radius * (0.72 + 0.11 * Math.cos((this.phase + offset) * 0.8)), CYAN_SOFT, 1);
            }
            this.strokeCircle(graphics, center, r1, CYAN, 2);
            this.strokeCircle(graphics, second, r2, CORAL, 2);
            const d = second.x - center.x;
            const x = center.x + (d * d + r1 * r1 - r2 * r2) / (2 * d);
            this.strokePolyline(
                graphics,
                [{ x, y: -this.plotHeight * 0.36 }, { x, y: this.plotHeight * 0.36 }],
                CONSTRUCTION,
                2,
            );
        } else {
            this.strokeCircle(graphics, center, radius, CONSTRUCTION, 2);
            const pDistance = radius * (0.32 + 0.52 * (0.5 + 0.5 * Math.sin(this.phase * 0.82)));
            const angle = this.phase * 0.58 + 0.35;
            const p = this.onCircle(center, pDistance, angle);
            const inverse = this.onCircle(center, radius * radius / pDistance, angle);
            const inverseTrail: Point[] = [];
            for (let index = 0; index <= 96; index += 1) {
                const samplePhase = index / 96 * TAU;
                const sampleDistance = radius * (0.32 + 0.52 * (0.5 + 0.5 * Math.sin(samplePhase * 0.82)));
                inverseTrail.push(this.onCircle(center, radius * radius / sampleDistance, samplePhase * 0.58 + 0.35));
            }
            this.strokePolyline(graphics, inverseTrail, CYAN_SOFT, 1.4);
            this.strokePolyline(graphics, [center, inverse], CONSTRUCTION_SOFT, 1.4);
            this.drawPoint(graphics, p, 6, CORAL);
            this.drawPoint(graphics, inverse, 6, CYAN);
        }
        this.drawPoint(graphics, center, 3.5, INK);
        this.annotate(0, 'O', center, INK, 14, -12);
    }

    private drawCurveFamily(graphics: Graphics): void {
        const scaleX = this.plotWidth * 0.38;
        const scaleY = this.plotHeight * 0.34;
        const points: Point[] = [];
        let marker: Point = { x: 0, y: 0 };
        if (this.variant === 0) {
            for (let index = 0; index <= 420; index += 1) {
                const t = index / 420 * TAU;
                points.push({ x: Math.sin(3 * t + 0.6) * scaleX, y: Math.sin(2 * t) * scaleY });
            }
            marker = { x: Math.sin(3 * this.phase + 0.6) * scaleX, y: Math.sin(2 * this.phase) * scaleY };
            this.strokePolyline(graphics, [{ x: -scaleX, y: 0 }, { x: scaleX, y: 0 }], CONSTRUCTION_SOFT, 1);
            this.strokePolyline(graphics, [{ x: 0, y: -scaleY }, { x: 0, y: scaleY }], CONSTRUCTION_SOFT, 1);
        } else if (this.variant === 1 || this.variant === 2) {
            const outer = Math.min(scaleX, scaleY) * 0.72;
            const rolling = outer / (this.variant === 1 ? 4 : 3);
            for (let index = 0; index <= 420; index += 1) {
                const t = index / 420 * TAU;
                points.push(this.roulettePoint(t, outer, rolling, this.variant === 1));
            }
            marker = this.roulettePoint(this.phase, outer, rolling, this.variant === 1);
            this.strokeCircle(graphics, { x: 0, y: 0 }, outer, CONSTRUCTION_SOFT, 1.2);
            const centerRadius = this.variant === 1 ? outer + rolling : outer - rolling;
            const rollingCenter = this.onCircle({ x: 0, y: 0 }, centerRadius, this.phase);
            this.strokeCircle(graphics, rollingCenter, rolling, CONSTRUCTION, 1.5);
            this.strokePolyline(graphics, [rollingCenter, marker], CONSTRUCTION, 1.2);
        } else {
            const wheelRadius = Math.min(scaleY * 0.56, scaleX / 4.2);
            const span = scaleX * 1.72;
            for (let index = 0; index <= 500; index += 1) {
                const t = index / 500 * 5 * TAU;
                points.push({
                    x: -span / 2 + t / (5 * TAU) * span,
                    y: -scaleY * 0.42 + wheelRadius * (1 - Math.cos(t)),
                });
            }
            const local = (this.phase / TAU * 5 * TAU) % TAU;
            const cx = -span / 2 + this.phase / TAU * span;
            const cy = -scaleY * 0.42 + wheelRadius;
            marker = { x: cx - wheelRadius * Math.sin(local), y: cy - wheelRadius * Math.cos(local) };
            this.strokeCircle(graphics, { x: cx, y: cy }, wheelRadius, CONSTRUCTION, 1.5);
            this.strokePolyline(graphics, [{ x: cx, y: cy }, marker], CONSTRUCTION, 1.2);
            this.strokePolyline(graphics, [{ x: -scaleX, y: -scaleY * 0.42 }, { x: scaleX, y: -scaleY * 0.42 }], CONSTRUCTION_SOFT, 1);
        }
        this.strokePolyline(graphics, points, CYAN_SOFT, 6);
        this.strokePolyline(graphics, points, CYAN, 2.1);
        this.drawPoint(graphics, marker, 6.5, CORAL);
        this.strokeCircle(graphics, marker, 12, CORAL_SOFT, 1.4);
        this.annotate(0, 'P(t)', marker, CORAL, 22, 7);
    }

    private roulettePoint(t: number, radius: number, rolling: number, outside: boolean): Point {
        if (outside) {
            const sum = radius + rolling;
            return {
                x: sum * Math.cos(t) - rolling * Math.cos(sum / rolling * t),
                y: sum * Math.sin(t) - rolling * Math.sin(sum / rolling * t),
            };
        }
        const difference = radius - rolling;
        return {
            x: difference * Math.cos(t) + rolling * Math.cos(difference / rolling * t),
            y: difference * Math.sin(t) - rolling * Math.sin(difference / rolling * t),
        };
    }

    private circumcenter(a: Point, b: Point, c: Point): Point {
        const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
        const aa = a.x * a.x + a.y * a.y;
        const bb = b.x * b.x + b.y * b.y;
        const cc = c.x * c.x + c.y * c.y;
        return {
            x: (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d,
            y: (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d,
        };
    }

    private lineIntersection(a: Point, b: Point, c: Point, d: Point): Point | null {
        const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
        if (Math.abs(denominator) < 0.0001) {
            return null;
        }
        const first = a.x * b.y - a.y * b.x;
        const second = c.x * d.y - c.y * d.x;
        return {
            x: (first * (c.x - d.x) - (a.x - b.x) * second) / denominator,
            y: (first * (c.y - d.y) - (a.y - b.y) * second) / denominator,
        };
    }

    private foot(point: Point, a: Point, b: Point): Point {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy);
        return { x: a.x + dx * t, y: a.y + dy * t };
    }

    private equilateralVertex(a: Point, b: Point, opposite: Point): Point {
        const midpoint = this.midpoint(a, b);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const side = Math.sqrt(dx * dx + dy * dy);
        const sign = Math.sign(dx * (opposite.y - midpoint.y) - dy * (opposite.x - midpoint.x)) || 1;
        return {
            x: midpoint.x + sign * dy / side * side * Math.sqrt(3) / 2,
            y: midpoint.y - sign * dx / side * side * Math.sqrt(3) / 2,
        };
    }

    private equilateralCenter(a: Point, b: Point, opposite: Point): Point {
        const vertex = this.equilateralVertex(a, b, opposite);
        return { x: (a.x + b.x + vertex.x) / 3, y: (a.y + b.y + vertex.y) / 3 };
    }

    private midpoint(a: Point, b: Point): Point {
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    private onCircle(center: Point, radius: number, angle: number): Point {
        return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    }

    private distance(a: Point, b: Point): number {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    private strokeCircle(graphics: Graphics, center: Point, radius: number, color: Color, lineWidth: number): void {
        graphics.strokeColor = color;
        graphics.lineWidth = lineWidth;
        graphics.circle(center.x, center.y, radius);
        graphics.stroke();
    }

    private strokePolyline(
        graphics: Graphics,
        points: readonly Point[],
        color: Color,
        lineWidth: number,
        extension = 1,
    ): void {
        if (points.length === 0) {
            return;
        }
        graphics.strokeColor = color;
        graphics.lineWidth = lineWidth;
        const first = points[0];
        const last = points[points.length - 1];
        if (extension > 1 && points.length === 2) {
            const dx = last.x - first.x;
            const dy = last.y - first.y;
            const extra = (extension - 1) / 2;
            graphics.moveTo(first.x - dx * extra, first.y - dy * extra);
            graphics.lineTo(last.x + dx * extra, last.y + dy * extra);
        } else {
            graphics.moveTo(first.x, first.y);
            for (let index = 1; index < points.length; index += 1) {
                graphics.lineTo(points[index].x, points[index].y);
            }
        }
        graphics.stroke();
    }

    private drawPoint(graphics: Graphics, point: Point, radius: number, color: Color): void {
        graphics.fillColor = color;
        graphics.circle(point.x, point.y, radius);
        graphics.fill();
    }

    private annotate(
        index: number,
        text: string,
        point: Point,
        color: Color,
        offsetX: number,
        offsetY: number,
    ): void {
        const label = this.annotationLabels[index];
        if (!label) {
            return;
        }
        label.string = text;
        label.color = color;
        label.node.setPosition(point.x + offsetX, point.y + offsetY, 0);
    }
}
