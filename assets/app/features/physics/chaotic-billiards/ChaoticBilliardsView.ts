import {
    Color,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Node,
} from 'cc';
import {
    ParameterPanel,
    type ParameterPanelLayout,
} from '../../../parameters/ParameterPanel';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import type {
    ViewportBreakpoint,
    ViewportSnapshot,
} from '../../../services/ViewportService';
import {
    clearNode,
    createLabel,
    createUiNode,
    fillNode,
    palette,
    strokeNode,
} from '../../../ui/UiFactory';
import type {
    BilliardCollisionMarker,
    BilliardParticleState,
    BilliardTrailPoint,
    BilliardVector,
    ChaoticBilliardsViewState,
} from './ChaoticBilliardsTypes';
import type { ChaoticBilliardsViewModel } from './ChaoticBilliardsViewModel';

const PRIMARY_COLOR = new Color(126, 190, 166, 255);
const PRIMARY_TRAIL = new Color(126, 190, 166, 220);
const NEARBY_COLOR = new Color(210, 167, 96, 255);
const NEARBY_TRAIL = new Color(210, 167, 96, 170);
const NORMAL_COLOR = new Color(215, 221, 207, 185);
const CONTENT_GAP = 14;

export interface ChaoticBilliardsViewActions {
    parameterChanged(key: string): void;
    reportError(error: unknown): void;
}

export class ChaoticBilliardsView {
    private parameterPanel: ParameterPanel | null = null;
    private parameterPanelParent: Node | null = null;
    private parameterPanelLayout: ParameterPanelLayout | null = null;
    private boundaryGraphics: Graphics | null = null;
    private trailGraphics: Graphics | null = null;
    private particleGraphics: Graphics | null = null;
    private vectorGraphics: Graphics | null = null;
    private diagnosticsLabel: Label | null = null;
    private modelLabel: Label | null = null;
    private plotWidth = 1;
    private plotHeight = 1;
    private worldScale = 1;

    constructor(
        private readonly root: Node,
        private readonly parameterSchema: ParameterSchema,
        private readonly viewModel: ChaoticBilliardsViewModel,
        private readonly actions: ChaoticBilliardsViewActions,
    ) {}

    layout(viewport: ViewportSnapshot): void {
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.parameterPanelParent = null;
        this.parameterPanelLayout = null;
        this.boundaryGraphics = null;
        this.trailGraphics = null;
        this.particleGraphics = null;
        this.vectorGraphics = null;
        this.diagnosticsLabel = null;
        this.modelLabel = null;
        clearNode(this.root);
        this.root.setPosition(0, 0, 0);
        fillNode(this.root, viewport.width, viewport.height, palette.background);

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = Math.max(
            1,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const contentWidth = Math.max(
            1,
            Math.min(1320, safeWidth - (compact ? 32 : 72)),
        );
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const contentTop = viewport.height / 2
            - viewport.safeInsets.top
            - (compact ? 70 : 78);
        const contentBottom = -viewport.height / 2
            + viewport.safeInsets.bottom
            + 12;
        const contentHeight = Math.max(1, contentTop - contentBottom);
        const centerY = (contentTop + contentBottom) / 2;
        const sideInspector = viewport.orientation === 'landscape'
            && safeWidth >= 940
            && contentHeight >= 640;

        if (sideInspector) {
            this.layoutSideBySide(
                centerX,
                centerY,
                contentWidth,
                contentHeight,
                viewport.breakpoint,
            );
        } else {
            this.layoutStacked(
                centerX,
                contentTop,
                contentBottom,
                contentWidth,
                contentHeight,
                viewport.breakpoint,
            );
        }
        this.rebuildParameterPanel();
    }

    render(state: ChaoticBilliardsViewState): void {
        if (
            !this.boundaryGraphics
            || !this.trailGraphics
            || !this.particleGraphics
            || !this.vectorGraphics
        ) {
            return;
        }
        const halfLength = state.parameters.boundary === 'circle'
            ? 0
            : state.parameters.straightHalfLength;
        const horizontalExtent = halfLength + state.parameters.radius;
        this.worldScale = Math.min(
            Math.max(1, (this.plotWidth - 64) / (horizontalExtent * 2)),
            Math.max(1, (this.plotHeight - 80) / (state.parameters.radius * 2)),
        );

        this.drawBoundary(state);
        this.drawTrails(state);
        this.drawParticles(state);
        this.drawVectors(state);
        if (this.diagnosticsLabel) {
            this.diagnosticsLabel.string = state.diagnosticsText;
        }
        if (this.modelLabel) {
            this.modelLabel.string = state.modelSummary;
        }
    }

    refreshParameterPanel(): void {
        this.rebuildParameterPanel();
    }

    destroy(): void {
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.parameterPanelParent = null;
        this.parameterPanelLayout = null;
        clearNode(this.root);
    }

    private layoutSideBySide(
        centerX: number,
        centerY: number,
        contentWidth: number,
        contentHeight: number,
        breakpoint: ViewportBreakpoint,
    ): void {
        const inspectorWidth = Math.min(380, Math.max(330, contentWidth * 0.29));
        this.plotWidth = Math.max(1, contentWidth - inspectorWidth - CONTENT_GAP);
        this.plotHeight = contentHeight;
        const leftEdge = centerX - contentWidth / 2;
        const plot = this.createVisualizationPanel(
            leftEdge + this.plotWidth / 2,
            centerY,
        );
        const parameterWidth = inspectorWidth - 16;
        const parameterHeight = ParameterPanel.measureHeight(
            this.parameterSchema.length,
            parameterWidth,
            'compact',
        );
        const equationHeight = Math.max(
            180,
            contentHeight - parameterHeight - CONTENT_GAP - 8,
        );
        const inspector = this.createInspectorPanel(
            inspectorWidth,
            contentHeight,
            leftEdge + this.plotWidth + CONTENT_GAP + inspectorWidth / 2,
            centerY,
            false,
            equationHeight,
        );
        this.parameterPanelParent = inspector;
        this.parameterPanelLayout = {
            width: parameterWidth,
            x: 0,
            y: -contentHeight / 2 + 8 + parameterHeight / 2,
            breakpoint: 'compact',
        };
        this.createGraphicsLayers(plot);
        this.createVisualizationOverlays(plot, breakpoint === 'compact');
    }

    private layoutStacked(
        centerX: number,
        contentTop: number,
        contentBottom: number,
        contentWidth: number,
        contentHeight: number,
        breakpoint: ViewportBreakpoint,
    ): void {
        const panelBreakpoint: ViewportBreakpoint = breakpoint === 'wide'
            ? 'medium'
            : breakpoint;
        const parameterHeight = ParameterPanel.measureHeight(
            this.parameterSchema.length,
            contentWidth,
            panelBreakpoint,
        );
        const equationHeight = contentWidth >= 620 ? 126 : 156;
        const inspectorHeight = equationHeight + CONTENT_GAP + parameterHeight;
        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(
            190,
            contentHeight - inspectorHeight - CONTENT_GAP,
        );
        const plot = this.createVisualizationPanel(
            centerX,
            contentTop - this.plotHeight / 2,
        );
        const inspector = this.createInspectorPanel(
            contentWidth,
            inspectorHeight,
            centerX,
            contentBottom + inspectorHeight / 2,
            true,
            equationHeight,
        );
        this.parameterPanelParent = inspector;
        this.parameterPanelLayout = {
            width: contentWidth,
            x: 0,
            y: -inspectorHeight / 2 + parameterHeight / 2,
            breakpoint: panelBreakpoint,
        };
        this.createGraphicsLayers(plot);
        this.createVisualizationOverlays(plot, breakpoint === 'compact');
    }

    private createVisualizationPanel(x: number, y: number): Node {
        const plot = createUiNode(
            this.root,
            'ChaoticBilliardsPlot',
            this.plotWidth,
            this.plotHeight,
            x,
            y,
        );
        const radius = Math.min(10, this.plotWidth / 2, this.plotHeight / 2);
        fillNode(plot, this.plotWidth, this.plotHeight, palette.surface, radius);
        strokeNode(plot, this.plotWidth, this.plotHeight, palette.border, radius, 1);
        return plot;
    }

    private createGraphicsLayers(plot: Node): void {
        this.boundaryGraphics = this.createGraphicsLayer(plot, 'BilliardBoundary');
        this.trailGraphics = this.createGraphicsLayer(plot, 'BilliardTrails');
        this.particleGraphics = this.createGraphicsLayer(plot, 'BilliardParticles');
        this.vectorGraphics = this.createGraphicsLayer(plot, 'BilliardVectors');
    }

    private createInspectorPanel(
        width: number,
        height: number,
        x: number,
        y: number,
        horizontal: boolean,
        requestedHeight: number,
    ): Node {
        const inspector = createUiNode(
            this.root,
            'ChaoticBilliardsInspector',
            width,
            height,
            x,
            y,
        );
        const equationHeight = requestedHeight;
        const card = createUiNode(
            inspector,
            'ChaoticBilliardsEquationCard',
            width,
            equationHeight,
            0,
            height / 2 - equationHeight / 2,
        );
        fillNode(card, width, equationHeight, palette.surfaceSoft, 9);
        strokeNode(card, width, equationHeight, palette.border, 9, 1);
        createLabel(
            card,
            'PLANAR BILLIARD · EXACT SPECULAR COLLISIONS',
            Math.max(1, width - 24),
            22,
            horizontal ? 9 : 10,
            palette.subtle,
            0,
            equationHeight / 2 - 17,
            HorizontalTextAlignment.LEFT,
        );

        const formula = [
            "v′ = v − 2(v·n)n",
            'θout = θin     |v′| = |v|',
            'Δθ₀ ≪ 1 → Δr(t)',
        ].join('\n');
        const explanation = [
            'circle: integrable, nearby paths remain ordered',
            'stadium: defocusing collisions create sensitive dependence',
            'no random force · no friction · point particles · z = 0',
        ].join('\n');

        if (horizontal && width >= 650) {
            const formulaWidth = Math.max(250, width * 0.42);
            const explanationWidth = width - formulaWidth - 36;
            this.createMultilineLabel(
                card,
                formula,
                formulaWidth,
                equationHeight - 34,
                12,
                palette.primaryText,
                -width / 2 + formulaWidth / 2 + 12,
                -8,
                20,
            );
            this.createMultilineLabel(
                card,
                explanation,
                explanationWidth,
                equationHeight - 34,
                9,
                palette.muted,
                width / 2 - explanationWidth / 2 - 12,
                -8,
                16,
            );
        } else {
            const formulaHeight = Math.min(92, equationHeight * 0.46);
            this.createMultilineLabel(
                card,
                formula,
                Math.max(1, width - 24),
                formulaHeight,
                11,
                palette.primaryText,
                0,
                equationHeight / 2 - 28 - formulaHeight / 2,
                19,
            );
            const explanationHeight = Math.max(1, equationHeight - formulaHeight - 38);
            this.createMultilineLabel(
                card,
                explanation,
                Math.max(1, width - 24),
                explanationHeight,
                9,
                palette.muted,
                0,
                -equationHeight / 2 + explanationHeight / 2 + 8,
                15,
            );
        }
        return inspector;
    }

    private createVisualizationOverlays(plot: Node, compact: boolean): void {
        createLabel(
            plot,
            'TOP VIEW · PRIMARY AND NEARBY INITIAL ANGLES',
            Math.max(1, this.plotWidth - 32),
            22,
            compact ? 8 : 9,
            palette.subtle,
            0,
            this.plotHeight / 2 - 18,
            HorizontalTextAlignment.LEFT,
        );
        createLabel(
            plot,
            '● primary    ● nearby',
            174,
            22,
            compact ? 8 : 9,
            palette.muted,
            this.plotWidth / 2 - 101,
            this.plotHeight / 2 - 18,
            HorizontalTextAlignment.RIGHT,
        );
        const statusWidth = Math.min(560, Math.max(1, this.plotWidth - 28));
        const statusCard = createUiNode(
            plot,
            'ChaoticBilliardsStatus',
            statusWidth,
            compact ? 54 : 60,
            -this.plotWidth / 2 + statusWidth / 2 + 14,
            -this.plotHeight / 2 + (compact ? 41 : 44),
        );
        fillNode(statusCard, statusWidth, compact ? 54 : 60, palette.backgroundRaised, 7);
        strokeNode(statusCard, statusWidth, compact ? 54 : 60, palette.border, 7, 1);
        const model = createLabel(
            statusCard,
            '',
            Math.max(1, statusWidth - 18),
            22,
            compact ? 8 : 10,
            palette.primaryText,
            0,
            13,
            HorizontalTextAlignment.LEFT,
        );
        this.modelLabel = model.getComponent(Label);
        const diagnostics = createLabel(
            statusCard,
            '',
            Math.max(1, statusWidth - 18),
            22,
            compact ? 8 : 9,
            palette.muted,
            0,
            -13,
            HorizontalTextAlignment.LEFT,
        );
        this.diagnosticsLabel = diagnostics.getComponent(Label);
        if (this.modelLabel) {
            this.modelLabel.enableWrapText = false;
        }
        if (this.diagnosticsLabel) {
            this.diagnosticsLabel.enableWrapText = false;
        }
    }

    private drawBoundary(state: ChaoticBilliardsViewState): void {
        const graphics = this.boundaryGraphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 2.2;
        const points = this.boundaryPoints(state);
        points.forEach((point, index) => {
            const projected = this.project(point);
            if (index === 0) {
                graphics.moveTo(projected.x, projected.y);
            } else {
                graphics.lineTo(projected.x, projected.y);
            }
        });
        if (points.length > 0) {
            const first = this.project(points[0]);
            graphics.lineTo(first.x, first.y);
        }
        graphics.stroke();

        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1;
        const horizontal = state.parameters.boundary === 'circle'
            ? state.parameters.radius
            : state.parameters.radius + state.parameters.straightHalfLength;
        const xAxisA = this.project({ x: -horizontal, y: 0 });
        const xAxisB = this.project({ x: horizontal, y: 0 });
        graphics.moveTo(xAxisA.x, xAxisA.y);
        graphics.lineTo(xAxisB.x, xAxisB.y);
        const yAxisA = this.project({ x: 0, y: -state.parameters.radius });
        const yAxisB = this.project({ x: 0, y: state.parameters.radius });
        graphics.moveTo(yAxisA.x, yAxisA.y);
        graphics.lineTo(yAxisB.x, yAxisB.y);
        graphics.stroke();
    }

    private boundaryPoints(state: ChaoticBilliardsViewState): BilliardVector[] {
        const radius = state.parameters.radius;
        if (state.parameters.boundary === 'circle') {
            const points: BilliardVector[] = [];
            for (let index = 0; index < 96; index += 1) {
                const angle = Math.PI * 2 * index / 96;
                points.push({
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius,
                });
            }
            return points;
        }

        const halfLength = state.parameters.straightHalfLength;
        const points: BilliardVector[] = [
            { x: -halfLength, y: radius },
            { x: halfLength, y: radius },
        ];
        for (let index = 1; index <= 48; index += 1) {
            const angle = Math.PI / 2 - Math.PI * index / 48;
            points.push({
                x: halfLength + Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
            });
        }
        points.push({ x: -halfLength, y: -radius });
        for (let index = 1; index <= 48; index += 1) {
            const angle = -Math.PI / 2 - Math.PI * index / 48;
            points.push({
                x: -halfLength + Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
            });
        }
        return points;
    }

    private drawTrails(state: ChaoticBilliardsViewState): void {
        const graphics = this.trailGraphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        this.drawTrail(graphics, state.primaryTrail, PRIMARY_TRAIL, 1.7);
        if (state.showNearby) {
            this.drawTrail(graphics, state.nearbyTrail, NEARBY_TRAIL, 1.2);
        }
    }

    private drawTrail(
        graphics: Graphics,
        trail: readonly BilliardTrailPoint[],
        color: Color,
        width: number,
    ): void {
        if (trail.length < 2) {
            return;
        }
        graphics.strokeColor = color;
        graphics.lineWidth = width;
        trail.forEach((point, index) => {
            const projected = this.project(point);
            if (index === 0) {
                graphics.moveTo(projected.x, projected.y);
            } else {
                graphics.lineTo(projected.x, projected.y);
            }
        });
        graphics.stroke();
    }

    private drawParticles(state: ChaoticBilliardsViewState): void {
        const graphics = this.particleGraphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        this.drawParticle(graphics, state.snapshot.primary, PRIMARY_COLOR, 6);
        if (state.showNearby) {
            this.drawParticle(graphics, state.snapshot.nearby, NEARBY_COLOR, 4.5);
        }
    }

    private drawParticle(
        graphics: Graphics,
        particle: BilliardParticleState,
        color: Color,
        radius: number,
    ): void {
        const point = this.project(particle);
        graphics.fillColor = color;
        graphics.circle(point.x, point.y, radius);
        graphics.fill();
    }

    private drawVectors(state: ChaoticBilliardsViewState): void {
        const graphics = this.vectorGraphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        this.drawVelocity(graphics, state.snapshot.primary, PRIMARY_COLOR);
        if (state.showNearby) {
            this.drawVelocity(graphics, state.snapshot.nearby, NEARBY_COLOR);
        }
        if (state.showNormals) {
            this.drawCollisionNormal(graphics, state.snapshot.primaryCollision);
            if (state.showNearby) {
                this.drawCollisionNormal(graphics, state.snapshot.nearbyCollision);
            }
        }
    }

    private drawVelocity(
        graphics: Graphics,
        particle: BilliardParticleState,
        color: Color,
    ): void {
        const start = this.project(particle);
        const speed = Math.max(1e-9, Math.hypot(particle.vx, particle.vy));
        const length = 34;
        const end = {
            x: start.x + particle.vx / speed * length,
            y: start.y + particle.vy / speed * length,
        };
        graphics.strokeColor = color;
        graphics.lineWidth = 1.4;
        graphics.moveTo(start.x, start.y);
        graphics.lineTo(end.x, end.y);
        graphics.stroke();
    }

    private drawCollisionNormal(
        graphics: Graphics,
        collision: BilliardCollisionMarker | null,
    ): void {
        if (!collision) {
            return;
        }
        const point = this.project(collision.point);
        const inward = {
            x: point.x - collision.normal.x * 28,
            y: point.y - collision.normal.y * 28,
        };
        graphics.strokeColor = NORMAL_COLOR;
        graphics.lineWidth = 1.2;
        graphics.moveTo(point.x, point.y);
        graphics.lineTo(inward.x, inward.y);
        graphics.stroke();
    }

    private project(point: BilliardVector): BilliardVector {
        return {
            x: point.x * this.worldScale,
            y: point.y * this.worldScale,
        };
    }

    private createGraphicsLayer(parent: Node, name: string): Graphics {
        return createUiNode(
            parent,
            name,
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
    }

    private createMultilineLabel(
        parent: Node,
        text: string,
        width: number,
        height: number,
        fontSize: number,
        color: Color,
        x: number,
        y: number,
        lineHeight: number,
    ): void {
        const node = createLabel(
            parent,
            text,
            width,
            Math.max(1, height),
            fontSize,
            color,
            x,
            y,
            HorizontalTextAlignment.LEFT,
        );
        const label = node.getComponent(Label);
        if (label) {
            label.lineHeight = lineHeight;
        }
    }

    private rebuildParameterPanel(): void {
        const parent = this.parameterPanelParent;
        const layout = this.parameterPanelLayout;
        if (!parent || !layout) {
            return;
        }
        this.parameterPanel?.destroy();
        this.parameterPanel = new ParameterPanel(
            parent,
            this.parameterSchema,
            this.viewModel,
            (key) => this.actions.parameterChanged(key),
            (error) => this.actions.reportError(error),
        );
        this.parameterPanel.render(layout);
    }
}
