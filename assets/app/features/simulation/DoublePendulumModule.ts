import {
    Color,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Node,
} from 'cc';
import type {
    ModuleDefinition,
    Pausable,
    Resettable,
    Updatable,
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
    createPill,
    createUiNode,
    fillNode,
    palette,
    strokeNode,
} from '../../ui/UiFactory';

interface PendulumState {
    readonly theta1: number;
    readonly theta2: number;
    readonly omega1: number;
    readonly omega2: number;
}

interface PendulumDerivative {
    readonly theta1: number;
    readonly theta2: number;
    readonly omega1: number;
    readonly omega2: number;
}

interface SimulationParameters {
    readonly gravity: number;
    readonly length1: number;
    readonly length2: number;
    readonly damping: number;
}

interface VisualStyle {
    readonly trail: Color;
    readonly rod: Color;
    readonly bob1: Color;
    readonly bob2: Color;
    readonly pivot: Color;
}

const parameterSchema: ParameterSchema = [
    {
        kind: 'number',
        key: 'gravity',
        label: 'Gravity',
        defaultValue: 9.8,
        minimum: 2,
        maximum: 20,
        step: 0.5,
        decimals: 1,
    },
    {
        kind: 'number',
        key: 'length1',
        label: 'Upper length',
        defaultValue: 1,
        minimum: 0.5,
        maximum: 1.8,
        step: 0.1,
        decimals: 1,
    },
    {
        kind: 'number',
        key: 'length2',
        label: 'Lower length',
        defaultValue: 1,
        minimum: 0.5,
        maximum: 1.8,
        step: 0.1,
        decimals: 1,
    },
    {
        kind: 'number',
        key: 'damping',
        label: 'Damping',
        defaultValue: 0.003,
        minimum: 0,
        maximum: 0.03,
        step: 0.003,
        decimals: 3,
    },
    {
        kind: 'number',
        key: 'speed',
        label: 'Time scale',
        defaultValue: 1,
        minimum: 0.25,
        maximum: 2,
        step: 0.25,
        decimals: 2,
        unit: '×',
    },
    {
        kind: 'number',
        key: 'trailLength',
        label: 'Trail samples',
        defaultValue: 360,
        minimum: 120,
        maximum: 720,
        step: 120,
        decimals: 0,
    },
    {
        kind: 'toggle',
        key: 'showTrail',
        label: 'Trace',
        defaultValue: true,
        onLabel: 'VISIBLE',
        offLabel: 'HIDDEN',
    },
    {
        kind: 'select',
        key: 'palette',
        label: 'Palette',
        defaultValue: 'aurora',
        options: [
            { value: 'aurora', label: 'Aurora' },
            { value: 'ember', label: 'Ember' },
            { value: 'mono', label: 'Mono' },
        ],
    },
];

const visualStyles: Record<string, VisualStyle> = {
    aurora: {
        trail: new Color(255, 92, 142, 190),
        rod: new Color(188, 205, 232, 255),
        bob1: new Color(54, 221, 184, 255),
        bob2: new Color(255, 190, 74, 255),
        pivot: new Color(238, 243, 252, 255),
    },
    ember: {
        trail: new Color(255, 121, 61, 190),
        rod: new Color(255, 219, 179, 255),
        bob1: new Color(255, 190, 74, 255),
        bob2: new Color(255, 92, 92, 255),
        pivot: new Color(255, 244, 224, 255),
    },
    mono: {
        trail: new Color(185, 199, 222, 180),
        rod: new Color(216, 225, 240, 255),
        bob1: new Color(238, 243, 252, 255),
        bob2: new Color(145, 159, 184, 255),
        pivot: new Color(255, 255, 255, 255),
    },
};

class DoublePendulumModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'DoublePendulumLab';

    private readonly clock = new FixedStepClock(1 / 120, 16);
    private readonly trail = new TrailBuffer(360);

    private parameters: ParameterController | null = null;
    private parameterPanel: ParameterPanel | null = null;
    private state: PendulumState = this.initialState();
    private paused = false;

    private trailGraphics: Graphics | null = null;
    private rodGraphics: Graphics | null = null;
    private pivotGraphics: Graphics | null = null;
    private bob1Graphics: Graphics | null = null;
    private bob2Graphics: Graphics | null = null;
    private energyLabel: Label | null = null;

    private plotWidth = 1;
    private plotHeight = 1;
    private pivotX = 0;
    private pivotY = 0;
    private scale = 1;

    protected onMount(): void {
        const context = this.requireContext();
        this.parameters = new ParameterController(
            context.storage,
            'module:double-pendulum:parameters',
            parameterSchema,
        );
        this.trail.setCapacity(this.parameters.getNumber('trailLength'));
        this.resetState();
    }

    protected onUnmount(): void {
        this.parameterPanel = null;
        this.parameters = null;
        this.trailGraphics = null;
        this.rodGraphics = null;
        this.pivotGraphics = null;
        this.bob1Graphics = null;
        this.bob2Graphics = null;
        this.energyLabel = null;
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
            (step) => this.integrate(step),
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
        this.parameters?.reset();
        this.resetState();

        if (this.context) {
            this.render(this.context.viewport.current);
        }
    }

    protected render(viewport: ViewportSnapshot): void {
        const root = this.requireRoot();
        const parameters = this.requireParameters();

        this.parameterPanel = null;
        this.trailGraphics = null;
        this.rodGraphics = null;
        this.pivotGraphics = null;
        this.bob1Graphics = null;
        this.bob2Graphics = null;
        this.energyLabel = null;

        clearNode(root);
        fillNode(root, viewport.width, viewport.height, palette.background);

        const horizontalPadding = viewport.breakpoint === 'compact' ? 14 : 34;
        const safeWidth = viewport.width
            - viewport.safeInsets.left
            - viewport.safeInsets.right;
        const contentWidth = Math.max(280, safeWidth - horizontalPadding * 2);
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
        const plotTop = viewport.height / 2 - viewport.safeInsets.top - 88;
        const plotBottom = panelY + panelHeight / 2 + 14;

        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(160, plotTop - plotBottom);
        const plotY = (plotTop + plotBottom) / 2;

        const plot = createUiNode(
            root,
            'PendulumPlot',
            this.plotWidth,
            this.plotHeight,
            centerX,
            plotY,
        );
        fillNode(plot, this.plotWidth, this.plotHeight, palette.surfaceSoft, 22);
        strokeNode(plot, this.plotWidth, this.plotHeight, palette.border, 22, 1.25);
        this.drawBackdrop(plot);

        this.pivotX = 0;
        this.pivotY = this.plotHeight * 0.30;
        const totalLength = parameters.getNumber('length1') + parameters.getNumber('length2');
        this.scale = Math.min(
            this.plotWidth * 0.36 / totalLength,
            this.plotHeight * 0.74 / totalLength,
        );

        this.trailGraphics = createUiNode(
            plot,
            'PendulumTrail',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
        this.rodGraphics = createUiNode(
            plot,
            'PendulumRods',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
        this.pivotGraphics = createUiNode(
            plot,
            'PendulumPivot',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
        this.bob1Graphics = createUiNode(
            plot,
            'PendulumUpperBob',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
        this.bob2Graphics = createUiNode(
            plot,
            'PendulumLowerBob',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);

        const labelNode = createLabel(
            plot,
            '',
            Math.min(520, this.plotWidth - 36),
            34,
            viewport.breakpoint === 'compact' ? 12 : 14,
            palette.muted,
            -this.plotWidth / 2 + Math.min(260, (this.plotWidth - 36) / 2) + 18,
            this.plotHeight / 2 - 28,
            HorizontalTextAlignment.LEFT,
        );
        this.energyLabel = labelNode.getComponent(Label);

        createPill(
            plot,
            'RK4 · 120 HZ',
            112,
            this.plotWidth / 2 - 70,
            this.plotHeight / 2 - 28,
            true,
        );

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

    private drawBackdrop(plot: Node): void {
        const node = createUiNode(plot, 'PendulumBackdrop', this.plotWidth, this.plotHeight);
        const graphics = node.addComponent(Graphics);
        graphics.strokeColor = new Color(58, 75, 105, 75);
        graphics.lineWidth = 1;

        const spacing = 48;

        for (let x = -this.plotWidth / 2 + spacing; x < this.plotWidth / 2; x += spacing) {
            graphics.moveTo(x, -this.plotHeight / 2);
            graphics.lineTo(x, this.plotHeight / 2);
        }

        for (let y = -this.plotHeight / 2 + spacing; y < this.plotHeight / 2; y += spacing) {
            graphics.moveTo(-this.plotWidth / 2, y);
            graphics.lineTo(this.plotWidth / 2, y);
        }

        graphics.stroke();
    }

    private handleParameterChange(key: string): void {
        const parameters = this.requireParameters();

        if (key === 'trailLength') {
            this.trail.setCapacity(parameters.getNumber('trailLength'));
        }

        if (key === 'length1' || key === 'length2') {
            this.trail.clear();

            if (this.context) {
                this.render(this.context.viewport.current);
                return;
            }
        }

        this.drawSimulation();
    }

    private resetState(): void {
        this.state = this.initialState();
        this.paused = false;
        this.clock.reset();
        this.trail.clear();
        this.pushTrailPoint();
    }

    private initialState(): PendulumState {
        return {
            theta1: 1.92,
            theta2: 1.16,
            omega1: 0,
            omega2: 0,
        };
    }

    private integrate(step: number): void {
        const parameters = this.simulationParameters();
        const state = this.state;
        const k1 = this.derivative(state, parameters);
        const k2 = this.derivative(this.offset(state, k1, step / 2), parameters);
        const k3 = this.derivative(this.offset(state, k2, step / 2), parameters);
        const k4 = this.derivative(this.offset(state, k3, step), parameters);

        this.state = {
            theta1: state.theta1 + step * (
                k1.theta1 + 2 * k2.theta1 + 2 * k3.theta1 + k4.theta1
            ) / 6,
            theta2: state.theta2 + step * (
                k1.theta2 + 2 * k2.theta2 + 2 * k3.theta2 + k4.theta2
            ) / 6,
            omega1: state.omega1 + step * (
                k1.omega1 + 2 * k2.omega1 + 2 * k3.omega1 + k4.omega1
            ) / 6,
            omega2: state.omega2 + step * (
                k1.omega2 + 2 * k2.omega2 + 2 * k3.omega2 + k4.omega2
            ) / 6,
        };
        this.pushTrailPoint();
    }

    private derivative(
        state: PendulumState,
        parameters: SimulationParameters,
    ): PendulumDerivative {
        const { gravity, length1, length2, damping } = parameters;
        const mass1 = 1;
        const mass2 = 1;
        const delta = state.theta1 - state.theta2;
        const sinDelta = Math.sin(delta);
        const cosDelta = Math.cos(delta);
        const denominator1 = (
            (mass1 + mass2) * length1
            - mass2 * length1 * cosDelta * cosDelta
        );
        const denominator2 = (length2 / length1) * denominator1;

        const alpha1 = (
            mass2 * length1 * state.omega1 * state.omega1 * sinDelta * cosDelta
            + mass2 * gravity * Math.sin(state.theta2) * cosDelta
            + mass2 * length2 * state.omega2 * state.omega2 * sinDelta
            - (mass1 + mass2) * gravity * Math.sin(state.theta1)
        ) / denominator1 - damping * state.omega1;

        const alpha2 = (
            -mass2 * length2 * state.omega2 * state.omega2 * sinDelta * cosDelta
            + (mass1 + mass2) * (
                gravity * Math.sin(state.theta1) * cosDelta
                - length1 * state.omega1 * state.omega1 * sinDelta
                - gravity * Math.sin(state.theta2)
            )
        ) / denominator2 - damping * state.omega2;

        return {
            theta1: state.omega1,
            theta2: state.omega2,
            omega1: alpha1,
            omega2: alpha2,
        };
    }

    private offset(
        state: PendulumState,
        derivative: PendulumDerivative,
        scale: number,
    ): PendulumState {
        return {
            theta1: state.theta1 + derivative.theta1 * scale,
            theta2: state.theta2 + derivative.theta2 * scale,
            omega1: state.omega1 + derivative.omega1 * scale,
            omega2: state.omega2 + derivative.omega2 * scale,
        };
    }

    private simulationParameters(): SimulationParameters {
        const parameters = this.requireParameters();
        return {
            gravity: parameters.getNumber('gravity'),
            length1: parameters.getNumber('length1'),
            length2: parameters.getNumber('length2'),
            damping: parameters.getNumber('damping'),
        };
    }

    private pushTrailPoint(): void {
        const parameters = this.parameters;

        if (!parameters) {
            return;
        }

        const length1 = parameters.getNumber('length1');
        const length2 = parameters.getNumber('length2');
        const x1 = Math.sin(this.state.theta1) * length1;
        const y1 = -Math.cos(this.state.theta1) * length1;
        this.trail.push({
            x: x1 + Math.sin(this.state.theta2) * length2,
            y: y1 - Math.cos(this.state.theta2) * length2,
        });
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

        const style = visualStyles[parameters.getString('palette')] ?? visualStyles.aurora;
        const length1 = parameters.getNumber('length1');
        const length2 = parameters.getNumber('length2');
        const x1 = this.pivotX + Math.sin(this.state.theta1) * length1 * this.scale;
        const y1 = this.pivotY - Math.cos(this.state.theta1) * length1 * this.scale;
        const x2 = x1 + Math.sin(this.state.theta2) * length2 * this.scale;
        const y2 = y1 - Math.cos(this.state.theta2) * length2 * this.scale;

        trailGraphics.clear();

        if (parameters.getBoolean('showTrail')) {
            const points = this.trail.values;
            trailGraphics.strokeColor = style.trail;
            trailGraphics.lineWidth = 2;

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
        rodGraphics.strokeColor = style.rod;
        rodGraphics.lineWidth = 4;
        rodGraphics.moveTo(this.pivotX, this.pivotY);
        rodGraphics.lineTo(x1, y1);
        rodGraphics.lineTo(x2, y2);
        rodGraphics.stroke();

        pivotGraphics.clear();
        pivotGraphics.fillColor = style.pivot;
        pivotGraphics.circle(this.pivotX, this.pivotY, 7);
        pivotGraphics.fill();

        bob1Graphics.clear();
        bob1Graphics.fillColor = style.bob1;
        bob1Graphics.circle(x1, y1, 13);
        bob1Graphics.fill();

        bob2Graphics.clear();
        bob2Graphics.fillColor = style.bob2;
        bob2Graphics.circle(x2, y2, 16);
        bob2Graphics.fill();

        if (this.energyLabel) {
            this.energyLabel.string = [
                `ENERGY ${this.energy().toFixed(2)}`,
                `θ₁ ${(this.state.theta1 * 180 / Math.PI).toFixed(1)}°`,
                `θ₂ ${(this.state.theta2 * 180 / Math.PI).toFixed(1)}°`,
            ].join('   ·   ');
        }
    }

    private energy(): number {
        const parameters = this.simulationParameters();
        const { gravity, length1, length2 } = parameters;
        const delta = this.state.theta1 - this.state.theta2;
        const kinetic = 0.5 * length1 * length1 * this.state.omega1 * this.state.omega1
            + 0.5 * (
                length1 * length1 * this.state.omega1 * this.state.omega1
                + length2 * length2 * this.state.omega2 * this.state.omega2
                + 2 * length1 * length2 * this.state.omega1 * this.state.omega2 * Math.cos(delta)
            );
        const potential = -2 * gravity * length1 * Math.cos(this.state.theta1)
            - gravity * length2 * Math.cos(this.state.theta2);
        return kinetic + potential;
    }

    private requireParameters(): ParameterController {
        if (!this.parameters) {
            throw new Error('Double pendulum parameters are not initialized');
        }

        return this.parameters;
    }
}

export const doublePendulumDefinition: ModuleDefinition = {
    id: 'double-pendulum-lab',
    title: 'Double Pendulum Lab',
    description: 'Explore a chaotic two-link pendulum with fixed-step RK4 integration.',
    category: 'simulation',
    tags: ['dynamics', 'chaos', 'rk4'],
    capabilities: ['pause', 'reset', 'settings', 'save-state'],
    status: 'ready',
    order: 20,
    create: () => new DoublePendulumModule(),
};
