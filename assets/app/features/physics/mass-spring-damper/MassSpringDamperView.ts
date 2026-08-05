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
import type { MassSpringDamperViewState } from './MassSpringDamperTypes';
import type { MassSpringDamperViewModel } from './MassSpringDamperViewModel';

const TRACE_WINDOW_SECONDS = 8;
const TRACE_COLOR = new Color(
    palette.primary.r,
    palette.primary.g,
    palette.primary.b,
    190,
);

export interface MassSpringDamperViewActions {
    parameterChanged(key: string): void;
    reportError(error: unknown): void;
}

export class MassSpringDamperView {
    private parameterPanel: ParameterPanel | null = null;
    private parameterPanelLayout: ParameterPanelLayout | null = null;
    private referenceGraphics: Graphics | null = null;
    private oscillatorGraphics: Graphics | null = null;
    private traceGraphics: Graphics | null = null;
    private diagnosticsLabel: Label | null = null;
    private modelLabel: Label | null = null;
    private plotWidth = 1;
    private plotHeight = 1;

    constructor(
        private readonly root: Node,
        private readonly parameterSchema: ParameterSchema,
        private readonly viewModel: MassSpringDamperViewModel,
        private readonly actions: MassSpringDamperViewActions,
    ) {}

    layout(viewport: ViewportSnapshot): void {
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.parameterPanelLayout = null;
        this.referenceGraphics = null;
        this.oscillatorGraphics = null;
        this.traceGraphics = null;
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
        const plotTop = viewport.height / 2 - viewport.safeInsets.top - (compact ? 70 : 78);
        const plotBottom = panelY + panelHeight / 2 + 12;

        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(1, plotTop - plotBottom);
        const plotY = (plotTop + plotBottom) / 2;
        const plot = createUiNode(
            this.root,
            'MassSpringDamperPlot',
            this.plotWidth,
            this.plotHeight,
            centerX,
            plotY,
        );
        const plotRadius = Math.min(8, this.plotWidth / 2, this.plotHeight / 2);
        fillNode(plot, this.plotWidth, this.plotHeight, palette.surface, plotRadius);
        strokeNode(plot, this.plotWidth, this.plotHeight, palette.border, plotRadius, 1);

        this.referenceGraphics = this.createGraphicsLayer(plot, 'MassSpringReference');
        this.oscillatorGraphics = this.createGraphicsLayer(plot, 'MassSpringOscillator');
        this.traceGraphics = this.createGraphicsLayer(plot, 'MassSpringTrace');
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

    render(state: MassSpringDamperViewState): void {
        const oscillator = this.oscillatorGraphics;
        const trace = this.traceGraphics;
        if (!oscillator || !trace) {
            return;
        }

        const diagramCenterY = this.plotHeight * 0.17;
        const anchorX = -this.plotWidth * 0.38;
        const equilibriumX = this.plotWidth * 0.08;
        const travel = Math.max(20, this.plotWidth * 0.25);
        const normalized = Math.max(
            -1,
            Math.min(1, state.snapshot.displacement / state.displayRange),
        );
        const massX = equilibriumX + normalized * travel;
        const massWidth = Math.max(42, Math.min(76, this.plotWidth * 0.09));
        const massHeight = Math.max(38, Math.min(62, this.plotHeight * 0.15));
        const springEndX = massX - massWidth / 2;

        oscillator.clear();
        oscillator.strokeColor = palette.text;
        oscillator.lineWidth = 2;
        oscillator.moveTo(anchorX, diagramCenterY);
        const springLength = Math.max(18, springEndX - anchorX);
        const coilCount = 10;
        for (let index = 1; index <= coilCount; index += 1) {
            const ratio = index / coilCount;
            const x = anchorX + springLength * ratio;
            const y = diagramCenterY + (index === coilCount ? 0 : (index % 2 === 0 ? -10 : 10));
            oscillator.lineTo(x, y);
        }
        oscillator.stroke();

        oscillator.fillColor = palette.accent;
        oscillator.roundRect(
            massX - massWidth / 2,
            diagramCenterY - massHeight / 2,
            massWidth,
            massHeight,
            6,
        );
        oscillator.fill();

        if (Math.abs(state.snapshot.appliedForce) > 0.01) {
            const direction = Math.sign(state.snapshot.appliedForce);
            const arrowStart = massX;
            const arrowEnd = massX + direction * Math.min(
                72,
                18 + Math.abs(state.snapshot.appliedForce) * 3,
            );
            const arrowY = diagramCenterY + massHeight * 0.75;
            oscillator.strokeColor = palette.warning;
            oscillator.lineWidth = 2;
            oscillator.moveTo(arrowStart, arrowY);
            oscillator.lineTo(arrowEnd, arrowY);
            oscillator.lineTo(arrowEnd - direction * 8, arrowY + 5);
            oscillator.moveTo(arrowEnd, arrowY);
            oscillator.lineTo(arrowEnd - direction * 8, arrowY - 5);
            oscillator.stroke();
        }

        trace.clear();
        if (state.showTrace && state.trail.length > 1) {
            const chartLeft = -this.plotWidth / 2 + 24;
            const chartRight = this.plotWidth / 2 - 24;
            const chartBottom = -this.plotHeight / 2 + 48;
            const chartTop = Math.min(
                diagramCenterY - massHeight,
                chartBottom + Math.max(54, this.plotHeight * 0.25),
            );
            const latestTime = state.trail[state.trail.length - 1].x;
            const startTime = Math.max(0, latestTime - TRACE_WINDOW_SECONDS);

            trace.strokeColor = TRACE_COLOR;
            trace.lineWidth = 1.5;
            let started = false;
            for (const point of state.trail) {
                if (point.x < startTime) {
                    continue;
                }
                const x = chartLeft + (
                    (point.x - startTime) / TRACE_WINDOW_SECONDS
                ) * (chartRight - chartLeft);
                const normalizedY = Math.max(
                    -1,
                    Math.min(1, point.y / state.displayRange),
                );
                const y = (chartBottom + chartTop) / 2
                    + normalizedY * (chartTop - chartBottom) * 0.45;
                if (!started) {
                    trace.moveTo(x, y);
                    started = true;
                } else {
                    trace.lineTo(x, y);
                }
            }
            if (started) {
                trace.stroke();
            }
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
                '1D · LINEAR SPRING · VISCOUS DAMPING · FIXED SUPPORT · RK4 1/240 s',
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

        if (this.plotHeight >= 90 && this.plotWidth >= 140) {
            const modelNode = createLabel(
                plot,
                '',
                Math.max(1, this.plotWidth - 32),
                24,
                compact ? 10 : 11,
                palette.muted,
                0,
                this.plotHeight / 2 - 46,
                HorizontalTextAlignment.LEFT,
            );
            this.modelLabel = modelNode.getComponent(Label);
            if (this.modelLabel) {
                this.modelLabel.enableWrapText = false;
            }
        }

        if (this.plotHeight >= 70 && this.plotWidth >= 120) {
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
    }

    private drawReference(): void {
        const graphics = this.referenceGraphics;
        if (!graphics) {
            return;
        }

        const diagramCenterY = this.plotHeight * 0.17;
        const anchorX = -this.plotWidth * 0.38;
        const equilibriumX = this.plotWidth * 0.08;

        graphics.clear();
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1;
        graphics.moveTo(equilibriumX, diagramCenterY - 42);
        graphics.lineTo(equilibriumX, diagramCenterY + 42);
        graphics.moveTo(-this.plotWidth / 2 + 24, -this.plotHeight * 0.16);
        graphics.lineTo(this.plotWidth / 2 - 24, -this.plotHeight * 0.16);
        graphics.stroke();

        graphics.strokeColor = palette.text;
        graphics.lineWidth = 3;
        graphics.moveTo(anchorX, diagramCenterY - 34);
        graphics.lineTo(anchorX, diagramCenterY + 34);
        graphics.stroke();
    }
}
