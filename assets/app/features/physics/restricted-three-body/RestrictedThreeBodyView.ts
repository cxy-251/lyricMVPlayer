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
    PlanarBodyState,
    PlanarThreeBodyViewState,
    PlanarVector,
} from './RestrictedThreeBodyTypes';
import type { PlanarThreeBodyViewModel } from './RestrictedThreeBodyViewModel';

const BODY_COLORS = [
    new Color(126, 190, 166, 255),
    new Color(210, 167, 96, 255),
    new Color(151, 165, 211, 255),
] as const;
const TRAIL_COLORS = [
    new Color(126, 190, 166, 220),
    new Color(210, 167, 96, 205),
    new Color(151, 165, 211, 205),
] as const;
const CONTENT_GAP = 14;
const SIDE_EQUATION_HEIGHT = 170;

export interface PlanarThreeBodyViewActions {
    parameterChanged(key: string): void;
    reportError(error: unknown): void;
}

export class PlanarThreeBodyView {
    private parameterPanel: ParameterPanel | null = null;
    private parameterPanelParent: Node | null = null;
    private parameterPanelLayout: ParameterPanelLayout | null = null;
    private sceneGraphics: Graphics | null = null;
    private trailGraphics: Graphics | null = null;
    private bodyGraphics: Graphics | null = null;
    private vectorGraphics: Graphics | null = null;
    private diagnosticsLabel: Label | null = null;
    private modelLabel: Label | null = null;
    private plotWidth = 1;
    private plotHeight = 1;
    private worldScale = 1;

    constructor(
        private readonly root: Node,
        private readonly parameterSchema: ParameterSchema,
        private readonly viewModel: PlanarThreeBodyViewModel,
        private readonly actions: PlanarThreeBodyViewActions,
    ) {}

    layout(viewport: ViewportSnapshot): void {
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.parameterPanelParent = null;
        this.parameterPanelLayout = null;
        this.sceneGraphics = null;
        this.trailGraphics = null;
        this.bodyGraphics = null;
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
            && safeWidth >= 920
            && contentHeight >= 440;

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

    render(state: PlanarThreeBodyViewState): void {
        if (
            !this.sceneGraphics
            || !this.trailGraphics
            || !this.bodyGraphics
            || !this.vectorGraphics
        ) {
            return;
        }
        const span = this.calculateWorldSpan(state);
        this.worldScale = Math.min(
            Math.max(1, (this.plotWidth - 54) / (span * 2)),
            Math.max(1, (this.plotHeight - 70) / (span * 2)),
        );
        this.drawScene(state, span);
        this.drawTrails(state);
        this.drawBodies(state.snapshot.bodies);
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
        const inspectorWidth = Math.min(370, Math.max(310, contentWidth * 0.27));
        this.plotWidth = Math.max(1, contentWidth - inspectorWidth - CONTENT_GAP);
        this.plotHeight = contentHeight;
        const leftEdge = centerX - contentWidth / 2;
        const plot = this.createVisualizationPanel(
            leftEdge + this.plotWidth / 2,
            centerY,
        );
        const inspector = this.createInspectorPanel(
            inspectorWidth,
            contentHeight,
            leftEdge + this.plotWidth + CONTENT_GAP + inspectorWidth / 2,
            centerY,
            false,
            SIDE_EQUATION_HEIGHT,
        );
        const panelWidth = inspectorWidth - 16;
        const panelHeight = Math.max(
            1,
            contentHeight - SIDE_EQUATION_HEIGHT - CONTENT_GAP - 8,
        );
        this.parameterPanelParent = inspector;
        this.parameterPanelLayout = {
            width: panelWidth,
            height: panelHeight,
            x: 0,
            y: -contentHeight / 2 + 8 + panelHeight / 2,
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
        const panelHeight = ParameterPanel.measureHeight(
            this.parameterSchema.length,
            contentWidth,
            panelBreakpoint,
        );
        const equationHeight = contentWidth >= 620 ? 120 : 150;
        const inspectorHeight = equationHeight + CONTENT_GAP + panelHeight;
        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(180, contentHeight - inspectorHeight - CONTENT_GAP);
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
            y: -inspectorHeight / 2 + panelHeight / 2,
            breakpoint: panelBreakpoint,
        };
        this.createGraphicsLayers(plot);
        this.createVisualizationOverlays(plot, breakpoint === 'compact');
    }

    private createVisualizationPanel(x: number, y: number): Node {
        const plot = createUiNode(
            this.root,
            'PlanarThreeBodyPlot',
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
        this.sceneGraphics = this.createGraphicsLayer(plot, 'ThreeBodyScene');
        this.trailGraphics = this.createGraphicsLayer(plot, 'ThreeBodyTrails');
        this.bodyGraphics = this.createGraphicsLayer(plot, 'ThreeBodyBodies');
        this.vectorGraphics = this.createGraphicsLayer(plot, 'ThreeBodyVectors');
    }

    private createInspectorPanel(
        width: number,
        height: number,
        x: number,
        y: number,
        horizontal: boolean,
        requestedHeight?: number,
    ): Node {
        const inspector = createUiNode(
            this.root,
            'PlanarThreeBodyInspector',
            width,
            height,
            x,
            y,
        );
        const equationHeight = requestedHeight
            ?? Math.min(268, Math.max(216, height * 0.43));
        const card = createUiNode(
            inspector,
            'PlanarThreeBodyEquationCard',
            width,
            equationHeight,
            0,
            height / 2 - equationHeight / 2,
        );
        fillNode(card, width, equationHeight, palette.surfaceSoft, 9);
        strokeNode(card, width, equationHeight, palette.border, 9, 1);
        createLabel(
            card,
            'PLANAR NEWTONIAN THREE-BODY MOTION · z = 0',
            Math.max(1, width - 24),
            22,
            horizontal ? 9 : 10,
            palette.subtle,
            0,
            equationHeight / 2 - 17,
            HorizontalTextAlignment.LEFT,
        );
        const formula = [
            'r̈ᵢ = G Σⱼ≠ᵢ mⱼ(rⱼ − rᵢ)',
            '        ─────────────────',
            '        (|rⱼ−rᵢ|²+ε²)³ᐟ²',
            'Rcm = Σmᵢrᵢ / Σmᵢ     P = Σmᵢvᵢ',
        ].join('\n');
        const explanation = [
            'all three masses are dynamic',
            'inertial frame centered on the system barycenter',
            'ε = 0.015 only regularizes near-contact forces',
            'RK4 Δt = ¹⁄₆₀₀ · no stop-on-collision boundary',
        ].join('\n');

        if (horizontal && width >= 650) {
            const formulaWidth = Math.max(280, width * 0.48);
            const explanationWidth = width - formulaWidth - 36;
            this.createMultilineLabel(
                card,
                formula,
                formulaWidth,
                equationHeight - 34,
                11,
                palette.primaryText,
                -width / 2 + formulaWidth / 2 + 12,
                -8,
                18,
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
            this.createMultilineLabel(
                card,
                formula,
                Math.max(1, width - 24),
                92,
                10,
                palette.primaryText,
                0,
                equationHeight / 2 - 76,
                17,
            );
            this.createMultilineLabel(
                card,
                explanation,
                Math.max(1, width - 24),
                Math.max(1, equationHeight - 112),
                9,
                palette.muted,
                0,
                -equationHeight / 2 + Math.max(1, equationHeight - 112) / 2 + 8,
                15,
            );
        }
        return inspector;
    }

    private createVisualizationOverlays(plot: Node, compact: boolean): void {
        createLabel(
            plot,
            'INERTIAL XY PLANE · THREE TRAJECTORIES · COMMON BARYCENTER',
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
            '● m₁    ● m₂    ● m₃',
            170,
            22,
            compact ? 8 : 9,
            palette.muted,
            this.plotWidth / 2 - 99,
            this.plotHeight / 2 - 18,
            HorizontalTextAlignment.RIGHT,
        );
        const overlayWidth = Math.min(620, Math.max(1, this.plotWidth - 28));
        const overlayX = -this.plotWidth / 2 + overlayWidth / 2 + 14;
        const model = createLabel(
            plot,
            '',
            overlayWidth,
            24,
            compact ? 8 : 10,
            palette.muted,
            overlayX,
            -this.plotHeight / 2 + 58,
            HorizontalTextAlignment.LEFT,
        );
        this.modelLabel = model.getComponent(Label);
        const diagnostics = createLabel(
            plot,
            '',
            overlayWidth,
            24,
            compact ? 8 : 10,
            palette.muted,
            overlayX,
            -this.plotHeight / 2 + 32,
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

    private drawScene(state: PlanarThreeBodyViewState, span: number): void {
        const graphics = this.sceneGraphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1;
        const limit = Math.floor(span);
        for (let value = -limit; value <= limit; value += 1) {
            const verticalA = this.project({ x: value, y: -span });
            const verticalB = this.project({ x: value, y: span });
            graphics.moveTo(verticalA.x, verticalA.y);
            graphics.lineTo(verticalB.x, verticalB.y);
            const horizontalA = this.project({ x: -span, y: value });
            const horizontalB = this.project({ x: span, y: value });
            graphics.moveTo(horizontalA.x, horizontalA.y);
            graphics.lineTo(horizontalB.x, horizontalB.y);
        }
        graphics.stroke();

        if (state.showBarycenter) {
            const center = this.project(state.diagnostics.barycenter);
            graphics.strokeColor = palette.text;
            graphics.lineWidth = 1.2;
            graphics.circle(center.x, center.y, 6);
            graphics.moveTo(center.x - 9, center.y);
            graphics.lineTo(center.x + 9, center.y);
            graphics.moveTo(center.x, center.y - 9);
            graphics.lineTo(center.x, center.y + 9);
            graphics.stroke();
        }
    }

    private drawTrails(state: PlanarThreeBodyViewState): void {
        const graphics = this.trailGraphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        state.trails.forEach((trail, bodyIndex) => {
            if (trail.length < 2) {
                return;
            }
            graphics.strokeColor = TRAIL_COLORS[bodyIndex] ?? TRAIL_COLORS[0];
            graphics.lineWidth = 1.7;
            trail.forEach((point, index) => {
                const projected = this.project(point);
                if (index === 0) {
                    graphics.moveTo(projected.x, projected.y);
                } else {
                    graphics.lineTo(projected.x, projected.y);
                }
            });
            graphics.stroke();
        });
    }

    private drawBodies(bodies: readonly PlanarBodyState[]): void {
        const graphics = this.bodyGraphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        bodies.forEach((body, index) => {
            const point = this.project(body);
            graphics.fillColor = BODY_COLORS[index] ?? BODY_COLORS[0];
            graphics.circle(
                point.x,
                point.y,
                Math.max(5, Math.min(12, 6.5 * Math.sqrt(body.mass))),
            );
            graphics.fill();
        });
    }

    private drawVectors(state: PlanarThreeBodyViewState): void {
        const graphics = this.vectorGraphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        if (!state.showVelocityVectors) {
            return;
        }
        state.snapshot.bodies.forEach((body, index) => {
            const start = this.project(body);
            const speed = Math.hypot(body.vx, body.vy);
            if (speed < 1e-8) {
                return;
            }
            const length = Math.min(48, 18 + speed * 18);
            const direction = { x: body.vx / speed, y: body.vy / speed };
            const end = {
                x: start.x + direction.x * length,
                y: start.y + direction.y * length,
            };
            graphics.strokeColor = BODY_COLORS[index] ?? BODY_COLORS[0];
            graphics.lineWidth = 1.4;
            graphics.moveTo(start.x, start.y);
            graphics.lineTo(end.x, end.y);
            graphics.stroke();
            this.drawArrowHead(graphics, start, end);
        });
    }

    private drawArrowHead(
        graphics: Graphics,
        start: PlanarVector,
        end: PlanarVector,
    ): void {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.max(1e-6, Math.hypot(dx, dy));
        const ux = dx / length;
        const uy = dy / length;
        const size = 5;
        graphics.moveTo(end.x, end.y);
        graphics.lineTo(
            end.x - ux * size - uy * size * 0.55,
            end.y - uy * size + ux * size * 0.55,
        );
        graphics.moveTo(end.x, end.y);
        graphics.lineTo(
            end.x - ux * size + uy * size * 0.55,
            end.y - uy * size - ux * size * 0.55,
        );
        graphics.stroke();
    }

    private calculateWorldSpan(state: PlanarThreeBodyViewState): number {
        let span = 1.35;
        for (const body of state.snapshot.bodies) {
            span = Math.max(span, Math.abs(body.x), Math.abs(body.y));
        }
        for (const trail of state.trails) {
            for (const point of trail) {
                span = Math.max(span, Math.abs(point.x), Math.abs(point.y));
            }
        }
        return Math.min(8, span * 1.16);
    }

    private project(point: PlanarVector): PlanarVector {
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
