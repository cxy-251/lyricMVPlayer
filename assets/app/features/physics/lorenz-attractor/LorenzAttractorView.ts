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
import type { ViewportSnapshot } from '../../../services/ViewportService';
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

export interface LorenzAttractorViewActions {
    parameterChanged(key: string): void;
    reportError(error: unknown): void;
}

export class LorenzAttractorView {
    private parameterPanel: ParameterPanel | null = null;
    private parameterPanelLayout: ParameterPanelLayout | null = null;
    private referenceGraphics: Graphics | null = null;
    private trailGraphics: Graphics | null = null;
    private markerGraphics: Graphics | null = null;
    private diagnosticsLabel: Label | null = null;
    private modelLabel: Label | null = null;
    private plotWidth = 1;
    private plotHeight = 1;
    private informationHeight = 112;
    private visualizationHeight = 1;
    private visualizationCenterY = 0;

    constructor(
        private readonly root: Node,
        private readonly parameterSchema: ParameterSchema,
        private readonly viewModel: LorenzAttractorViewModel,
        private readonly actions: LorenzAttractorViewActions,
    ) {}

    layout(viewport: ViewportSnapshot): void {
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
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
        const horizontalPadding = compact ? 16 : 36;
        const safeWidth = Math.max(
            1,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const contentWidth = Math.max(
            1,
            Math.min(1180, safeWidth - horizontalPadding * 2),
        );
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const panelHeight = ParameterPanel.measureHeight(
            this.parameterSchema.length,
            contentWidth,
            viewport.breakpoint,
        );
        const panelY = -viewport.height / 2
            + viewport.safeInsets.bottom
            + 12
            + panelHeight / 2;
        const plotTop = viewport.height / 2
            - viewport.safeInsets.top
            - (compact ? 70 : 78);
        const plotBottom = panelY + panelHeight / 2 + 12;
        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(1, plotTop - plotBottom);
        this.informationHeight = Math.min(
            compact ? 118 : 132,
            Math.max(88, this.plotHeight * 0.4),
        );
        const visualizationTop = this.plotHeight / 2 - this.informationHeight - 18;
        const visualizationBottom = -this.plotHeight / 2 + 42;
        this.visualizationHeight = Math.max(1, visualizationTop - visualizationBottom);
        this.visualizationCenterY = (visualizationTop + visualizationBottom) / 2;

        const plot = createUiNode(
            this.root,
            'LorenzAttractorPlot',
            this.plotWidth,
            this.plotHeight,
            centerX,
            (plotTop + plotBottom) / 2,
        );
        const radius = Math.min(8, this.plotWidth / 2, this.plotHeight / 2);
        fillNode(plot, this.plotWidth, this.plotHeight, palette.surface, radius);
        strokeNode(plot, this.plotWidth, this.plotHeight, palette.border, radius, 1);

        this.referenceGraphics = this.createGraphicsLayer(plot, 'LorenzReference');
        this.trailGraphics = this.createGraphicsLayer(plot, 'LorenzTrails');
        this.markerGraphics = this.createGraphicsLayer(plot, 'LorenzMarkers');
        this.createInformationViews(plot, compact);
        this.drawReference();

        this.parameterPanelLayout = {
            width: contentWidth,
            x: centerX,
            y: panelY,
            breakpoint: viewport.breakpoint,
        };
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
        this.parameterPanelLayout = null;
        clearNode(this.root);
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
        const scale = Math.min(
            Math.max(1, (this.plotWidth - 48) / 52),
            Math.max(1, this.visualizationHeight / 58),
        );
        return {
            x: rotatedX * scale,
            y: this.visualizationCenterY
                + (point.z - 24) * scale
                + depth * scale * 0.16,
        };
    }

    private rebuildParameterPanel(): void {
        const layout = this.parameterPanelLayout;
        if (!layout) {
            return;
        }

        this.parameterPanel?.destroy();
        this.parameterPanel = new ParameterPanel(
            this.root,
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

    private createInformationViews(plot: Node, compact: boolean): void {
        const titleY = this.plotHeight / 2 - 18;
        const titleNode = createLabel(
            plot,
            'LORENZ EQUATIONS · DIMENSIONLESS STATE SPACE · RK4 Δt = ¹⁄₂₄₀',
            Math.max(1, this.plotWidth - 32),
            24,
            compact ? 9 : 10,
            palette.subtle,
            0,
            titleY,
            HorizontalTextAlignment.LEFT,
        );
        const titleLabel = titleNode.getComponent(Label);
        if (titleLabel) {
            titleLabel.enableWrapText = false;
        }

        const cardWidth = Math.max(1, this.plotWidth - 32);
        const cardHeight = Math.max(58, this.informationHeight - 34);
        const cardY = this.plotHeight / 2 - 30 - cardHeight / 2;
        const card = createUiNode(
            plot,
            'LorenzEquationCard',
            cardWidth,
            cardHeight,
            0,
            cardY,
        );
        fillNode(card, cardWidth, cardHeight, palette.surfaceSoft, 7);
        strokeNode(card, cardWidth, cardHeight, palette.border, 7, 1);

        const equationWidth = Math.max(112, cardWidth * (compact ? 0.4 : 0.34));
        const explanationWidth = Math.max(1, cardWidth - equationWidth - 28);
        const equationX = -cardWidth / 2 + equationWidth / 2 + 12;
        const explanationX = cardWidth / 2 - explanationWidth / 2 - 12;

        const equationNode = createLabel(
            card,
            'ẋ = σ(y − x)\nẏ = x(ρ − z) − y\nż = xy − βz',
            equationWidth,
            Math.max(1, cardHeight - 12),
            compact ? 12 : 14,
            palette.primaryText,
            equationX,
            0,
            HorizontalTextAlignment.LEFT,
        );
        const equationLabel = equationNode.getComponent(Label);
        if (equationLabel) {
            equationLabel.lineHeight = compact ? 20 : 23;
        }

        const explanationNode = createLabel(
            card,
            [
                'STATES  x circulation · y horizontal temperature contrast · z vertical temperature distortion',
                'PARAMETERS  σ response rate · ρ thermal driving · β geometric dissipation',
                'CLASSIC DEFAULT  σ = 10 · ρ = 28 · β = ⁸⁄₃ ≈ 2.667',
            ].join('\n'),
            explanationWidth,
            Math.max(1, cardHeight - 12),
            compact ? 8 : 10,
            palette.muted,
            explanationX,
            0,
            HorizontalTextAlignment.LEFT,
        );
        const explanationLabel = explanationNode.getComponent(Label);
        if (explanationLabel) {
            explanationLabel.lineHeight = compact ? 15 : 18;
        }

        const modelNode = createLabel(
            plot,
            '',
            Math.max(1, this.plotWidth - 32),
            24,
            compact ? 9 : 11,
            palette.muted,
            0,
            this.plotHeight / 2 - this.informationHeight - 7,
            HorizontalTextAlignment.LEFT,
        );
        this.modelLabel = modelNode.getComponent(Label);
        if (this.modelLabel) {
            this.modelLabel.enableWrapText = false;
        }

        const diagnosticsNode = createLabel(
            plot,
            '',
            Math.max(1, this.plotWidth - 32),
            28,
            compact ? 9 : 11,
            palette.muted,
            0,
            -this.plotHeight / 2 + 22,
            HorizontalTextAlignment.LEFT,
        );
        this.diagnosticsLabel = diagnosticsNode.getComponent(Label);
        if (this.diagnosticsLabel) {
            this.diagnosticsLabel.enableWrapText = false;
        }
    }

    private drawReference(): void {
        const graphics = this.referenceGraphics;
        if (!graphics) {
            return;
        }

        const visualizationTop = this.visualizationCenterY + this.visualizationHeight / 2;
        const visualizationBottom = this.visualizationCenterY - this.visualizationHeight / 2;

        graphics.clear();
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1;
        graphics.moveTo(-this.plotWidth / 2 + 24, this.visualizationCenterY);
        graphics.lineTo(this.plotWidth / 2 - 24, this.visualizationCenterY);
        graphics.moveTo(0, visualizationBottom);
        graphics.lineTo(0, visualizationTop);
        graphics.stroke();
    }
}
