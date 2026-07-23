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
import { FixedStepClock } from '../../animation/FixedStepClock';
import { TrailBuffer } from '../../graphics/TrailBuffer';
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
    DoublePendulumModel,
    type DoublePendulumParameters,
} from './DoublePendulumModel';

const PARAMETER_APPLY_DELAY_MS = 140;

const parameterSchema: ParameterSchema = [
    {
        kind: 'number',
        key: 'gravity',
        label: 'Gravity',
        defaultValue: 9.81,
        minimum: 1,
        maximum: 20,
        step: 0.1,
        decimals: 2,
        unit: ' m/s²',
    },
    {
        kind: 'number',
        key: 'mass1',
        label: 'Upper mass',
        defaultValue: 1,
        minimum: 0.2,
        maximum: 3,
        step: 0.2,
        decimals: 1,
        unit: ' kg',
    },
    {
        kind: 'number',
        key: 'mass2',
        label: 'Lower mass',
        defaultValue: 1,
        minimum: 0.2,
        maximum: 3,
        step: 0.2,
        decimals: 1,
        unit: ' kg',
    },
    {
        kind: 'number',
        key: 'length1',
        label: 'Upper length',
        defaultValue: 1,
        minimum: 0.5,
        maximum: 1.5,
        step: 0.1,
        decimals: 1,
        unit: ' m',
    },
    {
        kind: 'number',
        key: 'length2',
        label: 'Lower length',
        defaultValue: 1,
        minimum: 0.5,
        maximum: 1.5,
        step: 0.1,
        decimals: 1,
        unit: ' m',
    },
    {
        kind: 'number',
        key: 'speed',
        label: 'Time scale',
        defaultValue: 0.75,
        minimum: 0.25,
        maximum: 1.5,
        step: 0.25,
        decimals: 2,
        unit: '×',
    },
    {
        kind: 'toggle',
        key: 'showTrail',
        label: 'Trajectory',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
];

const defaultModelParameters: DoublePendulumParameters = {
    gravity: 9.81,
    mass1: 1,
    mass2: 1,
    length1: 1,
    length2: 1,
};

class DoublePendulumModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'DoublePendulumLab';

    private readonly clock = new FixedStepClock(1 / 240, 32);
    private readonly trail = new TrailBuffer(480);
    private readonly model = new DoublePendulumModel(defaultModelParameters);

    private parameters: ParameterController | null = null;
    private parameterPanel: ParameterPanel | null = null;
    private parameterApplyTimer: ReturnType<typeof setTimeout> | null = null;
    private paused = false;

    private trailGraphics: Graphics | null = null;
    private rodGraphics: Graphics | null = null;
    private referenceGraphics: Graphics | null = null;
    private pivotGraphics: Graphics | null = null;
    private bob1Graphics: Graphics | null = null;
    private bob2Graphics: Graphics | null = null;
    private diagnosticsLabel: Label | null = null;

    private plotWidth = 1;
    private plotHeight = 1;
    private pivotX = 0;
    private pivotY = 0;
    private scale = 1;

    protected onMount(): void {
        const context = this.requireContext();
        this.parameters = new ParameterController(
            context.storage,
            'module:double-pendulum:parameters-v2',
            parameterSchema,
        );
        this.resetModelFromParameters();
    }

    protected onUnmount(): void {
        this.cancelPendingParameterApply();
        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.parameters?.dispose();
        this.parameters = null;
        this.trailGraphics = null;
        this.rodGraphics = null;
        this.referenceGraphics = null;
        this.pivotGraphics = null;
        this.bob1Graphics = null;
        this.bob2Graphics = null;
        this.diagnosticsLabel = null;
        this.trail.clear();
        this.clock.reset();
    }

    update(dt: number): void {
        if (this.paused || !this.parameters) {
            return;
        }

        const steps = this.clock.advance(
            dt,
            this.parameters.getNumber('speed'),
            (step) => {
                this.model.step(step);
                this.pushTrailPoint();
            },
        );

        if (steps > 0) {
            this.drawSimulation();
        }
    }

    pause(): void {
        this.paused = true;
    }

    resume(): void {
        this.paused = false;
    }

    reset(): void {
        this.cancelPendingParameterApply();
        this.resetModelFromParameters();
        this.recalculateScale();
        this.drawReference();
        this.drawSimulation();
    }

    protected render(viewport: ViewportSnapshot): void {
        const root = this.requireRoot();
        const parameters = this.requireParameters();

        this.parameterPanel?.destroy();
        this.parameterPanel = null;
        this.trailGraphics = null;
        this.rodGraphics = null;
        this.referenceGraphics = null;
        this.pivotGraphics = null;
        this.bob1Graphics = null;
        this.bob2Graphics = null;
        this.diagnosticsLabel = null;

        clearNode(root);
        fillNode(root, viewport.width, viewport.height, palette.background);

        const compact = viewport.breakpoint === 'compact';
        const horizontalPadding = compact ? 16 : 36;
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const contentWidth = Math.min(1180, Math.max(280, safeWidth - horizontalPadding * 2));
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
        const plotY = (plotTop + plotBottom) / 2;

        const plot = createUiNode(
            root,
            'PendulumPlot',
            this.plotWidth,
            this.plotHeight,
            centerX,
            plotY,
        );
        const plotRadius = Math.min(8, this.plotHeight / 2);
        fillNode(plot, this.plotWidth, this.plotHeight, palette.surface, plotRadius);
        strokeNode(plot, this.plotWidth, this.plotHeight, palette.border, plotRadius, 1);

        this.pivotX = 0;
        this.pivotY = this.plotHeight * 0.29;
        this.recalculateScale();

        this.referenceGraphics = createUiNode(
            plot,
            'Reference',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
        this.drawReference();

        this.trailGraphics = createUiNode(
            plot,
            'Trajectory',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
        this.rodGraphics = createUiNode(
            plot,
            'Rods',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
        this.pivotGraphics = createUiNode(
            plot,
            'Pivot',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
        this.bob1Graphics = createUiNode(
            plot,
            'UpperMass',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
        this.bob2Graphics = createUiNode(
            plot,
            'LowerMass',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);

        if (this.plotHeight >= 100) {
            createLabel(
                plot,
                'IDEAL MODEL  ·  POINT MASSES  ·  MASSLESS RIGID RODS  ·  FRICTIONLESS PIVOTS',
                this.plotWidth - 32,
                24,
                compact ? 9 : 10,
                palette.subtle,
                0,
                this.plotHeight / 2 - 20,
                HorizontalTextAlignment.LEFT,
            );
        }

        if (this.plotHeight >= 70) {
            const diagnosticsNode = createLabel(
                plot,
                '',
                this.plotWidth - 32,
                28,
                compact ? 10 : 12,
                palette.muted,
                0,
                -this.plotHeight / 2 + 22,
                HorizontalTextAlignment.LEFT,
            );
            this.diagnosticsLabel = diagnosticsNode.getComponent(Label);
        }

        this.parameterPanel = new ParameterPanel(
            root,
            parameterSchema,
            parameters,
            (key) => this.handleParameterChange(key),
        );
        this.parameterPanel.render({
            width: contentWidth,
            x: centerX,
            y: panelY,
            breakpoint: viewport.breakpoint,
        });

        this.drawSimulation();
    }

    private handleParameterChange(key: string): void {
        if (key === 'speed' || key === 'showTrail') {
            this.drawSimulation();
            return;
        }

        this.scheduleParameterApply();
    }

    private scheduleParameterApply(): void {
        this.cancelPendingParameterApply();
        this.parameterApplyTimer = setTimeout(() => {
            this.parameterApplyTimer = null;

            if (!this.parameters) {
                return;
            }

            this.resetModelFromParameters();
            this.recalculateScale();
            this.drawReference();
            this.drawSimulation();
        }, PARAMETER_APPLY_DELAY_MS);
    }

    private cancelPendingParameterApply(): void {
        if (this.parameterApplyTimer === null) {
            return;
        }

        clearTimeout(this.parameterApplyTimer);
        this.parameterApplyTimer = null;
    }

    private resetModelFromParameters(): void {
        this.model.setParameters(this.modelParameters());
        this.clock.reset();
        this.trail.clear();
        this.pushTrailPoint();
    }

    private modelParameters(): DoublePendulumParameters {
        const parameters = this.requireParameters();
        return {
            gravity: parameters.getNumber('gravity'),
            mass1: parameters.getNumber('mass1'),
            mass2: parameters.getNumber('mass2'),
            length1: parameters.getNumber('length1'),
            length2: parameters.getNumber('length2'),
        };
    }

    private recalculateScale(): void {
        const { length1, length2 } = this.model.parameters;
        const totalLength = length1 + length2;
        this.scale = Math.min(
            this.plotWidth * 0.34 / totalLength,
            this.plotHeight * 0.72 / totalLength,
        );
    }

    private pushTrailPoint(): void {
        const second = this.model.positions().second;
        this.trail.push(second);
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

    private drawSimulation(): void {
        const parameters = this.parameters;
        const trailGraphics = this.trailGraphics;
        const rodGraphics = this.rodGraphics;
        const pivotGraphics = this.pivotGraphics;
        const bob1Graphics = this.bob1Graphics;
        const bob2Graphics = this.bob2Graphics;

        if (
            !parameters
            || !trailGraphics
            || !rodGraphics
            || !pivotGraphics
            || !bob1Graphics
            || !bob2Graphics
        ) {
            return;
        }

        const positions = this.model.positions();
        const { mass1, mass2 } = this.model.parameters;
        const x1 = this.pivotX + positions.first.x * this.scale;
        const y1 = this.pivotY + positions.first.y * this.scale;
        const x2 = this.pivotX + positions.second.x * this.scale;
        const y2 = this.pivotY + positions.second.y * this.scale;

        trailGraphics.clear();

        if (parameters.getBoolean('showTrail')) {
            const points = this.trail.values;
            trailGraphics.strokeColor = new Color(
                palette.primary.r,
                palette.primary.g,
                palette.primary.b,
                156,
            );
            trailGraphics.lineWidth = 1.5;

            for (let index = 0; index < points.length; index += 1) {
                const point = points[index];
                const x = this.pivotX + point.x * this.scale;
                const y = this.pivotY + point.y * this.scale;

                if (index === 0) {
                    trailGraphics.moveTo(x, y);
                } else {
                    trailGraphics.lineTo(x, y);
                }
            }

            if (points.length > 1) {
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

        bob1Graphics.clear();
        bob1Graphics.fillColor = palette.accent;
        bob1Graphics.circle(x1, y1, 8 + Math.sqrt(mass1) * 4);
        bob1Graphics.fill();

        bob2Graphics.clear();
        bob2Graphics.fillColor = palette.warning;
        bob2Graphics.circle(x2, y2, 8 + Math.sqrt(mass2) * 4);
        bob2Graphics.fill();

        const diagnostics = this.model.diagnostics();
        const constraintMicrometers = diagnostics.constraintError * 1_000_000;

        if (this.diagnosticsLabel) {
            this.diagnosticsLabel.string = [
                `t ${diagnostics.elapsedTime.toFixed(2)} s`,
                `E ${diagnostics.totalEnergy.toFixed(5)} J`,
                `ΔE ${(diagnostics.relativeEnergyDrift * 1_000_000).toFixed(1)} ppm`,
                `constraint ${constraintMicrometers.toFixed(3)} µm`,
            ].join('   ·   ');
        }
    }

    private requireParameters(): ParameterController {
        if (!this.parameters) {
            throw new Error('Double pendulum parameters are unavailable');
        }

        return this.parameters;
    }
}

export const doublePendulumDefinition: VisibleModuleDefinition = {
    id: 'double-pendulum-lab',
    title: 'Double Pendulum',
    description: 'Study a conservative planar double pendulum with measurable energy and constraint error.',
    category: 'physics',
    labId: 'physics',
    tags: ['mechanics', 'chaos', 'conservation'],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 10,
    create: () => new DoublePendulumModule(),
};
