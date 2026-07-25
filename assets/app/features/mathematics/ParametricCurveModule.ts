import {
    Color,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Node,
} from 'cc';
import type {
    Pausable,
    Resettable,
    Updatable,
    VisibleModuleDefinition,
} from '../../contracts/InteractiveModule';
import { ParameterController } from '../../parameters/ParameterController';
import { ParameterPanel } from '../../parameters/ParameterPanel';
import type { ParameterSchema } from '../../parameters/ParameterSchema';
import type { ViewportSnapshot } from '../../services/ViewportService';
import { ResponsiveModule } from '../../templates/ResponsiveModule';
import {
    clearNode,
    createLabel,
    createUiNode,
    fillNode,
    palette,
    strokeNode,
} from '../../ui/UiFactory';

interface CurveLayer {
    readonly echo: number;
    readonly graphics: Graphics;
}

const CURVE_FRAME_INTERVAL = 1 / 30;
const MAXIMUM_ECHO_LAYERS = 4;

const parameterSchema: ParameterSchema = [
    {
        kind: 'number',
        key: 'frequencyX',
        label: 'X frequency',
        defaultValue: 3,
        minimum: 1,
        maximum: 12,
        step: 1,
        decimals: 0,
    },
    {
        kind: 'number',
        key: 'frequencyY',
        label: 'Y frequency',
        defaultValue: 2,
        minimum: 1,
        maximum: 12,
        step: 1,
        decimals: 0,
    },
    {
        kind: 'number',
        key: 'phase',
        label: 'Phase offset',
        defaultValue: 0.65,
        minimum: 0,
        maximum: Math.PI * 2,
        step: 0.05,
        decimals: 2,
        unit: ' rad',
    },
    {
        kind: 'number',
        key: 'speed',
        label: 'Animation speed',
        defaultValue: 0.55,
        minimum: 0.1,
        maximum: 2,
        step: 0.1,
        decimals: 1,
        unit: '×',
    },
    {
        kind: 'toggle',
        key: 'animatePhase',
        label: 'Phase motion',
        defaultValue: true,
        onLabel: 'MOVING',
        offLabel: 'FIXED',
    },
    {
        kind: 'toggle',
        key: 'showEchoes',
        label: 'Phase echoes',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
];

class ParametricCurveModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'LissajousCurveLab';

    private curveLayers: CurveLayer[] = [];
    private markerGraphics: Graphics | null = null;
    private diagnosticsLabel: Label | null = null;
    private parameters: ParameterController | null = null;
    private parameterPanel: ParameterPanel | null = null;
    private elapsed = 0;
    private redrawAccumulator = 0;
    private paused = false;
    private plotWidth = 1;
    private plotHeight = 1;
    private sampleCount = 320;
    private echoLayerCount = MAXIMUM_ECHO_LAYERS;

    protected onMount(): void {
        const context = this.requireContext();
        this.parameters = new ParameterController(
            context.storage,
            'module:parametric-curve:parameters-v3',
            parameterSchema,
        );
        this.elapsed = 0;
        this.redrawAccumulator = 0;
        this.paused = false;
    }

    protected onUnmount(): void {
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.parameters?.dispose();
        this.parameters = null;
        this.curveLayers = [];
        this.markerGraphics = null;
        this.diagnosticsLabel = null;
    }

    update(dt: number): void {
        const parameters = this.parameters;
        if (this.paused || !parameters) {
            return;
        }

        this.elapsed += Math.max(0, dt) * parameters.getNumber('speed');
        this.redrawAccumulator += Math.max(0, dt);

        if (this.redrawAccumulator < CURVE_FRAME_INTERVAL) {
            return;
        }

        this.redrawAccumulator %= CURVE_FRAME_INTERVAL;
        this.drawCurve();
    }

    pause(): void {
        this.paused = true;
    }

    resume(): void {
        this.paused = false;
    }

    reset(): void {
        this.parameters?.reset();
        this.elapsed = 0;
        this.redrawAccumulator = 0;
        this.render(this.requireContext().viewport.current);
    }

    protected render(viewport: ViewportSnapshot): void {
        const root = this.requireRoot();
        const parameters = this.requireParameters();

        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.curveLayers = [];
        this.markerGraphics = null;
        this.diagnosticsLabel = null;
        clearNode(root);
        root.setPosition(0, 0, 0);
        fillNode(root, viewport.width, viewport.height, palette.background);

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
        this.echoLayerCount = parameters.getBoolean('showEchoes')
            ? contentWidth < 280 ? 2 : compact ? 3 : MAXIMUM_ECHO_LAYERS
            : 1;
        const sampleLimit = compact ? 300 : viewport.breakpoint === 'medium' ? 460 : 620;
        this.sampleCount = Math.max(64, Math.min(sampleLimit, Math.round(contentWidth * 0.9)));
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const panelHeight = ParameterPanel.measureHeight(
            parameterSchema.length,
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

        const plot = createUiNode(
            root,
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
        this.createCurveLayers(plot);

        if (this.plotHeight >= 90 && this.plotWidth >= 180) {
            createLabel(
                plot,
                'x = sin(at + φ)   ·   y = sin(bt)',
                Math.max(1, Math.min(this.plotWidth - 40, 520)),
                28,
                compact ? 11 : 13,
                palette.muted,
                -this.plotWidth / 2 + Math.min(this.plotWidth / 2, 270),
                this.plotHeight / 2 - 22,
                HorizontalTextAlignment.LEFT,
            );
        }

        if (this.plotHeight >= 80 && this.plotWidth >= 220) {
            const diagnosticsNode = createLabel(
                plot,
                '',
                Math.max(1, this.plotWidth - 40),
                26,
                compact ? 10 : 12,
                palette.muted,
                0,
                -this.plotHeight / 2 + 20,
                HorizontalTextAlignment.LEFT,
            );
            this.diagnosticsLabel = diagnosticsNode.getComponent(Label);
        }

        this.parameterPanel = new ParameterPanel(
            root,
            parameterSchema,
            parameters,
            (key) => this.handleParameterChange(key),
            (error) => this.requireContext().reportError(error),
        );
        this.parameterPanel.render({
            width: contentWidth,
            x: centerX,
            y: panelY,
            breakpoint: viewport.breakpoint,
        });
        this.drawCurve();
    }

    private handleParameterChange(key: string): void {
        if (key === 'showEchoes') {
            this.render(this.requireContext().viewport.current);
            return;
        }

        this.drawCurve();
    }

    private drawGrid(plot: Node): void {
        const gridNode = createUiNode(plot, 'CurveGridLines', this.plotWidth, this.plotHeight);
        const grid = gridNode.addComponent(Graphics);
        grid.lineWidth = 1;
        grid.strokeColor = new Color(palette.border.r, palette.border.g, palette.border.b, 54);

        const verticalSteps = 10;
        const horizontalSteps = 8;
        for (let index = 1; index < verticalSteps; index += 1) {
            const x = -this.plotWidth / 2 + (this.plotWidth * index) / verticalSteps;
            grid.moveTo(x, -this.plotHeight / 2);
            grid.lineTo(x, this.plotHeight / 2);
        }
        for (let index = 1; index < horizontalSteps; index += 1) {
            const y = -this.plotHeight / 2 + (this.plotHeight * index) / horizontalSteps;
            grid.moveTo(-this.plotWidth / 2, y);
            grid.lineTo(this.plotWidth / 2, y);
        }
        grid.stroke();

        const axesNode = createUiNode(plot, 'CurveAxes', this.plotWidth, this.plotHeight);
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

    private createCurveLayers(plot: Node): void {
        for (let echo = this.echoLayerCount - 1; echo >= 0; echo -= 1) {
            const node = createUiNode(
                plot,
                `CurveEcho:${echo}`,
                this.plotWidth,
                this.plotHeight,
            );
            this.curveLayers.push({
                echo,
                graphics: node.addComponent(Graphics),
            });
        }

        const markerNode = createUiNode(plot, 'CurveMarker', this.plotWidth, this.plotHeight);
        this.markerGraphics = markerNode.addComponent(Graphics);
    }

    private drawCurve(): void {
        const parameters = this.parameters;
        if (!parameters || this.curveLayers.length === 0 || !this.markerGraphics) {
            return;
        }

        const frequencyX = Math.round(parameters.getNumber('frequencyX'));
        const frequencyY = Math.round(parameters.getNumber('frequencyY'));
        const basePhase = parameters.getNumber('phase');
        const animatePhase = parameters.getBoolean('animatePhase');
        const currentPhase = basePhase + (animatePhase ? this.elapsed : 0);
        const scaleX = this.plotWidth * 0.42;
        const scaleY = this.plotHeight * 0.40;
        const maximumEcho = Math.max(1, this.echoLayerCount - 1);

        for (const layer of this.curveLayers) {
            const { graphics, echo } = layer;
            const alpha = Math.round(46 + (maximumEcho - echo) * (164 / maximumEcho));
            graphics.clear();
            graphics.strokeColor = echo === 0
                ? new Color(palette.accent.r, palette.accent.g, palette.accent.b, 230)
                : new Color(palette.primary.r, palette.primary.g, palette.primary.b, alpha);
            graphics.lineWidth = echo === 0 ? 2.4 : 1.2;
            const phase = currentPhase - echo * 0.08;

            for (let index = 0; index <= this.sampleCount; index += 1) {
                const t = (Math.PI * 2 * index) / this.sampleCount;
                const x = Math.sin(frequencyX * t + phase) * scaleX;
                const y = Math.sin(frequencyY * t) * scaleY;
                if (index === 0) {
                    graphics.moveTo(x, y);
                } else {
                    graphics.lineTo(x, y);
                }
            }
            graphics.stroke();
        }

        const markerT = this.elapsed % (Math.PI * 2);
        const markerX = Math.sin(frequencyX * markerT + currentPhase) * scaleX;
        const markerY = Math.sin(frequencyY * markerT) * scaleY;
        this.markerGraphics.clear();
        this.markerGraphics.fillColor = palette.warning;
        this.markerGraphics.circle(markerX, markerY, 5);
        this.markerGraphics.fill();
        this.updateDiagnostics(frequencyX, frequencyY, currentPhase, animatePhase);
    }

    private updateDiagnostics(
        frequencyX: number,
        frequencyY: number,
        phase: number,
        animatePhase: boolean,
    ): void {
        if (!this.diagnosticsLabel) {
            return;
        }

        const divisor = this.greatestCommonDivisor(frequencyX, frequencyY);
        const ratioX = frequencyX / divisor;
        const ratioY = frequencyY / divisor;
        const period = Math.PI * 2 / divisor;
        this.diagnosticsLabel.string = `ratio ${ratioX}:${ratioY}`
            + `   ·   period ${period.toFixed(3)} rad`
            + `   ·   φ ${this.wrapPositive(phase).toFixed(2)} rad`
            + `   ·   ${animatePhase ? 'moving phase' : 'fixed phase'}`;
    }

    private greatestCommonDivisor(left: number, right: number): number {
        let a = Math.max(1, Math.abs(Math.round(left)));
        let b = Math.max(1, Math.abs(Math.round(right)));
        while (b !== 0) {
            const remainder = a % b;
            a = b;
            b = remainder;
        }
        return a;
    }

    private wrapPositive(value: number): number {
        const period = Math.PI * 2;
        return ((value % period) + period) % period;
    }

    private requireParameters(): ParameterController {
        if (!this.parameters) {
            throw new Error('Lissajous parameters are unavailable');
        }
        return this.parameters;
    }
}

export const parametricCurveDefinition: VisibleModuleDefinition = {
    id: 'parametric-curve-lab',
    title: 'Lissajous Curve Lab',
    description: 'Explore closed Lissajous figures, frequency ratios, phase motion and echo layers.',
    category: 'mathematics',
    labId: 'mathematics',
    tags: ['lissajous', 'curves', 'graphics', 'animation'],
    capabilities: ['pause', 'reset', 'settings', 'save-state'],
    status: 'ready',
    order: 10,
    create: () => new ParametricCurveModule(),
};
