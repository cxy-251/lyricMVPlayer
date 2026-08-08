import {
    Button,
    Color,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Node,
    UITransform,
} from 'cc';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import {
    clearNode,
    createLabel,
    createUiNode,
    fillNode,
} from '../../../ui/UiFactory';
import type {
    DoublePendulumPoint,
    DoublePendulumPositions,
    DoublePendulumViewState,
} from './DoublePendulumTypes';
import { DOUBLE_PENDULUM_PRESETS } from './DoublePendulumViewModel';

const BACKGROUND = new Color(23, 22, 18, 255);
const PANEL = new Color(31, 29, 23, 255);
const GRID = new Color(111, 102, 80, 55);
const TRACK = new Color(241, 232, 210, 235);
const TRACK_SOFT = new Color(241, 232, 210, 64);
const AMBER = new Color(255, 177, 59, 255);
const AMBER_SOFT = new Color(255, 177, 59, 78);
const RED = new Color(228, 86, 60, 255);
const RED_SOFT = new Color(228, 86, 60, 92);
const CYAN = new Color(98, 183, 198, 245);
const CYAN_SOFT = new Color(98, 183, 198, 72);
const MUTED = new Color(171, 161, 140, 255);

interface Point {
    readonly x: number;
    readonly y: number;
}

export interface DoublePendulumViewActions {
    presetChanged(index: number): void;
    reportError(error: unknown): void;
}

export class DoublePendulumView {
    private graphics: Graphics | null = null;
    private detailLabel: Label | null = null;
    private diagnosticsLabel: Label | null = null;
    private divergenceLabel: Label | null = null;
    private phaseLabel: Label | null = null;
    private presetLabels: Label[] = [];
    private presetVisuals: Node[] = [];
    private plotWidth = 1;
    private plotHeight = 1;
    private pivotX = 0;
    private pivotY = 0;
    private activePreset = 0;

    constructor(
        private readonly root: Node,
        private readonly actions: DoublePendulumViewActions,
    ) {}

    layout(viewport: ViewportSnapshot): void {
        this.graphics = null;
        this.detailLabel = null;
        this.diagnosticsLabel = null;
        this.divergenceLabel = null;
        this.phaseLabel = null;
        this.presetLabels = [];
        this.presetVisuals = [];
        clearNode(this.root);
        this.root.setPosition(0, 0, 0);
        fillNode(this.root, viewport.width, viewport.height, BACKGROUND);

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = Math.max(
            1,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const padding = compact ? 16 : 40;
        const contentWidth = Math.max(280, Math.min(1220, safeWidth - padding * 2));
        const railHeight = compact ? 78 : 84;
        const railY = -viewport.height / 2
            + viewport.safeInsets.bottom
            + 16
            + railHeight / 2;
        const top = viewport.height / 2
            - viewport.safeInsets.top
            - (compact ? 70 : 78);
        const bottom = railY + railHeight / 2 + 16;

        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(270, top - bottom);
        const plotY = (top + bottom) / 2;
        const plot = createUiNode(
            this.root,
            'DoublePendulumPlot',
            contentWidth,
            this.plotHeight,
            centerX,
            plotY,
        );
        fillNode(plot, contentWidth, this.plotHeight, PANEL, compact ? 2 : 4);
        this.graphics = createUiNode(
            plot,
            'DoublePendulumArt',
            contentWidth,
            this.plotHeight,
        ).addComponent(Graphics);

        this.pivotX = contentWidth < 620 ? 0 : -contentWidth * 0.06;
        this.pivotY = this.plotHeight * 0.28;

        createLabel(
            this.root,
            'MECHANICS / CHAOTIC DOUBLE PENDULUM',
            contentWidth,
            24,
            compact ? 10 : 11,
            AMBER,
            centerX,
            top - 15,
        );
        const diagnosticsNode = createLabel(
            this.root,
            '',
            Math.min(contentWidth - 132, 720),
            24,
            compact ? 8 : 10,
            TRACK,
            centerX - (compact ? 36 : 66),
            top - 42,
            HorizontalTextAlignment.LEFT,
        );
        this.diagnosticsLabel = diagnosticsNode.getComponent(Label);
        const phaseNode = createLabel(
            this.root,
            'RUN  t 0.00',
            compact ? 96 : 126,
            24,
            compact ? 8 : 10,
            RED,
            centerX + contentWidth / 2 - (compact ? 56 : 74),
            top - 42,
        );
        this.phaseLabel = phaseNode.getComponent(Label);

        const divergenceNode = createLabel(
            plot,
            'SEPARATION  0.000 m',
            compact ? 150 : 210,
            22,
            compact ? 8 : 10,
            CYAN,
            -contentWidth / 2 + (compact ? 87 : 118),
            this.plotHeight / 2 - 68,
            HorizontalTextAlignment.LEFT,
        );
        this.divergenceLabel = divergenceNode.getComponent(Label);
        createLabel(
            plot,
            'PRIMARY',
            78,
            20,
            compact ? 8 : 9,
            AMBER,
            -contentWidth / 2 + 52,
            this.plotHeight / 2 - 92,
        );
        createLabel(
            plot,
            'TWIN +δθ',
            86,
            20,
            compact ? 8 : 9,
            CYAN,
            -contentWidth / 2 + 132,
            this.plotHeight / 2 - 92,
        );

        const detailNode = createLabel(
            this.root,
            DOUBLE_PENDULUM_PRESETS[this.activePreset].detail,
            Math.min(contentWidth - 28, 820),
            compact ? 42 : 34,
            compact ? 11 : 13,
            MUTED,
            centerX,
            bottom + (compact ? 22 : 18),
        );
        this.detailLabel = detailNode.getComponent(Label);

        this.createPresetRail(this.root, centerX, railY, contentWidth, railHeight, compact);
    }

    render(state: DoublePendulumViewState): void {
        const graphics = this.graphics;
        if (!graphics) {
            return;
        }

        this.activePreset = state.presetIndex;
        this.paintRail();
        if (this.detailLabel) {
            this.detailLabel.string = DOUBLE_PENDULUM_PRESETS[state.presetIndex].detail;
        }
        if (this.diagnosticsLabel) {
            this.diagnosticsLabel.string = `RK4 1/240 s  ·  ${state.diagnostics}`;
        }
        if (this.divergenceLabel) {
            this.divergenceLabel.string = `SEPARATION  ${state.divergence.toFixed(3)} m`;
        }
        if (this.phaseLabel) {
            this.phaseLabel.string = `RUN  t ${state.elapsedTime.toFixed(2)}`;
        }

        const totalLength = Math.max(0.001, state.length1 + state.length2);
        const scale = Math.min(
            this.plotWidth * 0.30 / totalLength,
            this.plotHeight * 0.68 / totalLength,
        );
        const primary = this.scalePositions(state.positions, scale);
        const companion = this.scalePositions(state.companionPositions, scale);

        graphics.clear();
        this.drawGrid(graphics);
        this.drawSupport(graphics);
        if (state.showTrail) {
            this.drawTrail(graphics, state.companionTrail, scale, CYAN_SOFT, 1.35);
            this.drawTrail(graphics, state.trail, scale, RED_SOFT, 1.75);
        }
        this.drawSeparation(graphics, primary.second, companion.second);
        this.drawPendulum(graphics, companion, state.mass1, state.mass2, CYAN, CYAN_SOFT, true);
        this.drawPendulum(graphics, primary, state.mass1, state.mass2, TRACK, AMBER, false);
        this.drawDivergenceGauge(graphics, state.divergence, totalLength);
        this.drawMeasurementRuler(graphics);
    }

    destroy(): void {
        clearNode(this.root);
    }

    private createPresetRail(
        root: Node,
        centerX: number,
        centerY: number,
        width: number,
        height: number,
        compact: boolean,
    ): void {
        const rail = createUiNode(root, 'DoublePendulumPresetRail', width, height, centerX, centerY);
        const guide = rail.addComponent(Graphics);
        guide.strokeColor = new Color(118, 105, 77, 180);
        guide.lineWidth = 1;
        guide.moveTo(-width / 2 + 10, height / 2 - 1);
        guide.lineTo(width / 2 - 10, height / 2 - 1);
        guide.stroke();

        const segmentWidth = width / DOUBLE_PENDULUM_PRESETS.length;
        DOUBLE_PENDULUM_PRESETS.forEach((preset, index) => {
            const buttonRoot = createUiNode(
                rail,
                `DoublePendulumPreset:${index}`,
                segmentWidth,
                height,
                -width / 2 + segmentWidth * (index + 0.5),
                0,
            );
            const visual = createUiNode(buttonRoot, '__Visual', segmentWidth - 6, 40, 0, -3);
            const labelNode = createLabel(
                visual,
                preset.label.toUpperCase(),
                segmentWidth - 12,
                38,
                compact ? 8 : 10,
                index === this.activePreset ? TRACK : MUTED,
            );
            const label = labelNode.getComponent(Label);
            if (label) {
                this.presetLabels.push(label);
            }
            this.presetVisuals.push(visual);
            const button = buttonRoot.addComponent(Button);
            button.target = visual;
            button.transition = Button.Transition.SCALE;
            button.zoomScale = 0.94;
            button.duration = 0.08;
            buttonRoot.on(Button.EventType.CLICK, () => {
                try {
                    this.actions.presetChanged(index);
                } catch (error) {
                    this.actions.reportError(error);
                }
            });
        });
        this.paintRail();
    }

    private paintRail(): void {
        this.presetVisuals.forEach((visual, index) => {
            const width = visual.getComponent(UITransform)?.contentSize.width ?? 64;
            fillNode(
                visual,
                width,
                40,
                index === this.activePreset
                    ? new Color(67, 55, 31, 255)
                    : new Color(0, 0, 0, 0),
                3,
            );
            const label = this.presetLabels[index];
            if (label) {
                label.color = index === this.activePreset ? TRACK : MUTED;
            }
        });
    }

    private scalePositions(positions: DoublePendulumPositions, scale: number): {
        readonly first: Point;
        readonly second: Point;
    } {
        return {
            first: {
                x: this.pivotX + positions.first.x * scale,
                y: this.pivotY + positions.first.y * scale,
            },
            second: {
                x: this.pivotX + positions.second.x * scale,
                y: this.pivotY + positions.second.y * scale,
            },
        };
    }

    private drawGrid(graphics: Graphics): void {
        const step = Math.max(34, Math.min(54, this.plotWidth / 11));
        graphics.strokeColor = GRID;
        graphics.lineWidth = 1;
        for (let x = -this.plotWidth / 2; x <= this.plotWidth / 2; x += step) {
            graphics.moveTo(x, -this.plotHeight / 2);
            graphics.lineTo(x, this.plotHeight / 2);
        }
        for (let y = -this.plotHeight / 2; y <= this.plotHeight / 2; y += step) {
            graphics.moveTo(-this.plotWidth / 2, y);
            graphics.lineTo(this.plotWidth / 2, y);
        }
        graphics.stroke();
    }

    private drawSupport(graphics: Graphics): void {
        const beamHalfWidth = Math.min(150, this.plotWidth * 0.22);
        const beamY = this.pivotY + 34;
        this.line(
            graphics,
            { x: this.pivotX - beamHalfWidth, y: beamY },
            { x: this.pivotX + beamHalfWidth, y: beamY },
            TRACK,
            3,
        );
        for (let index = -3; index <= 3; index += 1) {
            const x = this.pivotX + index * beamHalfWidth / 3;
            this.line(
                graphics,
                { x: x - 9, y: beamY + 12 },
                { x: x + 9, y: beamY },
                TRACK_SOFT,
                1,
            );
        }
        this.line(
            graphics,
            { x: this.pivotX, y: beamY },
            { x: this.pivotX, y: this.pivotY },
            TRACK,
            2,
        );
        graphics.fillColor = PANEL;
        graphics.strokeColor = TRACK;
        graphics.lineWidth = 2;
        graphics.circle(this.pivotX, this.pivotY, 7);
        graphics.fill();
        graphics.stroke();
    }

    private drawTrail(
        graphics: Graphics,
        trail: readonly DoublePendulumPoint[],
        scale: number,
        color: Color,
        lineWidth: number,
    ): void {
        if (trail.length < 2) {
            return;
        }
        graphics.strokeColor = color;
        graphics.lineWidth = lineWidth;
        trail.forEach((point, index) => {
            const x = this.pivotX + point.x * scale;
            const y = this.pivotY + point.y * scale;
            if (index === 0) {
                graphics.moveTo(x, y);
            } else {
                graphics.lineTo(x, y);
            }
        });
        graphics.stroke();
    }

    private drawPendulum(
        graphics: Graphics,
        positions: { readonly first: Point; readonly second: Point },
        mass1: number,
        mass2: number,
        rodColor: Color,
        massColor: Color,
        companion: boolean,
    ): void {
        this.line(graphics, { x: this.pivotX, y: this.pivotY }, positions.first, rodColor, companion ? 1.5 : 3.2);
        this.line(graphics, positions.first, positions.second, rodColor, companion ? 1.5 : 3.2);
        const firstRadius = 7 + Math.sqrt(mass1) * 3.2;
        const secondRadius = 8 + Math.sqrt(mass2) * 3.6;

        if (companion) {
            graphics.strokeColor = massColor;
            graphics.lineWidth = 2;
            graphics.circle(positions.first.x, positions.first.y, firstRadius);
            graphics.circle(positions.second.x, positions.second.y, secondRadius);
            graphics.stroke();
            return;
        }

        graphics.fillColor = AMBER_SOFT;
        graphics.circle(positions.first.x, positions.first.y, firstRadius + 6);
        graphics.fill();
        graphics.fillColor = AMBER;
        graphics.circle(positions.first.x, positions.first.y, firstRadius);
        graphics.fill();
        graphics.fillColor = RED_SOFT;
        graphics.circle(positions.second.x, positions.second.y, secondRadius + 7);
        graphics.fill();
        graphics.fillColor = RED;
        graphics.circle(positions.second.x, positions.second.y, secondRadius);
        graphics.fill();
    }

    private drawSeparation(graphics: Graphics, primary: Point, companion: Point): void {
        const dx = companion.x - primary.x;
        const dy = companion.y - primary.y;
        const length = Math.hypot(dx, dy);
        if (length < 2) {
            return;
        }
        const segments = Math.max(1, Math.floor(length / 10));
        for (let index = 0; index < segments; index += 2) {
            const start = index / segments;
            const end = Math.min(1, (index + 1) / segments);
            this.line(
                graphics,
                { x: primary.x + dx * start, y: primary.y + dy * start },
                { x: primary.x + dx * end, y: primary.y + dy * end },
                CYAN_SOFT,
                1,
            );
        }
    }

    private drawDivergenceGauge(graphics: Graphics, divergence: number, totalLength: number): void {
        const left = -this.plotWidth / 2 + 22;
        const top = this.plotHeight / 2 - 116;
        const width = Math.min(142, this.plotWidth * 0.30);
        const progress = Math.min(1, divergence / Math.max(0.001, totalLength));
        graphics.fillColor = TRACK_SOFT;
        graphics.fillRect(left, top, width, 4);
        graphics.fillColor = CYAN;
        graphics.fillRect(left, top, width * progress, 4);
        graphics.strokeColor = TRACK_SOFT;
        graphics.lineWidth = 1;
        for (let index = 0; index <= 4; index += 1) {
            const x = left + width * index / 4;
            graphics.moveTo(x, top - 4);
            graphics.lineTo(x, top + 8);
        }
        graphics.stroke();
    }

    private drawMeasurementRuler(graphics: Graphics): void {
        const x = this.plotWidth / 2 - 18;
        const bottom = -this.plotHeight * 0.30;
        const top = this.plotHeight * 0.24;
        graphics.strokeColor = TRACK_SOFT;
        graphics.lineWidth = 1;
        graphics.moveTo(x, bottom);
        graphics.lineTo(x, top);
        for (let index = 0; index <= 8; index += 1) {
            const y = bottom + (top - bottom) * index / 8;
            graphics.moveTo(x - (index % 2 === 0 ? 9 : 5), y);
            graphics.lineTo(x, y);
        }
        graphics.stroke();
    }

    private line(
        graphics: Graphics,
        from: Point,
        to: Point,
        color: Color,
        width: number,
    ): void {
        graphics.strokeColor = color;
        graphics.lineWidth = width;
        graphics.moveTo(from.x, from.y);
        graphics.lineTo(to.x, to.y);
        graphics.stroke();
    }
}
