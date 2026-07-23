import {
    Color,
    Graphics,
    HorizontalTextAlignment,
    Node,
} from 'cc';
import type {
    InteractiveModule,
    ModuleContext,
    Pausable,
    Resettable,
    Updatable,
    VisibleModuleDefinition,
} from '../../contracts/InteractiveModule';
import { ParameterController } from '../../parameters/ParameterController';
import { ParameterPanel } from '../../parameters/ParameterPanel';
import type { ParameterSchema } from '../../parameters/ParameterSchema';
import type { ViewportSnapshot } from '../../services/ViewportService';
import {
    clearNode,
    createLabel,
    createUiNode,
    fillNode,
    palette,
    strokeNode,
} from '../../ui/UiFactory';

interface CurveLayer {
    readonly trail: number;
    readonly graphics: Graphics;
}

const CURVE_FRAME_INTERVAL = 1 / 30;

const parameterSchema: ParameterSchema = [
    {
        kind: 'number',
        key: 'frequencyX',
        label: 'X frequency',
        defaultValue: 3,
        minimum: 1,
        maximum: 9,
        step: 1,
        decimals: 0,
    },
    {
        kind: 'number',
        key: 'frequencyY',
        label: 'Y frequency',
        defaultValue: 2,
        minimum: 1,
        maximum: 9,
        step: 1,
        decimals: 0,
    },
    {
        kind: 'number',
        key: 'phase',
        label: 'Phase',
        defaultValue: 0.65,
        minimum: 0,
        maximum: Math.PI,
        step: 0.05,
        decimals: 2,
        unit: ' rad',
    },
];

class ParametricCurveModule implements InteractiveModule, Updatable, Pausable, Resettable {
    private root: Node | null = null;
    private context: ModuleContext | null = null;
    private curveLayers: CurveLayer[] = [];
    private markerGraphics: Graphics | null = null;
    private unsubscribeViewport: (() => void) | null = null;
    private parameters: ParameterController | null = null;
    private parameterPanel: ParameterPanel | null = null;
    private elapsed = 0;
    private redrawAccumulator = 0;
    private paused = false;
    private plotWidth = 1;
    private plotHeight = 1;
    private sampleCount = 320;
    private trailLayerCount = 4;

    mount(context: ModuleContext): void {
        this.context = context;
        this.parameters = new ParameterController(
            context.storage,
            'module:parametric-curve:parameters-v2',
            parameterSchema,
        );
        this.elapsed = 0;
        this.redrawAccumulator = 0;
        this.paused = false;

        const viewport = context.viewport.current;
        this.root = createUiNode(context.host, 'ParametricCurveLab', viewport.width, viewport.height);
        let initializing = true;

        try {
            this.unsubscribeViewport = context.viewport.subscribe((snapshot) => {
                try {
                    this.renderLayout(snapshot);
                } catch (error) {
                    if (initializing) {
                        throw error;
                    }

                    context.reportError(error);
                }
            });
        } finally {
            initializing = false;
        }
    }

    update(dt: number): void {
        if (this.paused || !this.parameters) {
            return;
        }

        this.elapsed += dt * 0.55;
        this.redrawAccumulator += dt;

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

        if (this.context) {
            this.renderLayout(this.context.viewport.current);
        }
    }

    unmount(): void {
        this.unsubscribeViewport?.();
        this.unsubscribeViewport = null;
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.parameters?.dispose();
        this.parameters = null;
        this.curveLayers = [];
        this.markerGraphics = null;
        this.root?.destroy();
        this.root = null;
        this.context = null;
    }

    private renderLayout(viewport: ViewportSnapshot): void {
        const root = this.root;
        const parameters = this.parameters;

        if (!root || !parameters) {
            return;
        }

        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        clearNode(root);
        this.curveLayers = [];
        this.markerGraphics = null;
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
        this.trailLayerCount = contentWidth < 280 ? 2 : compact ? 3 : 4;
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
            'CurvePlot',
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
        this.drawCurve();

        if (this.plotHeight >= 90 && this.plotWidth >= 80) {
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

        this.parameterPanel = new ParameterPanel(
            root,
            parameterSchema,
            parameters,
            () => this.drawCurve(),
            (error) => this.context?.reportError(error),
        );
        this.parameterPanel.render({
            width: contentWidth,
            x: centerX,
            y: panelY,
            breakpoint: viewport.breakpoint,
        });
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
        for (let trail = this.trailLayerCount - 1; trail >= 0; trail -= 1) {
            const node = createUiNode(
                plot,
                `CurveTrail:${trail}`,
                this.plotWidth,
                this.plotHeight,
            );
            this.curveLayers.push({
                trail,
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

        const frequencyX = parameters.getNumber('frequencyX');
        const frequencyY = parameters.getNumber('frequencyY');
        const basePhase = parameters.getNumber('phase');
        const scaleX = this.plotWidth * 0.42;
        const scaleY = this.plotHeight * 0.40;
        const maximumTrail = Math.max(1, this.trailLayerCount - 1);

        for (const layer of this.curveLayers) {
            const { graphics, trail } = layer;
            const alpha = Math.round(46 + (maximumTrail - trail) * (164 / maximumTrail));
            graphics.clear();
            graphics.strokeColor = trail === 0
                ? new Color(palette.accent.r, palette.accent.g, palette.accent.b, 230)
                : new Color(palette.primary.r, palette.primary.g, palette.primary.b, alpha);
            graphics.lineWidth = trail === 0 ? 2.4 : 1.2;
            const phase = basePhase + this.elapsed - trail * 0.07;

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
        const markerX = Math.sin(
            frequencyX * markerT + basePhase + this.elapsed,
        ) * scaleX;
        const markerY = Math.sin(frequencyY * markerT) * scaleY;
        this.markerGraphics.clear();
        this.markerGraphics.fillColor = palette.warning;
        this.markerGraphics.circle(markerX, markerY, 5);
        this.markerGraphics.fill();
    }
}

export const parametricCurveDefinition: VisibleModuleDefinition = {
    id: 'parametric-curve-lab',
    title: 'Parametric Curve Lab',
    description: 'Animate and tune a code-generated Lissajous field in real time.',
    category: 'mathematics',
    labId: 'mathematics',
    tags: ['curves', 'graphics', 'animation'],
    capabilities: ['pause', 'reset', 'settings', 'save-state'],
    status: 'ready',
    order: 10,
    create: () => new ParametricCurveModule(),
};
