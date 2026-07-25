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
import {
    lissajousCurrentPhase,
    lissajousDiagnostics,
    lissajousMarkerParameter,
    lissajousPoint,
    wrapPositiveAngle,
    type LissajousAnimationMode,
} from './LissajousModel';
import {
    CUSTOM_LISSAJOUS_PRESET_ID,
    LISSAJOUS_PRESETS,
    findLissajousPreset,
    matchLissajousPreset,
} from './LissajousPresets';

interface CurveLayer {
    readonly echo: number;
    readonly graphics: Graphics;
}

const CURVE_FRAME_INTERVAL = 1 / 30;
const MAXIMUM_ECHO_LAYERS = 4;

const parameterSchema: ParameterSchema = [
    {
        kind: 'select',
        key: 'preset',
        label: 'Preset',
        defaultValue: 'classic-3-2',
        options: [
            ...LISSAJOUS_PRESETS.map((preset) => ({
                value: preset.id,
                label: preset.label,
            })),
            {
                value: CUSTOM_LISSAJOUS_PRESET_ID,
                label: 'Custom',
            },
        ],
    },
    {
        kind: 'select',
        key: 'animationMode',
        label: 'Animation mode',
        defaultValue: 'trace',
        options: [
            { value: 'trace', label: 'Trace' },
            { value: 'phase-morph', label: 'Phase Morph' },
            { value: 'combined', label: 'Combined' },
        ],
    },
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
    private formulaLabel: Label | null = null;
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
            'module:parametric-curve:parameters-v4',
            parameterSchema,
        );
        this.synchronizePresetSelection();
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
        this.formulaLabel = null;
        this.diagnosticsLabel = null;
    }

    update(dt: number): void {
        const parameters = this.parameters;
        if (this.paused || !parameters) {
            return;
        }

        const frameTime = Math.max(0, dt);
        this.elapsed += frameTime * parameters.getNumber('speed');
        this.redrawAccumulator += frameTime;

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
        this.formulaLabel = null;
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
            const formulaWidth = Math.max(1, Math.min(this.plotWidth - 40, 660));
            const formulaNode = createLabel(
                plot,
                '',
                formulaWidth,
                28,
                compact ? 11 : 13,
                palette.muted,
                -this.plotWidth / 2 + formulaWidth / 2 + 20,
                this.plotHeight / 2 - 22,
                HorizontalTextAlignment.LEFT,
            );
            this.formulaLabel = formulaNode.getComponent(Label);
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
        if (key === 'preset') {
            this.applySelectedPreset();
            return;
        }

        if (key === 'frequencyX' || key === 'frequencyY' || key === 'phase') {
            this.synchronizePresetSelection();
        }

        if (key === 'showEchoes') {
            this.render(this.requireContext().viewport.current);
            return;
        }

        this.drawCurve();
    }

    private applySelectedPreset(): void {
        const parameters = this.requireParameters();
        const preset = findLissajousPreset(parameters.getString('preset'));
        if (!preset) {
            return;
        }

        parameters.set('frequencyX', preset.frequencyX);
        parameters.set('frequencyY', preset.frequencyY);
        parameters.set('phase', preset.phase);
        this.elapsed = 0;
        this.redrawAccumulator = 0;
        this.drawCurve();
    }

    private synchronizePresetSelection(): void {
        const parameters = this.parameters;
        if (!parameters) {
            return;
        }

        parameters.set(
            'preset',
            matchLissajousPreset(
                parameters.getNumber('frequencyX'),
                parameters.getNumber('frequencyY'),
                parameters.getNumber('phase'),
            ),
        );
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
        const mode = this.getAnimationMode(parameters.getString('animationMode'));
        const currentPhase = lissajousCurrentPhase(basePhase, this.elapsed, mode);
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
                const parameter = (Math.PI * 2 * index) / this.sampleCount;
                const point = lissajousPoint(
                    frequencyX,
                    frequencyY,
                    phase,
                    parameter,
                    scaleX,
                    scaleY,
                );
                if (index === 0) {
                    graphics.moveTo(point.x, point.y);
                } else {
                    graphics.lineTo(point.x, point.y);
                }
            }
            graphics.stroke();
        }

        this.drawMarker(frequencyX, frequencyY, currentPhase, mode, scaleX, scaleY);
        this.updateInformation(frequencyX, frequencyY, currentPhase, mode);
    }

    private drawMarker(
        frequencyX: number,
        frequencyY: number,
        phase: number,
        mode: LissajousAnimationMode,
        scaleX: number,
        scaleY: number,
    ): void {
        const markerGraphics = this.markerGraphics;
        if (!markerGraphics) {
            return;
        }

        markerGraphics.clear();
        const markerParameter = lissajousMarkerParameter(this.elapsed, mode);
        if (markerParameter === null) {
            return;
        }

        const point = lissajousPoint(
            frequencyX,
            frequencyY,
            phase,
            markerParameter,
            scaleX,
            scaleY,
        );
        markerGraphics.fillColor = palette.warning;
        markerGraphics.circle(point.x, point.y, 5);
        markerGraphics.fill();
    }

    private updateInformation(
        frequencyX: number,
        frequencyY: number,
        phase: number,
        mode: LissajousAnimationMode,
    ): void {
        const wrappedPhase = wrapPositiveAngle(phase);
        if (this.formulaLabel) {
            this.formulaLabel.string = `x = sin(${frequencyX}t + ${wrappedPhase.toFixed(2)})`
                + `   ·   y = sin(${frequencyY}t)`;
        }

        if (!this.diagnosticsLabel) {
            return;
        }

        const diagnostics = lissajousDiagnostics(frequencyX, frequencyY);
        this.diagnosticsLabel.string = `ratio ${diagnostics.ratioX}:${diagnostics.ratioY}`
            + `   ·   period ${diagnostics.period.toFixed(3)} rad`
            + `   ·   closed ${diagnostics.closed ? 'yes' : 'no'}`
            + `   ·   ${this.formatMode(mode)}`;
    }

    private getAnimationMode(value: string): LissajousAnimationMode {
        if (value === 'phase-morph' || value === 'combined') {
            return value;
        }

        return 'trace';
    }

    private formatMode(mode: LissajousAnimationMode): string {
        if (mode === 'phase-morph') {
            return 'phase morph';
        }
        if (mode === 'combined') {
            return 'combined motion';
        }

        return 'curve trace';
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
    description: 'Explore Lissajous presets, frequency ratios, phase morphing and traced motion.',
    category: 'mathematics',
    labId: 'mathematics',
    tags: ['lissajous', 'curves', 'graphics', 'animation'],
    capabilities: ['pause', 'reset', 'settings', 'save-state'],
    status: 'ready',
    order: 10,
    create: () => new ParametricCurveModule(),
};
