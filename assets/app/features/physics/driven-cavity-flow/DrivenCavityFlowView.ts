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
const SIDE_EQUATION_HEIGHT = 170;
const FIELD_COLORS = [
    new Color(68, 91, 126, 235),
    new Color(91, 123, 142, 220),
    new Color(180, 184, 170, 105),
    new Color(180, 130, 87, 220),
    new Color(161, 88, 68, 235),
] as const;
const TRACER_COLOR = new Color(220, 225, 210, 205);
const VECTOR_COLOR = new Color(210, 167, 96, 190);

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
    private diagnosticsLabel: Label | null = null;
    private modelLabel: Label | null = null;
    private plotWidth = 1;
    private plotHeight = 1;
    private cavitySize = 1;

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
        ) return;

        this.cavitySize = Math.max(1, Math.min(this.plotWidth - 58, this.plotHeight - 86));
        this.drawField(state);
        this.drawTracers(state);
        this.drawVectors(state);
        this.drawBoundary(state);
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
            SIDE_EQUATION_HEIGHT,
        );
        const parameterHeight = Math.max(
            1,
            contentHeight - SIDE_EQUATION_HEIGHT - CONTENT_GAP - 8,
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
        const equationHeight = contentWidth >= 620 ? 126 : 156;
        const inspectorHeight = equationHeight + CONTENT_GAP + parameterHeight;
        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(190, contentHeight - inspectorHeight - CONTENT_GAP);
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
        this.fieldGraphics = this.createGraphics(plot, 'CavityField');
        this.tracerGraphics = this.createGraphics(plot, 'CavityTracers');
        this.vectorGraphics = this.createGraphics(plot, 'CavityVectors');
        this.boundaryGraphics = this.createGraphics(plot, 'CavityBoundary');
    }

    private createInspector(
        width: number,
        height: number,
        x: number,
        y: number,
        horizontal: boolean,
        equationHeight: number,
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
            'DrivenCavityFlowEquationCard',
            width,
            equationHeight,
            0,
            height / 2 - equationHeight / 2,
        );
        fillNode(card, width, equationHeight, palette.surfaceSoft, 9);
        strokeNode(card, width, equationHeight, palette.border, 9, 1);
        createLabel(
            card,
            'D2Q9 LATTICE BOLTZMANN · MOVING-LID CAVITY',
            Math.max(1, width - 24),
            22,
            horizontal ? 9 : 10,
            palette.subtle,
            0,
            equationHeight / 2 - 17,
            HorizontalTextAlignment.LEFT,
        );
        const formula = [
            'fᵢ(x+cᵢ,t+1) = fᵢ − (fᵢ−fᵢeq)/τ',
            'ν = (τ−½)/3      Re = UL/ν',
        ].join('\n');
        const explanation = [
            'top wall: u = (U, 0)',
            'side and bottom walls: no-slip bounce-back',
            'closed cavity · incompressible low-Mach approximation',
        ].join('\n');
        if (horizontal && width >= 650) {
            this.createMultilineLabel(
                card,
                formula,
                width * 0.48,
                equationHeight - 34,
                10,
                palette.primaryText,
                -width * 0.25 + 8,
                -8,
                18,
            );
            this.createMultilineLabel(
                card,
                explanation,
                width * 0.46,
                equationHeight - 34,
                9,
                palette.muted,
                width * 0.25 - 8,
                -8,
                15,
            );
        } else {
            this.createMultilineLabel(
                card,
                formula,
                Math.max(1, width - 24),
                58,
                10,
                palette.primaryText,
                0,
                equationHeight / 2 - 58,
                18,
            );
            this.createMultilineLabel(
                card,
                explanation,
                Math.max(1, width - 24),
                Math.max(1, equationHeight - 82),
                9,
                palette.muted,
                0,
                -equationHeight / 2 + Math.max(1, equationHeight - 82) / 2 + 6,
                14,
            );
        }
        return inspector;
    }

    private createOverlays(plot: Node, compact: boolean): void {
        createLabel(
            plot,
            'CLOSED CAVITY · TOP WALL MOVES RIGHT',
            Math.max(1, this.plotWidth - 32),
            22,
            compact ? 8 : 9,
            palette.subtle,
            0,
            this.plotHeight / 2 - 18,
            HorizontalTextAlignment.LEFT,
        );
        const statusWidth = Math.min(600, Math.max(1, this.plotWidth - 28));
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

    private drawField(state: DrivenCavityFlowViewState): void {
        const graphics = this.fieldGraphics;
        if (!graphics) return;
        graphics.clear();
        if (state.displayMode === 'tracers') return;
        const field = state.displayMode === 'vorticity'
            ? state.snapshot.vorticity
            : null;
        const stride = Math.max(1, Math.ceil(state.snapshot.width / 30));
        let scale = state.displayMode === 'vorticity'
            ? this.maximumAbsolute(field ?? state.snapshot.vorticity)
            : Math.max(1e-6, state.diagnostics.maximumSpeed);
        scale = Math.max(1e-6, scale);
        for (let band = 0; band < FIELD_COLORS.length; band += 1) {
            graphics.fillColor = FIELD_COLORS[band];
            for (let y = 0; y < state.snapshot.height; y += stride) {
                for (let x = 0; x < state.snapshot.width; x += stride) {
                    const cell = y * state.snapshot.width + x;
                    const value = field
                        ? field[cell] / scale
                        : Math.hypot(
                            state.snapshot.velocityX[cell],
                            state.snapshot.velocityY[cell],
                        ) / scale * 2 - 1;
                    if (this.band(value) !== band) continue;
                    const point = this.projectCell(x, y, state.snapshot.width, state.snapshot.height);
                    const size = this.cavitySize * stride / state.snapshot.width + 1;
                    graphics.rect(point.x, point.y, size, size);
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
            graphics.circle(point.x, point.y, 1.45);
        }
        graphics.fill();
    }

    private drawVectors(state: DrivenCavityFlowViewState): void {
        const graphics = this.vectorGraphics;
        if (!graphics) return;
        graphics.clear();
        if (!state.showVectors) return;
        const stride = Math.max(4, Math.ceil(state.snapshot.width / 11));
        const scale = Math.max(1e-6, state.diagnostics.maximumSpeed);
        graphics.strokeColor = VECTOR_COLOR;
        graphics.lineWidth = 1.1;
        for (let y = stride; y < state.snapshot.height - stride / 2; y += stride) {
            for (let x = stride; x < state.snapshot.width - stride / 2; x += stride) {
                const cell = y * state.snapshot.width + x;
                const start = this.projectCellCenter(
                    x,
                    y,
                    state.snapshot.width,
                    state.snapshot.height,
                );
                const lengthScale = 22 / scale;
                const end = {
                    x: start.x + state.snapshot.velocityX[cell] * lengthScale,
                    y: start.y + state.snapshot.velocityY[cell] * lengthScale,
                };
                graphics.moveTo(start.x, start.y);
                graphics.lineTo(end.x, end.y);
            }
        }
        graphics.stroke();
    }

    private drawBoundary(state: DrivenCavityFlowViewState): void {
        const graphics = this.boundaryGraphics;
        if (!graphics) return;
        graphics.clear();
        const half = this.cavitySize / 2;
        if (state.showGrid) {
            graphics.strokeColor = palette.border;
            graphics.lineWidth = 0.7;
            for (let index = 1; index < 8; index += 1) {
                const value = -half + this.cavitySize * index / 8;
                graphics.moveTo(value, -half);
                graphics.lineTo(value, half);
                graphics.moveTo(-half, value);
                graphics.lineTo(half, value);
            }
            graphics.stroke();
        }
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 2.4;
        graphics.rect(-half, -half, this.cavitySize, this.cavitySize);
        graphics.stroke();

        graphics.strokeColor = palette.accent;
        graphics.lineWidth = 2;
        const arrowY = half + 8;
        for (let index = 0; index < 5; index += 1) {
            const x = -half + 18 + index * Math.max(20, (this.cavitySize - 36) / 4);
            graphics.moveTo(x - 10, arrowY);
            graphics.lineTo(x + 10, arrowY);
            graphics.lineTo(x + 5, arrowY + 4);
            graphics.moveTo(x + 10, arrowY);
            graphics.lineTo(x + 5, arrowY - 4);
        }
        graphics.stroke();
    }

    private projectCell(
        x: number,
        y: number,
        width: number,
        height: number,
    ): { x: number; y: number } {
        return {
            x: -this.cavitySize / 2 + x / width * this.cavitySize,
            y: -this.cavitySize / 2 + y / height * this.cavitySize,
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
            x: (x - 0.5) * this.cavitySize,
            y: (y - 0.5) * this.cavitySize,
        };
    }

    private maximumAbsolute(values: Float32Array): number {
        let maximum = 0;
        for (let index = 0; index < values.length; index += 1) {
            maximum = Math.max(maximum, Math.abs(values[index]));
        }
        return maximum;
    }

    private band(value: number): number {
        const normalized = Math.max(-1, Math.min(1, value));
        return Math.min(4, Math.max(0, Math.floor((normalized + 1) * 2.5)));
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
