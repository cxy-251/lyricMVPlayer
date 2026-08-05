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
    RollingBodyRaceViewState,
    RollingBodyState,
} from './RollingBodyRaceTypes';
import type { RollingBodyRaceViewModel } from './RollingBodyRaceViewModel';

const BODY_COLORS = [
    new Color(126, 190, 166, 255),
    new Color(210, 167, 96, 255),
    new Color(151, 165, 211, 255),
    new Color(188, 137, 151, 255),
] as const;
const ENERGY_TRANSLATION = new Color(126, 190, 166, 210);
const ENERGY_ROTATION = new Color(181, 149, 95, 210);
const CONTENT_GAP = 14;

export interface RollingBodyRaceViewActions {
    parameterChanged(key: string): void;
    reportError(error: unknown): void;
}

export class RollingBodyRaceView {
    private parameterPanel: ParameterPanel | null = null;
    private parameterPanelParent: Node | null = null;
    private parameterPanelLayout: ParameterPanelLayout | null = null;
    private sceneGraphics: Graphics | null = null;
    private bodyGraphics: Graphics | null = null;
    private laneLabels: Node[] = [];
    private resultLabels: Node[] = [];
    private diagnosticsLabel: Label | null = null;
    private modelLabel: Label | null = null;
    private plotWidth = 1;
    private plotHeight = 1;

    constructor(
        private readonly root: Node,
        private readonly parameterSchema: ParameterSchema,
        private readonly viewModel: RollingBodyRaceViewModel,
        private readonly actions: RollingBodyRaceViewActions,
    ) {}

    layout(viewport: ViewportSnapshot): void {
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.parameterPanelParent = null;
        this.parameterPanelLayout = null;
        this.sceneGraphics = null;
        this.bodyGraphics = null;
        this.laneLabels = [];
        this.resultLabels = [];
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
        const contentCenterY = (contentTop + contentBottom) / 2;
        const sideInspector = viewport.orientation === 'landscape'
            && safeWidth >= 940
            && contentHeight >= 500;

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

    render(state: RollingBodyRaceViewState): void {
        if (!this.sceneGraphics || !this.bodyGraphics) {
            return;
        }
        this.drawRace(state);
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
        );
        const panelWidth = inspectorWidth - 16;
        const panelHeight = ParameterPanel.measureHeight(
            this.parameterSchema.length,
            panelWidth,
            'compact',
        );
        this.parameterPanelParent = inspector;
        this.parameterPanelLayout = {
            width: panelWidth,
            x: 0,
            y: -contentHeight / 2 + 8 + panelHeight / 2,
            breakpoint: 'compact',
        };
        this.createPlotLayers(plot, breakpoint === 'compact');
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
        const equationHeight = contentWidth >= 620 ? 118 : 152;
        const inspectorHeight = equationHeight + CONTENT_GAP + panelHeight;
        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(200, contentHeight - inspectorHeight - CONTENT_GAP);
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
        this.createPlotLayers(plot, breakpoint === 'compact');
    }

    private createVisualizationPanel(x: number, y: number): Node {
        const plot = createUiNode(
            this.root,
            'RollingBodyRacePlot',
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

    private createPlotLayers(plot: Node, compact: boolean): void {
        this.sceneGraphics = createUiNode(
            plot,
            'RollingRaceScene',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
        this.bodyGraphics = createUiNode(
            plot,
            'RollingRaceBodies',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);

        for (let index = 0; index < 4; index += 1) {
            this.laneLabels.push(createLabel(
                plot,
                '',
                172,
                24,
                compact ? 8 : 10,
                palette.muted,
                0,
                0,
                HorizontalTextAlignment.LEFT,
            ));
            this.resultLabels.push(createLabel(
                plot,
                '',
                150,
                24,
                compact ? 8 : 10,
                palette.muted,
                0,
                0,
                HorizontalTextAlignment.RIGHT,
            ));
        }

        createLabel(
            plot,
            'IDEAL ROLLING WITHOUT SLIP · SAME MASS AND RADIUS',
            Math.max(1, this.plotWidth - 32),
            22,
            compact ? 8 : 9,
            palette.subtle,
            0,
            this.plotHeight / 2 - 18,
            HorizontalTextAlignment.LEFT,
        );
        const overlayWidth = Math.min(620, Math.max(1, this.plotWidth - 28));
        const overlayX = -this.plotWidth / 2 + overlayWidth / 2 + 14;
        const modelNode = createLabel(
            plot,
            '',
            overlayWidth,
            24,
            compact ? 8 : 10,
            palette.muted,
            overlayX,
            -this.plotHeight / 2 + 56,
            HorizontalTextAlignment.LEFT,
        );
        this.modelLabel = modelNode.getComponent(Label);
        const diagnosticsNode = createLabel(
            plot,
            '',
            overlayWidth,
            24,
            compact ? 8 : 10,
            palette.muted,
            overlayX,
            -this.plotHeight / 2 + 30,
            HorizontalTextAlignment.LEFT,
        );
        this.diagnosticsLabel = diagnosticsNode.getComponent(Label);
        if (this.modelLabel) {
            this.modelLabel.enableWrapText = false;
        }
        if (this.diagnosticsLabel) {
            this.diagnosticsLabel.enableWrapText = false;
        }
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
            'RollingBodyRaceInspector',
            width,
            height,
            x,
            y,
        );
        const equationHeight = requestedHeight
            ?? Math.min(252, Math.max(198, height * 0.4));
        const card = createUiNode(
            inspector,
            'RollingBodyRaceEquationCard',
            width,
            equationHeight,
            0,
            height / 2 - equationHeight / 2,
        );
        fillNode(card, width, equationHeight, palette.surfaceSoft, 9);
        strokeNode(card, width, equationHeight, palette.border, 9, 1);
        createLabel(
            card,
            'ROLLING RIGID BODIES · IDEAL NO-SLIP MODEL',
            Math.max(1, width - 24),
            22,
            horizontal ? 9 : 10,
            palette.subtle,
            0,
            equationHeight / 2 - 17,
            HorizontalTextAlignment.LEFT,
        );

        const formula = [
            'I = kmr²',
            'a = g sinθ / (1 + k)',
            'mgh = ½mv² + ½Iω²',
            'ω = v/r',
        ].join('\n');
        const explanation = [
            'solid sphere k=²⁄₅ · solid cylinder k=¹⁄₂',
            'hollow sphere k=²⁄₃ · ring k=1',
            'smaller k leaves more energy in translation',
            'mass cancels; radius changes spin rate only',
        ].join('\n');

        if (horizontal && width >= 650) {
            this.createMultilineLabel(
                card,
                formula,
                width * 0.38,
                equationHeight - 34,
                12,
                palette.primaryText,
                -width * 0.28,
                -8,
                19,
            );
            this.createMultilineLabel(
                card,
                explanation,
                width * 0.56,
                equationHeight - 34,
                9,
                palette.muted,
                width * 0.2,
                -8,
                16,
            );
        } else {
            this.createMultilineLabel(
                card,
                formula,
                Math.max(1, width - 24),
                84,
                11,
                palette.primaryText,
                0,
                equationHeight / 2 - 70,
                18,
            );
            this.createMultilineLabel(
                card,
                explanation,
                Math.max(1, width - 24),
                Math.max(1, equationHeight - 104),
                9,
                palette.muted,
                0,
                -equationHeight / 2 + Math.max(1, equationHeight - 104) / 2 + 7,
                15,
            );
        }
        return inspector;
    }

    private drawRace(state: RollingBodyRaceViewState): void {
        const scene = this.sceneGraphics;
        const bodies = this.bodyGraphics;
        if (!scene || !bodies) {
            return;
        }
        scene.clear();
        bodies.clear();

        const angle = state.parameters.slopeAngleRadians;
        const direction = { x: Math.cos(angle), y: -Math.sin(angle) };
        const normal = { x: Math.sin(angle), y: Math.cos(angle) };
        const laneGap = Math.max(28, Math.min(46, this.plotHeight * 0.105));
        const verticalReserve = 116 + laneGap * 3;
        const maximumByHeight = Math.max(
            150,
            (this.plotHeight - verticalReserve) / Math.max(0.12, Math.sin(angle)),
        );
        const rampPixels = Math.max(
            160,
            Math.min(this.plotWidth * 0.62, maximumByHeight),
        );
        const radiusPixels = Math.max(
            8,
            Math.min(18, 8 + state.parameters.radius * 28),
        );
        const centerY = 8;
        const ranking = [...state.snapshot.bodies]
            .sort((left, right) => (
                right.progress - left.progress
                || left.finishTime - right.finishTime
            ));

        state.snapshot.bodies.forEach((body, index) => {
            const laneOffset = (1.5 - index) * laneGap;
            const laneCenter = {
                x: normal.x * laneOffset,
                y: centerY + normal.y * laneOffset,
            };
            const start = {
                x: laneCenter.x - direction.x * rampPixels / 2,
                y: laneCenter.y - direction.y * rampPixels / 2,
            };
            const end = {
                x: laneCenter.x + direction.x * rampPixels / 2,
                y: laneCenter.y + direction.y * rampPixels / 2,
            };
            const travelPixels = Math.max(1, rampPixels - radiusPixels * 2);
            const center = {
                x: start.x
                    + direction.x * (radiusPixels + body.progress * travelPixels)
                    + normal.x * radiusPixels,
                y: start.y
                    + direction.y * (radiusPixels + body.progress * travelPixels)
                    + normal.y * radiusPixels,
            };

            scene.strokeColor = palette.borderStrong;
            scene.lineWidth = 2;
            scene.moveTo(start.x, start.y);
            scene.lineTo(end.x, end.y);
            scene.stroke();
            this.drawFinishLine(scene, end, normal, radiusPixels + 6);

            if (state.showEnergy) {
                this.drawEnergyBar(
                    scene,
                    start.x - 78,
                    start.y - 11,
                    body,
                );
            }

            this.drawBody(bodies, body, index, center, radiusPixels);

            const laneLabel = this.laneLabels[index];
            laneLabel.setPosition(start.x - 88, start.y + 15, 0);
            const laneLabelComponent = laneLabel.getComponent(Label);
            if (laneLabelComponent) {
                laneLabelComponent.string = `${body.label} · k=${this.formatFactor(body.inertiaFactor)}`;
            }

            const rank = ranking.findIndex((candidate) => candidate.id === body.id) + 1;
            const resultLabel = this.resultLabels[index];
            resultLabel.setPosition(end.x + 78, end.y + 14, 0);
            const resultLabelComponent = resultLabel.getComponent(Label);
            if (resultLabelComponent) {
                resultLabelComponent.string = state.showGuides
                    ? `${body.finished ? 'FINISH' : `#${rank}`} · ${body.finishTime.toFixed(2)} s`
                    : '';
            }
        });
    }

    private drawBody(
        graphics: Graphics,
        body: RollingBodyState,
        index: number,
        center: { readonly x: number; readonly y: number },
        radius: number,
    ): void {
        const color = BODY_COLORS[index] ?? BODY_COLORS[0];
        graphics.fillColor = index === 3 ? palette.surface : color;
        graphics.strokeColor = color;
        graphics.lineWidth = index === 3 ? 4 : 2;
        graphics.circle(center.x, center.y, radius);
        graphics.fill();
        graphics.stroke();

        if (index === 1) {
            graphics.lineWidth = 1.5;
            graphics.circle(center.x, center.y, radius * 0.68);
            graphics.stroke();
        } else if (index === 2) {
            graphics.lineWidth = 2.5;
            graphics.circle(center.x, center.y, radius * 0.76);
            graphics.stroke();
        }

        const spokeAngle = -body.angularPosition;
        const spokeX = Math.cos(spokeAngle) * radius * 0.82;
        const spokeY = Math.sin(spokeAngle) * radius * 0.82;
        graphics.strokeColor = index === 3 ? color : palette.surface;
        graphics.lineWidth = 2;
        graphics.moveTo(center.x, center.y);
        graphics.lineTo(center.x + spokeX, center.y + spokeY);
        graphics.stroke();
    }

    private drawFinishLine(
        graphics: Graphics,
        end: { readonly x: number; readonly y: number },
        normal: { readonly x: number; readonly y: number },
        halfLength: number,
    ): void {
        graphics.strokeColor = palette.text;
        graphics.lineWidth = 1.5;
        graphics.moveTo(
            end.x - normal.x * halfLength,
            end.y - normal.y * halfLength,
        );
        graphics.lineTo(
            end.x + normal.x * halfLength,
            end.y + normal.y * halfLength,
        );
        graphics.stroke();
    }

    private drawEnergyBar(
        graphics: Graphics,
        x: number,
        y: number,
        body: RollingBodyState,
    ): void {
        const width = 58;
        const height = 6;
        const translationWidth = width * body.translationalEnergyFraction;
        graphics.fillColor = ENERGY_TRANSLATION;
        graphics.rect(x, y, translationWidth, height);
        graphics.fill();
        graphics.fillColor = ENERGY_ROTATION;
        graphics.rect(x + translationWidth, y, width - translationWidth, height);
        graphics.fill();
    }

    private formatFactor(value: number): string {
        if (Math.abs(value - 2 / 5) < 1e-6) {
            return '²⁄₅';
        }
        if (Math.abs(value - 1 / 2) < 1e-6) {
            return '¹⁄₂';
        }
        if (Math.abs(value - 2 / 3) < 1e-6) {
            return '²⁄₃';
        }
        return '1';
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
