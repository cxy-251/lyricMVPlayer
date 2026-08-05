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
    LorenzAttractorViewState,
    LorenzState,
} from './LorenzAttractorTypes';
import type { LorenzAttractorViewModel } from './LorenzAttractorViewModel';

const PRIMARY_COLOR = new Color(
    palette.primary.r,
    palette.primary.g,
    palette.primary.b,
    220,
);
const SHADOW_COLOR = new Color(
    palette.warning.r,
    palette.warning.g,
    palette.warning.b,
    150,
);
const CONTENT_GAP = 14;
const EDGE_PADDING_WIDE = 36;
const EDGE_PADDING_COMPACT = 16;

export interface LorenzAttractorViewActions {
    parameterChanged(key: string): void;
    reportError(error: unknown): void;
}

export class LorenzAttractorView {
    private parameterPanel: ParameterPanel | null = null;
    private parameterPanelParent: Node | null = null;
    private parameterPanelLayout: ParameterPanelLayout | null = null;
    private referenceGraphics: Graphics | null = null;
    private trailGraphics: Graphics | null = null;
    private markerGraphics: Graphics | null = null;
    private diagnosticsLabel: Label | null = null;
    private modelLabel: Label | null = null;
    private plotWidth = 1;
    private plotHeight = 1;

    constructor(
        private readonly root: Node,
        private readonly parameterSchema: ParameterSchema,
        private readonly viewModel: LorenzAttractorViewModel,
        private readonly actions: LorenzAttractorViewActions,
    ) {}

    layout(viewport: ViewportSnapshot): void {
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.parameterPanelParent = null;
        this.parameterPanelLayout = null;
        this.referenceGraphics = null;
        this.trailGraphics = null;
        this.markerGraphics = null;
        this.diagnosticsLabel = null;
        this.modelLabel = null;
        clearNode(this.root);
        this.root.setPosition(0, 0, 0);
        fillNode(this.root, viewport.width, viewport.height, palette.background);

        const compact = viewport.breakpoint === 'compact';
        const horizontalPadding = compact
            ? EDGE_PADDING_COMPACT
            : EDGE_PADDING_WIDE;
        const safeWidth = Math.max(
            1,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const contentWidth = Math.max(
            1,
            Math.min(1280, safeWidth - horizontalPadding * 2),
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
            && safeWidth >= 900
            && contentHeight >= 420;

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

    render(state: LorenzAttractorViewState): void {
        const trails = this.trailGraphics;
        const markers = this.markerGraphics;
        if (!trails || !markers) {
            return;
        }

        trails.clear();
        this.drawTrail(
            trails,
            state.primaryTrail,
            state.viewAngle,
            PRIMARY_COLOR,
            1.7,
        );
        if (state.showShadow) {
            this.drawTrail(
                trails,
                state.shadowTrail,
                state.viewAngle,
                SHADOW_COLOR,
                1,
            );
        }

        markers.clear();
        const primary = this.project(state.snapshot.primary, state.viewAngle);
        markers.fillColor = palette.accent;
        markers.circle(primary.x, primary.y, 5);
        markers.fill();

        if (state.showShadow) {
            const shadow = this.project(state.snapshot.shadow, state.viewAngle);
            markers.fillColor = palette.warning;
            markers.circle(shadow.x, shadow.y, 3.5);
            markers.fill();
        }

        if (this.diagnosticsLabel) {
            this.diagnosticsLabel.string = state.diagnostics;
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
            360,
            Math.max(300, contentWidth * 0.27),
        );
        this.plotWidth = Math.max(1, contentWidth - inspectorWidth - CONTENT_GAP);
        this.plotHeight = contentHeight;

        const leftEdge = centerX - contentWidth / 2;
        const plotX = leftEdge + this.plotWidth / 2;
        const inspectorX = leftEdge
            + this.plotWidth
            + CONTENT_GAP
            + inspectorWidth / 2;
        const plot = this.createVisualizationPanel(
            plotX,
            centerY,
            breakpoint === 'compact',
        );
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

        this.referenceGraphics = this.createGraphicsLayer(plot, 'LorenzReference');
        this.trailGraphics = this.createGraphicsLayer(plot, 'LorenzTrails');
        this.markerGraphics = this.createGraphicsLayer(plot, 'LorenzMarkers');
        this.drawReference();
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
        const parameterWidth = contentWidth;
        const parameterHeight = ParameterPanel.measureHeight(
            this.parameterSchema.length,
            parameterWidth,
            parameterBreakpoint,
        );
        const inspectorEquationHeight = contentWidth >= 620 ? 106 : 122;
        const inspectorHeight = inspectorEquationHeight
            + CONTENT_GAP
            + parameterHeight;

        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(
            170,
            contentHeight - inspectorHeight - CONTENT_GAP,
        );
        const plotY = contentTop - this.plotHeight / 2;
        const inspectorY = contentBottom + inspectorHeight / 2;
        const plot = this.createVisualizationPanel(
            centerX,
            plotY,
            breakpoint === 'compact',
        );
        const inspector = this.createInspectorPanel(
            contentWidth,
            inspectorHeight,
            centerX,
            inspectorY,
            true,
            inspectorEquationHeight,
        );

        this.parameterPanelParent = inspector;
        this.parameterPanelLayout = {
            width: parameterWidth,
            x: 0,
            y: -inspectorHeight / 2 + parameterHeight / 2,
            breakpoint: parameterBreakpoint,
        };

        this.referenceGraphics = this.createGraphicsLayer(plot, 'LorenzReference');
        this.trailGraphics = this.createGraphicsLayer(plot, 'LorenzTrails');
        this.markerGraphics = this.createGraphicsLayer(plot, 'LorenzMarkers');
        this.drawReference();
    }

    private createVisualizationPanel(
        x: number,
        y: number,
        compact: boolean,
    ): Node {
        const plot = createUiNode(
            this.root,
            'LorenzAttractorPlot',
            this.plotWidth,
            this.plotHeight,
            x,
            y,
        );
        const radius = Math.min(10, this.plotWidth / 2, this.plotHeight / 2);
        fillNode(plot, this.plotWidth, this.plotHeight, palette.surface, radius);
        strokeNode(plot, this.plotWidth, this.plotHeight, palette.border, radius, 1);
        this.createVisualizationOverlays(plot, compact);
        return plot;
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
            'LorenzInspector',
            width,
            height,
            x,
            y,
        );
        const equationHeight = requestedEquationHeight
            ?? Math.min(250, Math.max(190, height * 0.4));
        const equationY = height / 2 - equationHeight / 2;
        const equationCard = createUiNode(
            inspector,
            'LorenzEquationCard',
            width,
            equationHeight,
            0,
            equationY,
        );
        fillNode(equationCard, width, equationHeight, palette.surfaceSoft, 9);
        strokeNode(equationCard, width, equationHeight, palette.border, 9, 1);

        createLabel(
            equationCard,
            'LORENZ 1963 · DIMENSIONLESS CONVECTION MODEL',
            Math.max(1, width - 24),
            22,
            horizontal ? 9 : 10,
            palette.subtle,
            0,
            equationHeight / 2 - 17,
            HorizontalTextAlignment.LEFT,
        );

        if (horizontal && width >= 620) {
            this.createHorizontalEquationContent(equationCard, width, equationHeight);
        } else {
            this.createVerticalEquationContent(equationCard, width, equationHeight);
        }
        return inspector;
    }

    private createHorizontalEquationContent(
        card: Node,
        width: number,
        height: number,
    ): void {
        const equationWidth = Math.max(190, width * 0.34);
        const explanationWidth = Math.max(1, width - equationWidth - 36);
        const equationNode = createLabel(
            card,
            'ẋ = σ(y − x)\nẏ = x(ρ − z) − y\nż = xy − βz',
            equationWidth,
            Math.max(1, height - 32),
            13,
            palette.primaryText,
            -width / 2 + equationWidth / 2 + 12,
            -8,
            HorizontalTextAlignment.LEFT,
        );
        const equationLabel = equationNode.getComponent(Label);
        if (equationLabel) {
            equationLabel.lineHeight = 20;
        }

        const explanationNode = createLabel(
            card,
            [
                'x circulation · y horizontal temperature contrast · z vertical temperature distortion',
                'σ response rate · ρ thermal driving · β geometric dissipation',
                'classic: σ = 10 · ρ = 28 · β = ⁸⁄₃ ≈ 2.667',
            ].join('\n'),
            explanationWidth,
            Math.max(1, height - 32),
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
        const formulaHeight = Math.min(94, Math.max(68, height * 0.42));
        const equationNode = createLabel(
            card,
            'ẋ = σ(y − x)\nẏ = x(ρ − z) − y\nż = xy − βz',
            Math.max(1, width - 24),
            formulaHeight,
            13,
            palette.primaryText,
            0,
            height / 2 - 28 - formulaHeight / 2,
            HorizontalTextAlignment.LEFT,
        );
        const equationLabel = equationNode.getComponent(Label);
        if (equationLabel) {
            equationLabel.lineHeight = 20;
        }

        const explanationHeight = Math.max(1, height - formulaHeight - 36);
        const explanationNode = createLabel(
            card,
            [
                'x circulation · y horizontal ΔT · z vertical ΔT distortion',
                'σ response · ρ heating · β geometric loss',
                'classic: 10 · 28 · ⁸⁄₃',
            ].join('\n'),
            Math.max(1, width - 24),
            explanationHeight,
            9,
            palette.muted,
            0,
            -height / 2 + explanationHeight / 2 + 8,
            HorizontalTextAlignment.LEFT,
        );
        const explanationLabel = explanationNode.getComponent(Label);
        if (explanationLabel) {
            explanationLabel.lineHeight = 15;
        }
    }

    private createVisualizationOverlays(plot: Node, compact: boolean): void {
        const headingWidth = Math.max(1, this.plotWidth - 32);
        const headingNode = createLabel(
            plot,
            'STATE SPACE · PRIMARY AND NEARBY INITIAL CONDITION',
            headingWidth,
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

        const legendWidth = compact ? 126 : 174;
        const legendNode = createLabel(
            plot,
            '● primary   ● nearby',
            legendWidth,
            22,
            compact ? 8 : 9,
            palette.muted,
            this.plotWidth / 2 - legendWidth / 2 - 14,
            this.plotHeight / 2 - 18,
            HorizontalTextAlignment.RIGHT,
        );
        const legendLabel = legendNode.getComponent(Label);
        if (legendLabel) {
            legendLabel.enableWrapText = false;
        }

        const statusWidth = Math.min(
            compact ? 286 : 390,
            Math.max(1, this.plotWidth - 28),
        );
        const statusHeight = compact ? 54 : 60;
        const statusCard = createUiNode(
            plot,
            'LorenzStatusOverlay',
            statusWidth,
            statusHeight,
            -this.plotWidth / 2 + statusWidth / 2 + 14,
            -this.plotHeight / 2 + statusHeight / 2 + 14,
        );
        fillNode(statusCard, statusWidth, statusHeight, palette.backgroundRaised, 7);
        strokeNode(statusCard, statusWidth, statusHeight, palette.border, 7, 1);

        const modelNode = createLabel(
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
        this.modelLabel = modelNode.getComponent(Label);
        if (this.modelLabel) {
            this.modelLabel.enableWrapText = false;
        }

        const diagnosticsNode = createLabel(
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
        this.diagnosticsLabel = diagnosticsNode.getComponent(Label);
        if (this.diagnosticsLabel) {
            this.diagnosticsLabel.enableWrapText = false;
        }
    }

    private drawTrail(
        graphics: Graphics,
        points: readonly LorenzState[],
        angle: number,
        color: Color,
        width: number,
    ): void {
        if (points.length < 2) {
            return;
        }

        graphics.strokeColor = color;
        graphics.lineWidth = width;
        points.forEach((point, index) => {
            const projected = this.project(point, angle);
            if (index === 0) {
                graphics.moveTo(projected.x, projected.y);
            } else {
                graphics.lineTo(projected.x, projected.y);
            }
        });
        graphics.stroke();
    }

    private project(point: LorenzState, angle: number): { x: number; y: number } {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotatedX = point.x * cos - point.y * sin;
        const depth = point.x * sin + point.y * cos;
        const scale = Math.max(
            0.1,
            Math.min(
                Math.max(1, (this.plotWidth - 54) / 52),
                Math.max(1, (this.plotHeight - 76) / 58),
            ),
        );
        return {
            x: rotatedX * scale,
            y: (point.z - 24) * scale + depth * scale * 0.16,
        };
    }

    private rebuildParameterPanel(): void {
        const layout = this.parameterPanelLayout;
        const parent = this.parameterPanelParent;
        if (!layout || !parent) {
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

    private drawReference(): void {
        const graphics = this.referenceGraphics;
        if (!graphics) {
            return;
        }

        graphics.clear();
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1;
        graphics.moveTo(-this.plotWidth / 2 + 24, 0);
        graphics.lineTo(this.plotWidth / 2 - 24, 0);
        graphics.moveTo(0, -this.plotHeight / 2 + 34);
        graphics.lineTo(0, this.plotHeight / 2 - 34);
        graphics.stroke();
    }
}
