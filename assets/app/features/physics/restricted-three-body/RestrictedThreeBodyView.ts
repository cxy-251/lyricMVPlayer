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
    CR3BPLagrangePoint,
    CR3BPVector,
    RestrictedThreeBodyViewState,
} from './RestrictedThreeBodyTypes';
import type { RestrictedThreeBodyViewModel } from './RestrictedThreeBodyViewModel';

const TRAIL_COLOR = new Color(
    palette.primary.r,
    palette.primary.g,
    palette.primary.b,
    225,
);
const PRIMARY_BODY_COLOR = new Color(215, 221, 207, 255);
const SECONDARY_BODY_COLOR = new Color(181, 149, 95, 255);
const THIRD_BODY_COLOR = new Color(126, 190, 166, 255);
const FORCE_PRIMARY_COLOR = new Color(150, 168, 159, 210);
const FORCE_SECONDARY_COLOR = new Color(181, 149, 95, 220);
const LAGRANGE_COLOR = new Color(130, 142, 135, 180);
const CONTENT_GAP = 14;

export interface RestrictedThreeBodyViewActions {
    parameterChanged(key: string): void;
    reportError(error: unknown): void;
}

export class RestrictedThreeBodyView {
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
        private readonly viewModel: RestrictedThreeBodyViewModel,
        private readonly actions: RestrictedThreeBodyViewActions,
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
        const horizontalPadding = compact ? 16 : 36;
        const safeWidth = Math.max(
            1,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const contentWidth = Math.max(
            1,
            Math.min(1320, safeWidth - horizontalPadding * 2),
        );
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const contentTop = viewport.height / 2
            - viewport.safeInsets.top
            - (compact ? 70 : 78);
        const contentBottom = -viewport.height / 2
            + viewport.safeInsets.bottom
            + 12;
        const contentHeight = Math.max(1, contentTop - contentBottom);
        const contentCenterY = (contentTop + contentBottom) / 2;
        const sideInspector = viewport.orientation === 'landscape'
            && safeWidth >= 920
            && contentHeight >= 440;

        if (sideInspector) {
            this.layoutSideBySide(
                centerX,
                contentCenterY,
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

    render(state: RestrictedThreeBodyViewState): void {
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
            Math.max(1, (this.plotHeight - 66) / (span * 2)),
        );

        this.drawScene(state, span);
        this.drawTrail(state);
        this.drawBodies(state);
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
        const inspectorWidth = Math.min(
            370,
            Math.max(310, contentWidth * 0.27),
        );
        this.plotWidth = Math.max(1, contentWidth - inspectorWidth - CONTENT_GAP);
        this.plotHeight = contentHeight;
        const leftEdge = centerX - contentWidth / 2;
        const plotX = leftEdge + this.plotWidth / 2;
        const inspectorX = leftEdge
            + this.plotWidth
            + CONTENT_GAP
            + inspectorWidth / 2;

        const plot = this.createVisualizationPanel(plotX, centerY);
        const inspector = this.createInspectorPanel(
            inspectorWidth,
            contentHeight,
            inspectorX,
            centerY,
            false,
        );
        const panelBreakpoint: ViewportBreakpoint = 'compact';
        const parameterWidth = Math.max(1, inspectorWidth - 16);
        const parameterHeight = ParameterPanel.measureHeight(
            this.parameterSchema.length,
            parameterWidth,
            panelBreakpoint,
        );
        this.parameterPanelParent = inspector;
        this.parameterPanelLayout = {
            width: parameterWidth,
            x: 0,
            y: -contentHeight / 2 + 8 + parameterHeight / 2,
            breakpoint: panelBreakpoint,
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
        const parameterBreakpoint: ViewportBreakpoint = breakpoint === 'wide'
            ? 'medium'
            : breakpoint;
        const parameterHeight = ParameterPanel.measureHeight(
            this.parameterSchema.length,
            contentWidth,
            parameterBreakpoint,
        );
        const equationHeight = contentWidth >= 620 ? 116 : 142;
        const inspectorHeight = equationHeight + CONTENT_GAP + parameterHeight;
        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(
            180,
            contentHeight - inspectorHeight - CONTENT_GAP,
        );
        const plotY = contentTop - this.plotHeight / 2;
        const inspectorY = contentBottom + inspectorHeight / 2;
        const plot = this.createVisualizationPanel(centerX, plotY);
        const inspector = this.createInspectorPanel(
            contentWidth,
            inspectorHeight,
            centerX,
            inspectorY,
            true,
            equationHeight,
        );
        this.parameterPanelParent = inspector;
        this.parameterPanelLayout = {
            width: contentWidth,
            x: 0,
            y: -inspectorHeight / 2 + parameterHeight / 2,
            breakpoint: parameterBreakpoint,
        };
        this.createGraphicsLayers(plot);
        this.createVisualizationOverlays(plot, breakpoint === 'compact');
    }

    private createVisualizationPanel(x: number, y: number): Node {
        const plot = createUiNode(
            this.root,
            'RestrictedThreeBodyPlot',
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
        this.sceneGraphics = this.createGraphicsLayer(plot, 'CR3BPScene');
        this.trailGraphics = this.createGraphicsLayer(plot, 'CR3BPTrail');
        this.bodyGraphics = this.createGraphicsLayer(plot, 'CR3BPBodies');
        this.vectorGraphics = this.createGraphicsLayer(plot, 'CR3BPVectors');
    }

    private createInspectorPanel(
        width: number,
        height: number,
        x: number,
        y: number,
        horizontal: boolean,
        requestedEquationHeight?: number,
    ): Node {
        const inspector = createUiNode(
            this.root,
            'RestrictedThreeBodyInspector',
            width,
            height,
            x,
            y,
        );
        const equationHeight = requestedEquationHeight
            ?? Math.min(270, Math.max(210, height * 0.43));
        const equationCard = createUiNode(
            inspector,
            'CR3BPEquationCard',
            width,
            equationHeight,
            0,
            height / 2 - equationHeight / 2,
        );
        fillNode(equationCard, width, equationHeight, palette.surfaceSoft, 9);
        strokeNode(equationCard, width, equationHeight, palette.border, 9, 1);
        createLabel(
            equationCard,
            'CIRCULAR RESTRICTED THREE-BODY MODEL',
            Math.max(1, width - 24),
            22,
            horizontal ? 9 : 10,
            palette.subtle,
            0,
            equationHeight / 2 - 17,
            HorizontalTextAlignment.LEFT,
        );

        if (horizontal && width >= 650) {
            this.createHorizontalEquationContent(
                equationCard,
                width,
                equationHeight,
            );
        } else {
            this.createVerticalEquationContent(
                equationCard,
                width,
                equationHeight,
            );
        }
        return inspector;
    }

    private createHorizontalEquationContent(
        card: Node,
        width: number,
        height: number,
    ): void {
        const equationWidth = Math.max(230, width * 0.42);
        const explanationWidth = Math.max(1, width - equationWidth - 36);
        const equationNode = createLabel(
            card,
            'ẍ − 2ẏ = ∂Ω/∂x\nÿ + 2ẋ = ∂Ω/∂y\nC = 2Ω − (ẋ² + ẏ²)',
            equationWidth,
            Math.max(1, height - 34),
            13,
            palette.primaryText,
            -width / 2 + equationWidth / 2 + 12,
            -8,
            HorizontalTextAlignment.LEFT,
        );
        const equationLabel = equationNode.getComponent(Label);
        if (equationLabel) {
            equationLabel.lineHeight = 21;
        }
        const explanationNode = createLabel(
            card,
            [
                'two primaries follow a prescribed circular orbit',
                'third-body mass is neglected · rotating frame',
                'distance = 1 · angular speed = 1 · G(m₁+m₂) = 1',
                'RK4 Δt = ¹⁄₇₂₀ · collision radius 0.025 · escape radius 4',
            ].join('\n'),
            explanationWidth,
            Math.max(1, height - 34),
            9,
            palette.muted,
            width / 2 - explanationWidth / 2 - 12,
            -8,
            HorizontalTextAlignment.LEFT,
        );
        const explanationLabel = explanationNode.getComponent(Label);
        if (explanationLabel) {
            explanationLabel.lineHeight = 16;
        }
    }

    private createVerticalEquationContent(
        card: Node,
        width: number,
        height: number,
    ): void {
        const equationNode = createLabel(
            card,
            'ẍ − 2ẏ = ∂Ω/∂x\nÿ + 2ẋ = ∂Ω/∂y\nC = 2Ω − (ẋ² + ẏ²)',
            Math.max(1, width - 24),
            76,
            13,
            palette.primaryText,
            0,
            height / 2 - 72,
            HorizontalTextAlignment.LEFT,
        );
        const equationLabel = equationNode.getComponent(Label);
        if (equationLabel) {
            equationLabel.lineHeight = 21;
        }
        const explanationNode = createLabel(
            card,
            [
                'rotating frame · normalized distance and time',
                'm₃ ≈ 0 · RK4 Δt = ¹⁄₇₂₀',
                'C is the Jacobi integral; ΔC measures numerical drift',
            ].join('\n'),
            Math.max(1, width - 24),
            Math.max(1, height - 106),
            9,
            palette.muted,
            0,
            -height / 2 + Math.max(1, height - 106) / 2 + 8,
            HorizontalTextAlignment.LEFT,
        );
        const explanationLabel = explanationNode.getComponent(Label);
        if (explanationLabel) {
            explanationLabel.lineHeight = 15;
        }
    }

    private createVisualizationOverlays(plot: Node, compact: boolean): void {
        const headingNode = createLabel(
            plot,
            'ROTATING FRAME · TWO PRIMARIES + MASSLESS THIRD BODY',
            Math.max(1, this.plotWidth - 32),
            22,
            compact ? 8 : 9,
            palette.subtle,
            0,
            this.plotHeight / 2 - 18,
            HorizontalTextAlignment.LEFT,
        );
        const headingLabel = headingNode.getComponent(Label);
        if (headingLabel) {
            headingLabel.enableWrapText = false;
        }

        const modelNode = createLabel(
            plot,
            '',
            Math.min(460, Math.max(1, this.plotWidth - 28)),
            24,
            compact ? 8 : 10,
            palette.muted,
            -this.plotWidth / 2
                + Math.min(460, Math.max(1, this.plotWidth - 28)) / 2
                + 14,
            -this.plotHeight / 2 + 58,
            HorizontalTextAlignment.LEFT,
        );
        this.modelLabel = modelNode.getComponent(Label);
        if (this.modelLabel) {
            this.modelLabel.enableWrapText = false;
        }

        const diagnosticsNode = createLabel(
            plot,
            '',
            Math.min(460, Math.max(1, this.plotWidth - 28)),
            24,
            compact ? 8 : 10,
            palette.muted,
            -this.plotWidth / 2
                + Math.min(460, Math.max(1, this.plotWidth - 28)) / 2
                + 14,
            -this.plotHeight / 2 + 32,
            HorizontalTextAlignment.LEFT,
        );
        this.diagnosticsLabel = diagnosticsNode.getComponent(Label);
        if (this.diagnosticsLabel) {
            this.diagnosticsLabel.enableWrapText = false;
        }
    }

    private drawScene(
        state: RestrictedThreeBodyViewState,
        span: number,
    ): void {
        const graphics = this.sceneGraphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1;

        const integerLimit = Math.floor(span);
        for (let value = -integerLimit; value <= integerLimit; value += 1) {
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

        const primary = this.project(state.primary);
        const secondary = this.project(state.secondary);
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 1.2;
        graphics.moveTo(primary.x, primary.y);
        graphics.lineTo(secondary.x, secondary.y);
        graphics.stroke();

        if (state.showLagrangePoints) {
            this.drawLagrangePoints(graphics, state.lagrangePoints);
        }
    }

    private drawLagrangePoints(
        graphics: Graphics,
        points: readonly CR3BPLagrangePoint[],
    ): void {
        graphics.strokeColor = LAGRANGE_COLOR;
        graphics.lineWidth = 1;
        for (const point of points) {
            const projected = this.project(point);
            const radius = 4;
            graphics.moveTo(projected.x - radius, projected.y);
            graphics.lineTo(projected.x + radius, projected.y);
            graphics.moveTo(projected.x, projected.y - radius);
            graphics.lineTo(projected.x, projected.y + radius);
        }
        graphics.stroke();
    }

    private drawTrail(state: RestrictedThreeBodyViewState): void {
        const graphics = this.trailGraphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        if (state.trail.length < 2) {
            return;
        }
        graphics.strokeColor = TRAIL_COLOR;
        graphics.lineWidth = 1.7;
        state.trail.forEach((point, index) => {
            const projected = this.project(point);
            if (index === 0) {
                graphics.moveTo(projected.x, projected.y);
            } else {
                graphics.lineTo(projected.x, projected.y);
            }
        });
        graphics.stroke();
    }

    private drawBodies(state: RestrictedThreeBodyViewState): void {
        const graphics = this.bodyGraphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        const primary = this.project(state.primary);
        const secondary = this.project(state.secondary);
        const third = this.project(state.snapshot.state);

        graphics.fillColor = PRIMARY_BODY_COLOR;
        graphics.circle(primary.x, primary.y, 15);
        graphics.fill();
        graphics.fillColor = SECONDARY_BODY_COLOR;
        graphics.circle(secondary.x, secondary.y, 8);
        graphics.fill();
        graphics.fillColor = THIRD_BODY_COLOR;
        graphics.circle(third.x, third.y, 5.5);
        graphics.fill();

        graphics.strokeColor = new Color(
            THIRD_BODY_COLOR.r,
            THIRD_BODY_COLOR.g,
            THIRD_BODY_COLOR.b,
            110,
        );
        graphics.lineWidth = 1;
        graphics.circle(third.x, third.y, 10);
        graphics.stroke();
    }

    private drawVectors(state: RestrictedThreeBodyViewState): void {
        const graphics = this.vectorGraphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        if (!state.showGravityVectors) {
            return;
        }
        const origin = this.project(state.snapshot.state);
        this.drawArrow(
            graphics,
            origin,
            state.gravityVectors.primary,
            FORCE_PRIMARY_COLOR,
        );
        this.drawArrow(
            graphics,
            origin,
            state.gravityVectors.secondary,
            FORCE_SECONDARY_COLOR,
        );
    }

    private drawArrow(
        graphics: Graphics,
        origin: CR3BPVector,
        vector: CR3BPVector,
        color: Color,
    ): void {
        const magnitude = Math.hypot(vector.x, vector.y);
        if (!Number.isFinite(magnitude) || magnitude < 1e-9) {
            return;
        }
        const length = Math.min(72, 18 + Math.log10(1 + magnitude) * 18);
        const ux = vector.x / magnitude;
        const uy = vector.y / magnitude;
        const end = {
            x: origin.x + ux * length,
            y: origin.y + uy * length,
        };
        const sideX = -uy;
        const sideY = ux;
        graphics.strokeColor = color;
        graphics.lineWidth = 1.4;
        graphics.moveTo(origin.x, origin.y);
        graphics.lineTo(end.x, end.y);
        graphics.moveTo(end.x, end.y);
        graphics.lineTo(
            end.x - ux * 8 + sideX * 4,
            end.y - uy * 8 + sideY * 4,
        );
        graphics.moveTo(end.x, end.y);
        graphics.lineTo(
            end.x - ux * 8 - sideX * 4,
            end.y - uy * 8 - sideY * 4,
        );
        graphics.stroke();
    }

    private calculateWorldSpan(state: RestrictedThreeBodyViewState): number {
        let maximumRadius = 1.08;
        for (const point of state.trail) {
            maximumRadius = Math.max(
                maximumRadius,
                Math.abs(point.x),
                Math.abs(point.y),
            );
        }
        maximumRadius = Math.max(
            maximumRadius,
            Math.abs(state.snapshot.state.x),
            Math.abs(state.snapshot.state.y),
        );
        return Math.min(4.2, Math.max(1.18, maximumRadius * 1.14));
    }

    private project(point: CR3BPVector): CR3BPVector {
        return {
            x: point.x * this.worldScale,
            y: point.y * this.worldScale,
        };
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

    private createGraphicsLayer(parent: Node, name: string): Graphics {
        return createUiNode(
            parent,
            name,
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
    }
}
