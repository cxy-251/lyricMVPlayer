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
import type { DoublePendulumViewState } from './DoublePendulumTypes';
import type { DoublePendulumViewModel } from './DoublePendulumViewModel';

const TRAIL_COLOR = new Color(
    palette.primary.r,
    palette.primary.g,
    palette.primary.b,
    156,
);

export interface DoublePendulumViewActions {
    parameterChanged(key: string): void;
    reportError(error: unknown): void;
}

export class DoublePendulumView {
    private parameterPanel: ParameterPanel | null = null;
    private parameterPanelLayout: ParameterPanelLayout | null = null;
    private referenceGraphics: Graphics | null = null;
    private trailGraphics: Graphics | null = null;
    private rodGraphics: Graphics | null = null;
    private pivotGraphics: Graphics | null = null;
    private upperMassGraphics: Graphics | null = null;
    private lowerMassGraphics: Graphics | null = null;
    private diagnosticsLabel: Label | null = null;
    private plotWidth = 1;
    private plotHeight = 1;
    private pivotX = 0;
    private pivotY = 0;

    constructor(
        private readonly root: Node,
        private readonly parameterSchema: ParameterSchema,
        private readonly viewModel: DoublePendulumViewModel,
        private readonly actions: DoublePendulumViewActions,
    ) {}

    layout(viewport: ViewportSnapshot): void {
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.parameterPanelLayout = null;
        this.referenceGraphics = null;
        this.trailGraphics = null;
        this.rodGraphics = null;
        this.pivotGraphics = null;
        this.upperMassGraphics = null;
        this.lowerMassGraphics = null;
        this.diagnosticsLabel = null;
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
        const plotTop = viewport.height / 2 - viewport.safeInsets.top - (compact ? 70 : 78);
        const plotBottom = panelY + panelHeight / 2 + 12;

        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(1, plotTop - plotBottom);
        const plotY = (plotTop + plotBottom) / 2;
        const plot = createUiNode(
            this.root,
            'DoublePendulumPlot',
            this.plotWidth,
            this.plotHeight,
            centerX,
            plotY,
        );
        const plotRadius = Math.min(8, this.plotWidth / 2, this.plotHeight / 2);
        fillNode(plot, this.plotWidth, this.plotHeight, palette.surface, plotRadius);
        strokeNode(plot, this.plotWidth, this.plotHeight, palette.border, plotRadius, 1);

        this.pivotX = 0;
        this.pivotY = this.plotHeight * 0.29;
        this.referenceGraphics = this.createGraphicsLayer(plot, 'DoublePendulumReference');
        this.trailGraphics = this.createGraphicsLayer(plot, 'DoublePendulumTrajectory');
        this.rodGraphics = this.createGraphicsLayer(plot, 'DoublePendulumRods');
        this.pivotGraphics = this.createGraphicsLayer(plot, 'DoublePendulumPivot');
        this.upperMassGraphics = this.createGraphicsLayer(plot, 'DoublePendulumUpperMass');
        this.lowerMassGraphics = this.createGraphicsLayer(plot, 'DoublePendulumLowerMass');
        this.drawReference();
        this.createInformationViews(plot, compact);

        this.parameterPanelLayout = {
            width: contentWidth,
            x: centerX,
            y: panelY,
            breakpoint: viewport.breakpoint,
        };
        this.rebuildParameterPanel();
    }

    render(state: DoublePendulumViewState): void {
        const trailGraphics = this.trailGraphics;
        const rodGraphics = this.rodGraphics;
        const pivotGraphics = this.pivotGraphics;
        const upperMassGraphics = this.upperMassGraphics;
        const lowerMassGraphics = this.lowerMassGraphics;

        if (
            !trailGraphics
            || !rodGraphics
            || !pivotGraphics
            || !upperMassGraphics
            || !lowerMassGraphics
        ) {
            return;
        }

        const totalLength = Math.max(0.001, state.length1 + state.length2);
        const scale = Math.min(
            this.plotWidth * 0.34 / totalLength,
            this.plotHeight * 0.72 / totalLength,
        );
        const x1 = this.pivotX + state.positions.first.x * scale;
        const y1 = this.pivotY + state.positions.first.y * scale;
        const x2 = this.pivotX + state.positions.second.x * scale;
        const y2 = this.pivotY + state.positions.second.y * scale;

        trailGraphics.clear();
        if (state.showTrail) {
            trailGraphics.strokeColor = TRAIL_COLOR;
            trailGraphics.lineWidth = 1.5;
            state.trail.forEach((point, index) => {
                const x = this.pivotX + point.x * scale;
                const y = this.pivotY + point.y * scale;
                if (index === 0) {
                    trailGraphics.moveTo(x, y);
                } else {
                    trailGraphics.lineTo(x, y);
                }
            });
            if (state.trail.length > 1) {
                trailGraphics.stroke();
            }
        }

        rodGraphics.clear();
        rodGraphics.strokeColor = palette.text;
        rodGraphics.lineWidth = 3;
        rodGraphics.moveTo(this.pivotX, this.pivotY);
        rodGraphics.lineTo(x1, y1);
        rodGraphics.lineTo(x2, y2);
        rodGraphics.stroke();

        pivotGraphics.clear();
        pivotGraphics.fillColor = palette.text;
        pivotGraphics.circle(this.pivotX, this.pivotY, 5);
        pivotGraphics.fill();

        upperMassGraphics.clear();
        upperMassGraphics.fillColor = palette.accent;
        upperMassGraphics.circle(x1, y1, 8 + Math.sqrt(state.mass1) * 4);
        upperMassGraphics.fill();

        lowerMassGraphics.clear();
        lowerMassGraphics.fillColor = palette.warning;
        lowerMassGraphics.circle(x2, y2, 8 + Math.sqrt(state.mass2) * 4);
        lowerMassGraphics.fill();

        if (this.diagnosticsLabel) {
            this.diagnosticsLabel.string = state.diagnostics;
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
        if (this.plotHeight >= 100 && this.plotWidth >= 160) {
            const methodNode = createLabel(
                plot,
                'RK4 · FIXED STEP 1/240 s · POINT MASSES · MASSLESS RIGID RODS',
                Math.max(1, this.plotWidth - 32),
                24,
                compact ? 9 : 10,
                palette.subtle,
                0,
                this.plotHeight / 2 - 20,
                HorizontalTextAlignment.LEFT,
            );
            const methodLabel = methodNode.getComponent(Label);
            if (methodLabel) {
                methodLabel.enableWrapText = false;
            }
        }

        if (this.plotHeight >= 70 && this.plotWidth >= 120) {
            const diagnosticsNode = createLabel(
                plot,
                '',
                Math.max(1, this.plotWidth - 32),
                28,
                compact ? 10 : 12,
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
    }

    private drawReference(): void {
        const graphics = this.referenceGraphics;
        if (!graphics) {
            return;
        }

        graphics.clear();
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1;
        graphics.moveTo(this.pivotX, this.pivotY + 18);
        graphics.lineTo(this.pivotX, -this.plotHeight / 2 + 46);
        graphics.stroke();
    }
}
