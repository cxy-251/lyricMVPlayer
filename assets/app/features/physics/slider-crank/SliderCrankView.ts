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
import type { SliderCrankViewState } from './SliderCrankTypes';
import type { SliderCrankViewModel } from './SliderCrankViewModel';

const CONTENT_GAP = 14;
const SIDE_INFO_HEIGHT = 154;
const CRANK_COLOR = new Color(92, 151, 211, 255);
const ROD_COLOR = new Color(210, 167, 96, 255);
const PISTON_COLOR = new Color(126, 190, 166, 255);
const VELOCITY_COLOR = new Color(126, 190, 166, 235);
const ACCELERATION_COLOR = new Color(224, 151, 72, 235);
const POSITION_COLOR = new Color(231, 235, 227, 220);
const GHOST_COLOR = new Color(180, 188, 181, 80);
const SHADOW_COLOR = new Color(16, 20, 27, 180);

export interface SliderCrankViewActions {
    parameterChanged(key: string): void;
    reportError(error: unknown): void;
}

export class SliderCrankView {
    private parameterPanel: ParameterPanel | null = null;
    private parameterPanelParent: Node | null = null;
    private parameterPanelLayout: ParameterPanelLayout | null = null;
    private mechanismGraphics: Graphics | null = null;
    private curveGraphics: Graphics | null = null;
    private overlayGraphics: Graphics | null = null;
    private diagnosticsLabel: Label | null = null;
    private modelLabel: Label | null = null;
    private plotWidth = 1;
    private plotHeight = 1;

    constructor(
        private readonly root: Node,
        private readonly parameterSchema: ParameterSchema,
        private readonly viewModel: SliderCrankViewModel,
        private readonly actions: SliderCrankViewActions,
    ) {}

    layout(viewport: ViewportSnapshot): void {
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.parameterPanelParent = null;
        this.parameterPanelLayout = null;
        this.mechanismGraphics = null;
        this.curveGraphics = null;
        this.overlayGraphics = null;
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
            && safeWidth >= 940
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

    render(state: SliderCrankViewState): void {
        if (!this.mechanismGraphics || !this.curveGraphics || !this.overlayGraphics) {
            return;
        }
        this.drawMechanism(state);
        this.drawCurves(state);
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
        const plot = this.createPlot(
            leftEdge + this.plotWidth / 2,
            centerY,
        );
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
        const infoHeight = contentWidth >= 620 ? 120 : 152;
        const inspectorHeight = infoHeight + CONTENT_GAP + parameterHeight;
        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(220, contentHeight - inspectorHeight - CONTENT_GAP);
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
            'SliderCrankPlot',
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
        this.mechanismGraphics = this.createGraphics(plot, 'SliderCrankMechanism');
        this.curveGraphics = this.createGraphics(plot, 'SliderCrankCurves');
        this.overlayGraphics = this.createGraphics(plot, 'SliderCrankOverlay');
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
            'SliderCrankInspector',
            width,
            height,
            x,
            y,
        );
        const card = createUiNode(
            inspector,
            'SliderCrankInfoCard',
            width,
            infoHeight,
            0,
            height / 2 - infoHeight / 2,
        );
        fillNode(card, width, infoHeight, palette.surfaceSoft, 9);
        strokeNode(card, width, infoHeight, palette.border, 9, 1);
        createLabel(
            card,
            'SLIDER–CRANK · EXACT PLANAR KINEMATICS',
            Math.max(1, width - 24),
            22,
            horizontal ? 9 : 10,
            palette.subtle,
            0,
            infoHeight / 2 - 17,
            HorizontalTextAlignment.LEFT,
        );
        const formula = [
            'x = r cosθ + √(l² − r² sin²θ)',
            'v = ω dx/dθ     a = ω² d²x/dθ²',
        ].join('\n');
        const explanation = [
            'blue: crank and flywheel',
            'amber: connecting rod',
            'green: piston constrained to the cylinder axis',
            'plot: white position · green velocity · orange acceleration',
        ].join('\n');
        if (horizontal && width >= 650) {
            this.createMultilineLabel(
                card,
                formula,
                width * 0.43,
                infoHeight - 34,
                10,
                palette.primaryText,
                -width * 0.27,
                -7,
                18,
            );
            this.createMultilineLabel(
                card,
                explanation,
                width * 0.51,
                infoHeight - 34,
                9,
                palette.muted,
                width * 0.23,
                -7,
                15,
            );
        } else {
            this.createMultilineLabel(
                card,
                formula,
                Math.max(1, width - 24),
                48,
                10,
                palette.primaryText,
                0,
                infoHeight / 2 - 52,
                18,
            );
            this.createMultilineLabel(
                card,
                explanation,
                Math.max(1, width - 24),
                Math.max(1, infoHeight - 72),
                9,
                palette.muted,
                0,
                -infoHeight / 2 + Math.max(1, infoHeight - 72) / 2 + 5,
                14,
            );
        }
        return inspector;
    }

    private createOverlays(plot: Node, compact: boolean): void {
        createLabel(
            plot,
            'CRANK ROTATION → RECIPROCATING PISTON MOTION',
            Math.max(1, this.plotWidth - 32),
            22,
            compact ? 8 : 10,
            palette.subtle,
            0,
            this.plotHeight / 2 - 18,
            HorizontalTextAlignment.LEFT,
        );
        const statusWidth = Math.min(650, Math.max(1, this.plotWidth - 28));
        const statusHeight = compact ? 54 : 60;
        const status = createUiNode(
            plot,
            'SliderCrankStatus',
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

    private drawMechanism(state: SliderCrankViewState): void {
        const graphics = this.mechanismGraphics;
        if (!graphics) return;
        graphics.clear();

        const chartHeight = state.showPlot
            ? Math.min(174, Math.max(110, this.plotHeight * 0.28))
            : 0;
        const mechanismTop = this.plotHeight / 2 - 42;
        const mechanismBottom = -this.plotHeight / 2 + 78
            + (state.showPlot ? chartHeight + 14 : 0);
        const mechanismHeight = Math.max(80, mechanismTop - mechanismBottom);
        const r = state.crankRadius;
        const l = state.rodLength;
        const worldMinimum = -r * 1.25;
        const worldMaximum = l + r * 2.1;
        const scale = Math.max(
            1,
            Math.min(
                (this.plotWidth - 72) / (worldMaximum - worldMinimum),
                mechanismHeight / (r * 3.2),
            ),
        );
        const originX = -this.plotWidth / 2 + 36 - worldMinimum * scale;
        const axisY = (mechanismTop + mechanismBottom) / 2;
        const crankPin = {
            x: originX + state.sample.crankPin.x * scale,
            y: axisY + state.sample.crankPin.y * scale,
        };
        const pistonPin = {
            x: originX + state.sample.pistonPin.x * scale,
            y: axisY,
        };
        const crankCenter = { x: originX, y: axisY };
        const pistonWidth = Math.max(30, r * scale * 0.78);
        const pistonHeight = Math.max(26, r * scale * 0.78);
        const cylinderStart = originX + (l - r * 1.35) * scale;
        const cylinderEnd = originX + (l + r * 2) * scale;

        this.drawDeadCenters(
            graphics,
            originX + (l - r) * scale,
            originX + (l + r) * scale,
            axisY,
            pistonHeight,
        );

        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 2;
        graphics.moveTo(cylinderStart, axisY + pistonHeight * 0.68);
        graphics.lineTo(cylinderEnd, axisY + pistonHeight * 0.68);
        graphics.moveTo(cylinderStart, axisY - pistonHeight * 0.68);
        graphics.lineTo(cylinderEnd, axisY - pistonHeight * 0.68);
        graphics.stroke();

        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1.2;
        graphics.circle(crankCenter.x, crankCenter.y, r * scale);
        graphics.stroke();

        graphics.strokeColor = SHADOW_COLOR;
        graphics.lineWidth = Math.max(9, r * scale * 0.14);
        graphics.moveTo(crankCenter.x, crankCenter.y);
        graphics.lineTo(crankPin.x, crankPin.y);
        graphics.stroke();
        graphics.strokeColor = CRANK_COLOR;
        graphics.lineWidth = Math.max(5, r * scale * 0.08);
        graphics.moveTo(crankCenter.x, crankCenter.y);
        graphics.lineTo(crankPin.x, crankPin.y);
        graphics.stroke();

        graphics.strokeColor = SHADOW_COLOR;
        graphics.lineWidth = Math.max(11, r * scale * 0.17);
        graphics.moveTo(crankPin.x, crankPin.y);
        graphics.lineTo(pistonPin.x, pistonPin.y);
        graphics.stroke();
        graphics.strokeColor = ROD_COLOR;
        graphics.lineWidth = Math.max(6, r * scale * 0.10);
        graphics.moveTo(crankPin.x, crankPin.y);
        graphics.lineTo(pistonPin.x, pistonPin.y);
        graphics.stroke();

        graphics.fillColor = PISTON_COLOR;
        graphics.rect(
            pistonPin.x - pistonWidth * 0.42,
            axisY - pistonHeight / 2,
            pistonWidth,
            pistonHeight,
        );
        graphics.fill();
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 1.6;
        graphics.rect(
            pistonPin.x - pistonWidth * 0.42,
            axisY - pistonHeight / 2,
            pistonWidth,
            pistonHeight,
        );
        graphics.stroke();

        graphics.fillColor = palette.backgroundRaised;
        graphics.circle(crankCenter.x, crankCenter.y, Math.max(6, r * scale * 0.11));
        graphics.circle(crankPin.x, crankPin.y, Math.max(5, r * scale * 0.09));
        graphics.circle(pistonPin.x, pistonPin.y, Math.max(5, r * scale * 0.085));
        graphics.fill();
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 1.4;
        graphics.circle(crankCenter.x, crankCenter.y, Math.max(6, r * scale * 0.11));
        graphics.circle(crankPin.x, crankPin.y, Math.max(5, r * scale * 0.09));
        graphics.circle(pistonPin.x, pistonPin.y, Math.max(5, r * scale * 0.085));
        graphics.stroke();

        if (state.showVelocity) {
            const normalized = state.sample.pistonVelocity / state.maximumVelocity;
            this.drawHorizontalArrow(
                graphics,
                pistonPin.x,
                axisY + pistonHeight * 0.95,
                normalized,
                VELOCITY_COLOR,
            );
        }
        if (state.showAcceleration) {
            const normalized = state.sample.pistonAcceleration
                / state.maximumAcceleration;
            this.drawHorizontalArrow(
                graphics,
                pistonPin.x,
                axisY - pistonHeight * 0.95,
                normalized,
                ACCELERATION_COLOR,
            );
        }
    }

    private drawDeadCenters(
        graphics: Graphics,
        minimumX: number,
        maximumX: number,
        axisY: number,
        pistonHeight: number,
    ): void {
        graphics.strokeColor = GHOST_COLOR;
        graphics.lineWidth = 1;
        for (const x of [minimumX, maximumX]) {
            for (let segment = -2; segment <= 2; segment += 1) {
                const y = axisY + segment * pistonHeight * 0.32;
                graphics.moveTo(x, y - pistonHeight * 0.11);
                graphics.lineTo(x, y + pistonHeight * 0.11);
            }
        }
        graphics.stroke();
    }

    private drawHorizontalArrow(
        graphics: Graphics,
        x: number,
        y: number,
        normalized: number,
        color: Color,
    ): void {
        const magnitude = Math.abs(normalized);
        if (magnitude < 0.015) return;
        const sign = normalized < 0 ? -1 : 1;
        const length = sign * (12 + 42 * Math.min(1, magnitude));
        const endX = x + length;
        graphics.strokeColor = SHADOW_COLOR;
        graphics.lineWidth = 4;
        graphics.moveTo(x, y);
        graphics.lineTo(endX, y);
        graphics.stroke();
        graphics.strokeColor = color;
        graphics.lineWidth = 2;
        graphics.moveTo(x, y);
        graphics.lineTo(endX, y);
        graphics.lineTo(endX - sign * 7, y + 5);
        graphics.moveTo(endX, y);
        graphics.lineTo(endX - sign * 7, y - 5);
        graphics.stroke();
    }

    private drawCurves(state: SliderCrankViewState): void {
        const graphics = this.curveGraphics;
        const overlay = this.overlayGraphics;
        if (!graphics || !overlay) return;
        graphics.clear();
        overlay.clear();
        if (!state.showPlot || state.cycle.length < 2) return;

        const chartHeight = Math.min(174, Math.max(110, this.plotHeight * 0.28));
        const left = -this.plotWidth / 2 + 34;
        const right = this.plotWidth / 2 - 34;
        const bottom = -this.plotHeight / 2 + 76;
        const top = bottom + chartHeight;
        const middle = (top + bottom) / 2;

        overlay.strokeColor = palette.border;
        overlay.lineWidth = 1;
        overlay.rect(left, bottom, right - left, chartHeight);
        for (let index = 1; index < 4; index += 1) {
            const x = left + (right - left) * index / 4;
            overlay.moveTo(x, bottom);
            overlay.lineTo(x, top);
        }
        overlay.moveTo(left, middle);
        overlay.lineTo(right, middle);
        overlay.stroke();

        this.drawCurve(
            graphics,
            state,
            left,
            right,
            middle,
            chartHeight,
            POSITION_COLOR,
            (point) => point.position * 2 - 1,
        );
        if (state.showVelocity) {
            this.drawCurve(
                graphics,
                state,
                left,
                right,
                middle,
                chartHeight,
                VELOCITY_COLOR,
                (point) => point.velocity / state.maximumVelocity,
            );
        }
        if (state.showAcceleration) {
            this.drawCurve(
                graphics,
                state,
                left,
                right,
                middle,
                chartHeight,
                ACCELERATION_COLOR,
                (point) => point.acceleration / state.maximumAcceleration,
            );
        }

        const cursor = left + (right - left) * state.sample.angle / (Math.PI * 2);
        overlay.strokeColor = palette.accent;
        overlay.lineWidth = 1.5;
        overlay.moveTo(cursor, bottom);
        overlay.lineTo(cursor, top);
        overlay.stroke();
    }

    private drawCurve(
        graphics: Graphics,
        state: SliderCrankViewState,
        left: number,
        right: number,
        middle: number,
        chartHeight: number,
        color: Color,
        value: (point: SliderCrankViewState['cycle'][number]) => number,
    ): void {
        graphics.strokeColor = color;
        graphics.lineWidth = 1.8;
        state.cycle.forEach((point, index) => {
            const x = left + (right - left) * point.angle / (Math.PI * 2);
            const normalized = Math.max(-1, Math.min(1, value(point)));
            const y = middle + normalized * chartHeight * 0.42;
            if (index === 0) graphics.moveTo(x, y);
            else graphics.lineTo(x, y);
        });
        graphics.stroke();
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
