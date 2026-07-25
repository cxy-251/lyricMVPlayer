import {
    Color,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Node,
} from 'cc';
import type { ParameterController } from '../../../parameters/ParameterController';
import {
    ParameterPanel,
    type ParameterPanelLayout,
} from '../../../parameters/ParameterPanel';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import {
    clearNode,
    createIconButton,
    createLabel,
    createUiNode,
    fillNode,
    palette,
    strokeNode,
} from '../../../ui/UiFactory';
import type {
    LissajousRenderRequest,
    LissajousViewState,
} from './LissajousTypes';

interface CurveGraphicsLayer {
    readonly echo: number;
    readonly graphics: Graphics;
}

export interface LissajousViewActions {
    parameterChanged(key: string): void;
    cyclePreset(direction: -1 | 1): void;
    reportError(error: unknown): void;
}

const MAXIMUM_ECHO_LAYERS = 4;

export class LissajousView {
    private parameterPanel: ParameterPanel | null = null;
    private parameterPanelLayout: ParameterPanelLayout | null = null;
    private curveLayers: CurveGraphicsLayer[] = [];
    private markerGraphics: Graphics | null = null;
    private formulaLabel: Label | null = null;
    private diagnosticsLabel: Label | null = null;
    private presetLabel: Label | null = null;
    private plotWidth = 1;
    private plotHeight = 1;
    private curveCenterY = 0;
    private curveScaleX = 1;
    private curveScaleY = 1;
    private renderRequest: LissajousRenderRequest = {
        sampleCount: 320,
        maximumEchoLayers: MAXIMUM_ECHO_LAYERS,
    };

    constructor(
        private readonly root: Node,
        private readonly parameterSchema: ParameterSchema,
        private readonly parameterBinding: ParameterController,
        private readonly actions: LissajousViewActions,
    ) {}

    get requestedRendering(): LissajousRenderRequest {
        return this.renderRequest;
    }

    layout(viewport: ViewportSnapshot): void {
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.parameterPanelLayout = null;
        this.curveLayers = [];
        this.markerGraphics = null;
        this.formulaLabel = null;
        this.diagnosticsLabel = null;
        this.presetLabel = null;
        clearNode(this.root);
        this.root.setPosition(0, 0, 0);
        fillNode(this.root, viewport.width, viewport.height, palette.background);

        const compact = viewport.breakpoint === 'compact';
        const horizontalPadding = compact ? 18 : 44;
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
        const plotCenterY = (plotTop + plotBottom) / 2;
        const maximumEchoLayers = contentWidth < 280
            ? 2
            : compact ? 3 : MAXIMUM_ECHO_LAYERS;
        const sampleLimit = compact
            ? 300
            : viewport.breakpoint === 'medium' ? 460 : 620;
        this.renderRequest = {
            sampleCount: Math.max(64, Math.min(sampleLimit, Math.round(contentWidth * 0.9))),
            maximumEchoLayers,
        };

        const plot = createUiNode(
            this.root,
            'LissajousPlot',
            this.plotWidth,
            this.plotHeight,
            centerX,
            plotCenterY,
        );
        const plotRadius = Math.min(18, this.plotWidth / 2, this.plotHeight / 2);
        fillNode(plot, this.plotWidth, this.plotHeight, palette.surfaceSoft, plotRadius);
        strokeNode(plot, this.plotWidth, this.plotHeight, palette.border, plotRadius, 1);
        this.drawGrid(plot);
        this.createCurveLayers(plot, maximumEchoLayers);
        this.createInformationViews(plot, compact);

        this.parameterPanelLayout = {
            width: contentWidth,
            x: centerX,
            y: panelY,
            breakpoint: viewport.breakpoint,
        };
        this.rebuildParameterPanel();
    }

    render(state: LissajousViewState): void {
        if (this.formulaLabel) {
            this.formulaLabel.string = state.formula;
        }

        if (this.diagnosticsLabel) {
            this.diagnosticsLabel.string = state.diagnostics;
        }

        if (this.presetLabel) {
            this.presetLabel.string = state.presetLabel;
        }

        const maximumEcho = Math.max(1, this.renderRequest.maximumEchoLayers - 1);
        for (const layer of this.curveLayers) {
            const curve = state.curves.find((candidate) => candidate.echo === layer.echo);
            const graphics = layer.graphics;
            graphics.clear();

            if (!curve) {
                continue;
            }

            const alpha = Math.round(46 + (maximumEcho - layer.echo) * (164 / maximumEcho));
            graphics.strokeColor = layer.echo === 0
                ? new Color(palette.accent.r, palette.accent.g, palette.accent.b, 230)
                : new Color(palette.primary.r, palette.primary.g, palette.primary.b, alpha);
            graphics.lineWidth = layer.echo === 0 ? 2.4 : 1.2;

            curve.points.forEach((point, index) => {
                const x = point.x * this.curveScaleX;
                const y = point.y * this.curveScaleY + this.curveCenterY;
                if (index === 0) {
                    graphics.moveTo(x, y);
                } else {
                    graphics.lineTo(x, y);
                }
            });
            graphics.stroke();
        }

        const markerGraphics = this.markerGraphics;
        if (!markerGraphics) {
            return;
        }

        markerGraphics.clear();
        if (!state.marker) {
            return;
        }

        markerGraphics.fillColor = palette.warning;
        markerGraphics.circle(
            state.marker.x * this.curveScaleX,
            state.marker.y * this.curveScaleY + this.curveCenterY,
            5,
        );
        markerGraphics.fill();
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
            this.parameterBinding,
            (key) => this.actions.parameterChanged(key),
            (error) => this.actions.reportError(error),
        );
        this.parameterPanel.render(layout);
    }

    private createInformationViews(plot: Node, compact: boolean): void {
        const canShowFormula = this.plotHeight >= 90 && this.plotWidth >= 180;
        const canShowPreset = this.plotHeight >= 140 && this.plotWidth >= 260;
        const wideHeader = this.plotWidth >= 620;
        const formulaY = this.plotHeight / 2 - 22;
        const presetY = wideHeader
            ? formulaY
            : this.plotHeight / 2 - 62;
        const topInset = canShowPreset && !wideHeader ? 88 : 48;
        const bottomInset = 42;
        const curveTop = this.plotHeight / 2 - topInset;
        const curveBottom = -this.plotHeight / 2 + bottomInset;

        this.curveCenterY = (curveTop + curveBottom) / 2;
        this.curveScaleX = this.plotWidth * 0.42;
        this.curveScaleY = Math.max(1, (curveTop - curveBottom) * 0.44);

        if (canShowFormula) {
            const formulaWidth = wideHeader
                ? Math.max(1, this.plotWidth * 0.56 - 24)
                : Math.max(1, this.plotWidth - 40);
            const formulaNode = createLabel(
                plot,
                '',
                formulaWidth,
                30,
                compact ? 11 : 13,
                palette.muted,
                -this.plotWidth / 2 + formulaWidth / 2 + 20,
                formulaY,
                HorizontalTextAlignment.LEFT,
            );
            this.formulaLabel = formulaNode.getComponent(Label);
            if (this.formulaLabel) {
                this.formulaLabel.enableWrapText = false;
            }
        }

        if (canShowPreset) {
            this.createPresetSelector(plot, wideHeader, presetY);
        }

        if (this.plotHeight >= 80 && this.plotWidth >= 220) {
            const diagnosticsNode = createLabel(
                plot,
                '',
                Math.max(1, this.plotWidth - 40),
                30,
                compact ? 10 : 12,
                palette.muted,
                0,
                -this.plotHeight / 2 + 20,
                HorizontalTextAlignment.LEFT,
            );
            this.diagnosticsLabel = diagnosticsNode.getComponent(Label);
            if (this.diagnosticsLabel) {
                this.diagnosticsLabel.enableWrapText = false;
            }
        }
    }

    private createPresetSelector(plot: Node, wideHeader: boolean, y: number): void {
        const width = Math.max(180, Math.min(280, this.plotWidth * (wideHeader ? 0.36 : 0.72)));
        const x = wideHeader
            ? this.plotWidth / 2 - width / 2 - 16
            : 0;
        const selector = createUiNode(plot, 'LissajousPresetSelector', width, 44, x, y);

        createIconButton(selector, {
            name: 'PreviousLissajousPreset',
            icon: 'chevron-left',
            x: -width / 2 + 22,
            onPress: () => this.actions.cyclePreset(-1),
        });
        const labelNode = createLabel(
            selector,
            '',
            Math.max(80, width - 96),
            36,
            12,
            palette.text,
        );
        this.presetLabel = labelNode.getComponent(Label);
        if (this.presetLabel) {
            this.presetLabel.enableWrapText = false;
        }
        createIconButton(selector, {
            name: 'NextLissajousPreset',
            icon: 'chevron-right',
            x: width / 2 - 22,
            onPress: () => this.actions.cyclePreset(1),
        });
    }

    private drawGrid(plot: Node): void {
        const gridNode = createUiNode(plot, 'LissajousGrid', this.plotWidth, this.plotHeight);
        const grid = gridNode.addComponent(Graphics);
        grid.lineWidth = 1;
        grid.strokeColor = new Color(palette.border.r, palette.border.g, palette.border.b, 54);

        for (let index = 1; index < 10; index += 1) {
            const x = -this.plotWidth / 2 + (this.plotWidth * index) / 10;
            grid.moveTo(x, -this.plotHeight / 2);
            grid.lineTo(x, this.plotHeight / 2);
        }

        for (let index = 1; index < 8; index += 1) {
            const y = -this.plotHeight / 2 + (this.plotHeight * index) / 8;
            grid.moveTo(-this.plotWidth / 2, y);
            grid.lineTo(this.plotWidth / 2, y);
        }
        grid.stroke();

        const axesNode = createUiNode(plot, 'LissajousAxes', this.plotWidth, this.plotHeight);
        const axes = axesNode.addComponent(Graphics);
        axes.lineWidth = 1.25;
        axes.strokeColor = new Color(
            palette.borderStrong.r,
            palette.borderStrong.g,
            palette.borderStrong.b,
            92,
        );
        axes.moveTo(-this.plotWidth / 2, 0);
        axes.lineTo(this.plotWidth / 2, 0);
        axes.moveTo(0, -this.plotHeight / 2);
        axes.lineTo(0, this.plotHeight / 2);
        axes.stroke();
    }

    private createCurveLayers(plot: Node, maximumEchoLayers: number): void {
        for (let echo = maximumEchoLayers - 1; echo >= 0; echo -= 1) {
            const node = createUiNode(
                plot,
                `LissajousCurve:${echo}`,
                this.plotWidth,
                this.plotHeight,
            );
            this.curveLayers.push({
                echo,
                graphics: node.addComponent(Graphics),
            });
        }

        const markerNode = createUiNode(
            plot,
            'LissajousMarker',
            this.plotWidth,
            this.plotHeight,
        );
        this.markerGraphics = markerNode.addComponent(Graphics);
    }
}
