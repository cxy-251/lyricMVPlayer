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
    DrivenCavityFlowViewState,
} from './DrivenCavityFlowTypes';
import type { DrivenCavityFlowViewModel } from './DrivenCavityFlowViewModel';

const CONTENT_GAP = 14;
const SIDE_INFO_HEIGHT = 150;
const CONTOUR_COLORS = [
    new Color(24, 43, 120, 255),
    new Color(27, 78, 171, 255),
    new Color(33, 132, 202, 255),
    new Color(40, 181, 190, 255),
    new Color(72, 199, 126, 255),
    new Color(151, 205, 72, 255),
    new Color(224, 210, 55, 255),
    new Color(242, 156, 43, 255),
    new Color(220, 74, 40, 255),
] as const;
const TRACER_COLOR = new Color(250, 250, 245, 215);
const VECTOR_SHADOW = new Color(20, 24, 31, 185);
const VECTOR_COLOR = new Color(248, 249, 242, 225);

interface ScalarPresentation {
    readonly title: string;
    readonly unit: string;
    readonly minimum: number;
    readonly maximum: number;
}

export interface DrivenCavityFlowViewActions {
    parameterChanged(key: string): void;
    reportError(error: unknown): void;
}

export class DrivenCavityFlowView {
    private parameterPanel: ParameterPanel | null = null;
    private parameterPanelParent: Node | null = null;
    private parameterPanelLayout: ParameterPanelLayout | null = null;
    private fieldGraphics: Graphics | null = null;
    private tracerGraphics: Graphics | null = null;
    private vectorGraphics: Graphics | null = null;
    private boundaryGraphics: Graphics | null = null;
    private legendGraphics: Graphics | null = null;
    private diagnosticsLabel: Label | null = null;
    private modelLabel: Label | null = null;
    private resultTitleLabel: Label | null = null;
    private legendUnitLabel: Label | null = null;
    private legendMaxLabel: Label | null = null;
    private legendMidLabel: Label | null = null;
    private legendMinLabel: Label | null = null;
    private plotWidth = 1;
    private plotHeight = 1;
    private cavitySize = 1;
    private cavityCenterX = 0;
    private cavityCenterY = 0;
    private legendX = 0;
    private legendHeight = 1;

    constructor(
        private readonly root: Node,
        private readonly parameterSchema: ParameterSchema,
        private readonly viewModel: DrivenCavityFlowViewModel,
        private readonly actions: DrivenCavityFlowViewActions,
    ) {}

    layout(viewport: ViewportSnapshot): void {
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.parameterPanelParent = null;
        this.parameterPanelLayout = null;
        this.fieldGraphics = null;
        this.tracerGraphics = null;
        this.vectorGraphics = null;
        this.boundaryGraphics = null;
        this.legendGraphics = null;
        this.diagnosticsLabel = null;
        this.modelLabel = null;
        this.resultTitleLabel = null;
        this.legendUnitLabel = null;
        this.legendMaxLabel = null;
        this.legendMidLabel = null;
        this.legendMinLabel = null;
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
            && safeWidth >= 980
            && contentHeight >= 620;

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

    render(state: DrivenCavityFlowViewState): void {
        if (
            !this.fieldGraphics
            || !this.tracerGraphics
            || !this.vectorGraphics
            || !this.boundaryGraphics
            || !this.legendGraphics
        ) return;

        this.layoutResultGeometry();
        const presentation = this.scalarPresentation(state);
        this.drawField(state, presentation);
        this.drawTracers(state);
        this.drawVectors(state);
        this.drawBoundary(state);
        this.drawLegend(presentation);
        this.updateResultLabels(presentation);
        if (this.diagnosticsLabel) this.diagnosticsLabel.string = state.diagnosticsText;
        if (this.modelLabel) this.modelLabel.string = state.modelSummary;
    }

    refreshParameterPanel(): void {
        this.rebuildParameterPanel();
    }

    destroy(): void {
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
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
        const plot = this.createPlot(leftEdge + this.plotWidth / 2, centerY);
        const inspector = this.createInspector(
            inspectorWidth,
            contentHeight,
            leftEdge + this.plotWidth + CONTENT_GAP + inspectorWidth / 2,
            centerY,
            false,
            SIDE_INFO_HEIGHT,
        );
        const parameterHeight = Math.max(
            1,
            contentHeight - SIDE_INFO_HEIGHT - CONTENT_GAP - 8,
        );
        this.parameterPanelParent = inspector;
        this.parameterPanelLayout = {
            width: inspectorWidth - 16,
            height: parameterHeight,
            x: 0,
            y: -contentHeight / 2 + 8 + parameterHeight / 2,
            breakpoint: 'compact',
        };
        this.createGraphicsLayers(plot);
        this.createOverlays(plot, breakpoint === 'compact');
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
        const infoHeight = contentWidth >= 620 ? 118 : 148;
        const inspectorHeight = infoHeight + CONTENT_GAP + parameterHeight;
        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(210, contentHeight - inspectorHeight - CONTENT_GAP);
        const plot = this.createPlot(
            centerX,
            contentTop - this.plotHeight / 2,
        );
        const inspector = this.createInspector(
            contentWidth,
            inspectorHeight,
            centerX,
            contentBottom + inspectorHeight / 2,
            true,
            infoHeight,
        );
        this.parameterPanelParent = inspector;
        this.parameterPanelLayout = {
            width: contentWidth,
            x: 0,
            y: -inspectorHeight / 2 + parameterHeight / 2,
            breakpoint: panelBreakpoint,
        };
        this.createGraphicsLayers(plot);
        this.createOverlays(plot, breakpoint === 'compact');
    }

    private createPlot(x: number, y: number): Node {
        const plot = createUiNode(
            this.root,
            'DrivenCavityFlowPlot',
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
        this.fieldGraphics = this.createGraphics(plot, 'CavityContour');
        this.tracerGraphics = this.createGraphics(plot, 'CavityParticles');
        this.vectorGraphics = this.createGraphics(plot, 'CavityVectors');
        this.boundaryGraphics = this.createGraphics(plot, 'CavityBoundary');
        this.legendGraphics = this.createGraphics(plot, 'CavityLegend');
    }

    private createInspector(
        width: number,
        height: number,
        x: number,
        y: number,
        horizontal: boolean,
        infoHeight: number,
    ): Node {
        const inspector = createUiNode(
            this.root,
            'DrivenCavityFlowInspector',
            width,
            height,
            x,
            y,
        );
        const card = createUiNode(
            inspector,
            'DrivenCavityFlowInfoCard',
            width,
            infoHeight,
            0,
            height / 2 - infoHeight / 2,
        );
        fillNode(card, width, infoHeight, palette.surfaceSoft, 9);
        strokeNode(card, width, infoHeight, palette.border, 9, 1);
        createLabel(
            card,
            'REAL-TIME CAVITY FLOW · HOW TO READ THE RESULT',
            Math.max(1, width - 24),
            22,
            horizontal ? 9 : 10,
            palette.subtle,
            0,
            infoHeight / 2 - 17,
            HorizontalTextAlignment.LEFT,
        );
        const formula = [
            'Re = UL/ν',
            'red = high value · blue = low value',
        ].join('\n');
        const explanation = [
            'the moving top wall drags fluid to the right',
            'viscosity transfers momentum into the cavity',
            'white arrows show local velocity direction',
            'the center return flow closes the recirculation',
        ].join('\n');
        if (horizontal && width >= 650) {
            this.createMultilineLabel(
                card,
                formula,
                width * 0.38,
                infoHeight - 34,
                10,
                palette.primaryText,
                -width * 0.3,
                -7,
                18,
            );
            this.createMultilineLabel(
                card,
                explanation,
                width * 0.56,
                infoHeight - 34,
                9,
                palette.muted,
                width * 0.2,
                -7,
                15,
            );
        } else {
            this.createMultilineLabel(
                card,
                formula,
                Math.max(1, width - 24),
                44,
                10,
                palette.primaryText,
                0,
                infoHeight / 2 - 49,
                17,
            );
            this.createMultilineLabel(
                card,
                explanation,
                Math.max(1, width - 24),
                Math.max(1, infoHeight - 68),
                9,
                palette.muted,
                0,
                -infoHeight / 2 + Math.max(1, infoHeight - 68) / 2 + 5,
                14,
            );
        }
        return inspector;
    }

    private createOverlays(plot: Node, compact: boolean): void {
        this.resultTitleLabel = createLabel(
            plot,
            '',
            Math.max(1, this.plotWidth - 120),
            24,
            compact ? 9 : 11,
            palette.primaryText,
            0,
            this.plotHeight / 2 - 18,
            HorizontalTextAlignment.LEFT,
        ).getComponent(Label);

        this.legendUnitLabel = this.createLegendLabel(plot, '', 9);
        this.legendMaxLabel = this.createLegendLabel(plot, '', compact ? 8 : 9);
        this.legendMidLabel = this.createLegendLabel(plot, '', compact ? 8 : 9);
        this.legendMinLabel = this.createLegendLabel(plot, '', compact ? 8 : 9);

        const statusWidth = Math.min(620, Math.max(1, this.plotWidth - 28));
        const statusHeight = compact ? 54 : 60;
        const status = createUiNode(
            plot,
            'DrivenCavityFlowStatus',
            statusWidth,
            statusHeight,
            -this.plotWidth / 2 + statusWidth / 2 + 14,
            -this.plotHeight / 2 + statusHeight / 2 + 14,
        );
        fillNode(status, statusWidth, statusHeight, palette.backgroundRaised, 7);
        strokeNode(status, statusWidth, statusHeight, palette.border, 7, 1);
        this.modelLabel = createLabel(
            status,
            '',
            statusWidth - 18,
            22,
            compact ? 8 : 10,
            palette.primaryText,
            0,
            13,
            HorizontalTextAlignment.LEFT,
        ).getComponent(Label);
        this.diagnosticsLabel = createLabel(
            status,
            '',
            statusWidth - 18,
            22,
            compact ? 8 : 9,
            palette.muted,
            0,
            -13,
            HorizontalTextAlignment.LEFT,
        ).getComponent(Label);
        if (this.modelLabel) this.modelLabel.enableWrapText = false;
        if (this.diagnosticsLabel) this.diagnosticsLabel.enableWrapText = false;
    }

    private createLegendLabel(parent: Node, text: string, fontSize: number): Label | null {
        const label = createLabel(
            parent,
            text,
            76,
            20,
            fontSize,
            palette.muted,
            0,
            0,
            HorizontalTextAlignment.LEFT,
        ).getComponent(Label);
        if (label) label.enableWrapText = false;
        return label;
    }

    private layoutResultGeometry(): void {
        const legendReserve = this.plotWidth >= 520 ? 104 : 72;
        const top = this.plotHeight / 2 - 42;
        const bottom = -this.plotHeight / 2 + 84;
        const availableHeight = Math.max(90, top - bottom);
        const availableWidth = Math.max(90, this.plotWidth - legendReserve - 38);
        this.cavitySize = Math.max(80, Math.min(availableHeight, availableWidth));
        const left = -this.plotWidth / 2 + 18;
        this.cavityCenterX = left + this.cavitySize / 2;
        this.cavityCenterY = (top + bottom) / 2;
        this.legendX = this.cavityCenterX + this.cavitySize / 2 + 24;
        this.legendHeight = Math.max(76, Math.min(260, this.cavitySize * 0.76));
    }

    private scalarPresentation(state: DrivenCavityFlowViewState): ScalarPresentation {
        if (state.displayMode === 'pressure') {
            let minimum = Number.POSITIVE_INFINITY;
            let maximum = Number.NEGATIVE_INFINITY;
            for (let index = 0; index < state.snapshot.density.length; index += 1) {
                const pressure = (state.snapshot.density[index] - 1) / 3;
                minimum = Math.min(minimum, pressure);
                maximum = Math.max(maximum, pressure);
            }
            if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
                minimum = -1e-6;
                maximum = 1e-6;
            }
            if (maximum - minimum < 1e-8) {
                const center = (minimum + maximum) / 2;
                minimum = center - 1e-6;
                maximum = center + 1e-6;
            }
            return {
                title: 'Pressure Contour',
                unit: 'p* [(lu/step)²]',
                minimum,
                maximum,
            };
        }
        if (state.displayMode === 'vorticity') {
            const maximum = Math.max(
                1e-6,
                this.maximumAbsolute(state.snapshot.vorticity),
            );
            return {
                title: 'Vorticity Contour',
                unit: 'ω [1/step]',
                minimum: -maximum,
                maximum,
            };
        }
        return {
            title: state.displayMode === 'tracers'
                ? 'Velocity Magnitude + Particle Tracks'
                : 'Velocity Magnitude Contour',
            unit: '|u| [lu/step]',
            minimum: 0,
            maximum: Math.max(1e-6, state.diagnostics.maximumSpeed),
        };
    }

    private drawField(
        state: DrivenCavityFlowViewState,
        presentation: ScalarPresentation,
    ): void {
        const graphics = this.fieldGraphics;
        if (!graphics) return;
        graphics.clear();
        const stride = Math.max(1, Math.ceil(state.snapshot.width / 42));
        const width = state.snapshot.width;
        const height = state.snapshot.height;
        const bandCount = CONTOUR_COLORS.length;
        const range = Math.max(1e-12, presentation.maximum - presentation.minimum);
        const cellSize = this.cavitySize * stride / width + 1.2;

        for (let band = 0; band < bandCount; band += 1) {
            graphics.fillColor = CONTOUR_COLORS[band];
            for (let y = 0; y < height; y += stride) {
                for (let x = 0; x < width; x += stride) {
                    const cell = y * width + x;
                    const scalar = state.displayMode === 'pressure'
                        ? (state.snapshot.density[cell] - 1) / 3
                        : state.displayMode === 'vorticity'
                            ? state.snapshot.vorticity[cell]
                            : Math.hypot(
                                state.snapshot.velocityX[cell],
                                state.snapshot.velocityY[cell],
                            );
                    const normalized = Math.max(
                        0,
                        Math.min(1, (scalar - presentation.minimum) / range),
                    );
                    const scalarBand = Math.min(
                        bandCount - 1,
                        Math.floor(normalized * bandCount),
                    );
                    if (scalarBand !== band) continue;
                    const point = this.projectCell(x, y, width, height);
                    graphics.rect(point.x, point.y, cellSize, cellSize);
                }
            }
            graphics.fill();
        }
    }

    private drawTracers(state: DrivenCavityFlowViewState): void {
        const graphics = this.tracerGraphics;
        if (!graphics) return;
        graphics.clear();
        if (state.displayMode !== 'tracers') return;
        graphics.fillColor = TRACER_COLOR;
        for (const tracer of state.tracers) {
            const point = this.projectNormalized(tracer.x, tracer.y);
            graphics.circle(point.x, point.y, 1.5);
        }
        graphics.fill();
    }

    private drawVectors(state: DrivenCavityFlowViewState): void {
        const graphics = this.vectorGraphics;
        if (!graphics) return;
        graphics.clear();
        if (!state.showVectors) return;
        this.drawVectorPass(graphics, state, VECTOR_SHADOW, 2.7);
        this.drawVectorPass(graphics, state, VECTOR_COLOR, 1.15);
    }

    private drawVectorPass(
        graphics: Graphics,
        state: DrivenCavityFlowViewState,
        color: Color,
        lineWidth: number,
    ): void {
        const stride = Math.max(4, Math.ceil(state.snapshot.width / 11));
        const maximum = Math.max(1e-6, state.diagnostics.maximumSpeed);
        graphics.strokeColor = color;
        graphics.lineWidth = lineWidth;
        for (let y = stride; y < state.snapshot.height - stride / 2; y += stride) {
            for (let x = stride; x < state.snapshot.width - stride / 2; x += stride) {
                const cell = y * state.snapshot.width + x;
                const velocityX = state.snapshot.velocityX[cell];
                const velocityY = state.snapshot.velocityY[cell];
                const speed = Math.hypot(velocityX, velocityY);
                if (speed < maximum * 0.018) continue;
                const start = this.projectCellCenter(
                    x,
                    y,
                    state.snapshot.width,
                    state.snapshot.height,
                );
                const unitX = velocityX / speed;
                const unitY = velocityY / speed;
                const length = 4 + 23 * Math.min(1, speed / maximum);
                const end = {
                    x: start.x + unitX * length,
                    y: start.y + unitY * length,
                };
                graphics.moveTo(start.x, start.y);
                graphics.lineTo(end.x, end.y);
                const head = Math.min(5.5, length * 0.36);
                graphics.moveTo(end.x, end.y);
                graphics.lineTo(
                    end.x - unitX * head - unitY * head * 0.55,
                    end.y - unitY * head + unitX * head * 0.55,
                );
                graphics.moveTo(end.x, end.y);
                graphics.lineTo(
                    end.x - unitX * head + unitY * head * 0.55,
                    end.y - unitY * head - unitX * head * 0.55,
                );
            }
        }
        graphics.stroke();
    }

    private drawBoundary(state: DrivenCavityFlowViewState): void {
        const graphics = this.boundaryGraphics;
        if (!graphics) return;
        graphics.clear();
        const half = this.cavitySize / 2;
        const left = this.cavityCenterX - half;
        const bottom = this.cavityCenterY - half;
        if (state.showGrid) {
            graphics.strokeColor = new Color(245, 246, 240, 80);
            graphics.lineWidth = 0.7;
            for (let index = 1; index < 8; index += 1) {
                const x = left + this.cavitySize * index / 8;
                const y = bottom + this.cavitySize * index / 8;
                graphics.moveTo(x, bottom);
                graphics.lineTo(x, bottom + this.cavitySize);
                graphics.moveTo(left, y);
                graphics.lineTo(left + this.cavitySize, y);
            }
            graphics.stroke();
        }
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 2.4;
        graphics.rect(left, bottom, this.cavitySize, this.cavitySize);
        graphics.stroke();

        graphics.strokeColor = palette.accent;
        graphics.lineWidth = 2.2;
        const arrowY = bottom + this.cavitySize + 8;
        for (let index = 0; index < 5; index += 1) {
            const x = left + this.cavitySize * (index + 0.5) / 5;
            graphics.moveTo(x - 10, arrowY);
            graphics.lineTo(x + 10, arrowY);
            graphics.lineTo(x + 5, arrowY + 4);
            graphics.moveTo(x + 10, arrowY);
            graphics.lineTo(x + 5, arrowY - 4);
        }
        graphics.stroke();
    }

    private drawLegend(presentation: ScalarPresentation): void {
        const graphics = this.legendGraphics;
        if (!graphics) return;
        graphics.clear();
        const width = 16;
        const bottom = this.cavityCenterY - this.legendHeight / 2;
        const bandHeight = this.legendHeight / CONTOUR_COLORS.length;
        for (let index = 0; index < CONTOUR_COLORS.length; index += 1) {
            graphics.fillColor = CONTOUR_COLORS[index];
            graphics.rect(
                this.legendX - width / 2,
                bottom + index * bandHeight,
                width,
                bandHeight + 1,
            );
            graphics.fill();
        }
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 1.2;
        graphics.rect(
            this.legendX - width / 2,
            bottom,
            width,
            this.legendHeight,
        );
        graphics.stroke();

        graphics.strokeColor = palette.muted;
        graphics.lineWidth = 1;
        for (const fraction of [0, 0.5, 1]) {
            const y = bottom + this.legendHeight * fraction;
            graphics.moveTo(this.legendX + width / 2, y);
            graphics.lineTo(this.legendX + width / 2 + 6, y);
        }
        graphics.stroke();

        if (this.legendUnitLabel) {
            this.legendUnitLabel.string = presentation.unit;
            this.legendUnitLabel.node.setPosition(
                this.legendX - 8,
                bottom + this.legendHeight + 20,
                0,
            );
        }
        if (this.legendMaxLabel) {
            this.legendMaxLabel.string = this.formatLegendValue(presentation.maximum);
            this.legendMaxLabel.node.setPosition(
                this.legendX + 34,
                bottom + this.legendHeight,
                0,
            );
        }
        if (this.legendMidLabel) {
            this.legendMidLabel.string = this.formatLegendValue(
                (presentation.minimum + presentation.maximum) / 2,
            );
            this.legendMidLabel.node.setPosition(
                this.legendX + 34,
                bottom + this.legendHeight / 2,
                0,
            );
        }
        if (this.legendMinLabel) {
            this.legendMinLabel.string = this.formatLegendValue(presentation.minimum);
            this.legendMinLabel.node.setPosition(
                this.legendX + 34,
                bottom,
                0,
            );
        }
    }

    private updateResultLabels(presentation: ScalarPresentation): void {
        if (!this.resultTitleLabel) return;
        this.resultTitleLabel.string = presentation.title;
        this.resultTitleLabel.node.setPosition(
            this.cavityCenterX,
            this.cavityCenterY + this.cavitySize / 2 + 24,
            0,
        );
    }

    private projectCell(
        x: number,
        y: number,
        width: number,
        height: number,
    ): { x: number; y: number } {
        return {
            x: this.cavityCenterX - this.cavitySize / 2
                + x / width * this.cavitySize,
            y: this.cavityCenterY - this.cavitySize / 2
                + y / height * this.cavitySize,
        };
    }

    private projectCellCenter(
        x: number,
        y: number,
        width: number,
        height: number,
    ): { x: number; y: number } {
        return this.projectNormalized(
            (x + 0.5) / width,
            (y + 0.5) / height,
        );
    }

    private projectNormalized(x: number, y: number): { x: number; y: number } {
        return {
            x: this.cavityCenterX + (x - 0.5) * this.cavitySize,
            y: this.cavityCenterY + (y - 0.5) * this.cavitySize,
        };
    }

    private maximumAbsolute(values: Float32Array): number {
        let maximum = 0;
        for (let index = 0; index < values.length; index += 1) {
            maximum = Math.max(maximum, Math.abs(values[index]));
        }
        return maximum;
    }

    private formatLegendValue(value: number): string {
        const absolute = Math.abs(value);
        if (absolute === 0) return '0.000';
        if (absolute < 0.001 || absolute >= 100) return value.toExponential(2);
        return value.toFixed(3);
    }

    private createGraphics(parent: Node, name: string): Graphics {
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
        const label = createLabel(
            parent,
            text,
            width,
            Math.max(1, height),
            fontSize,
            color,
            x,
            y,
            HorizontalTextAlignment.LEFT,
        ).getComponent(Label);
        if (label) {
            label.lineHeight = lineHeight;
            label.enableWrapText = true;
        }
    }

    private rebuildParameterPanel(): void {
        if (!this.parameterPanelParent || !this.parameterPanelLayout) return;
        this.parameterPanel?.destroy();
        this.parameterPanel = new ParameterPanel(
            this.parameterPanelParent,
            this.parameterSchema,
            this.viewModel,
            (key) => this.actions.parameterChanged(key),
            (error) => this.actions.reportError(error),
        );
        this.parameterPanel.render(this.parameterPanelLayout);
    }
}
