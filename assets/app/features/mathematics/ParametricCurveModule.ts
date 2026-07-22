import {
    Color,
    Graphics,
    HorizontalTextAlignment,
    Node,
} from 'cc';
import type {
    InteractiveModule,
    ModuleContext,
    ModuleDefinition,
    Pausable,
    Resettable,
    Updatable,
} from '../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../services/ViewportService';
import {
    clearNode,
    createButton,
    createLabel,
    createPill,
    createUiNode,
    fillNode,
    palette,
    strokeNode,
} from '../../ui/UiFactory';

interface CurveSettings {
    frequencyX: number;
    frequencyY: number;
    phase: number;
}

const defaultSettings: CurveSettings = {
    frequencyX: 3,
    frequencyY: 2,
    phase: 0.65,
};

class ParametricCurveModule implements InteractiveModule, Updatable, Pausable, Resettable {
    private root: Node | null = null;
    private context: ModuleContext | null = null;
    private curveGraphics: Graphics | null = null;
    private unsubscribeViewport: (() => void) | null = null;
    private settings: CurveSettings = { ...defaultSettings };
    private elapsed = 0;
    private paused = false;
    private plotWidth = 1;
    private plotHeight = 1;

    mount(context: ModuleContext): void {
        this.context = context;
        this.settings = context.storage.get<CurveSettings>(
            'module:parametric-curve:settings',
            { ...defaultSettings },
        );

        const viewport = context.viewport.current;
        this.root = createUiNode(context.host, 'ParametricCurveLab', viewport.width, viewport.height);
        this.unsubscribeViewport = context.viewport.subscribe((snapshot) => {
            this.renderLayout(snapshot);
        });
    }

    update(dt: number): void {
        if (this.paused) {
            return;
        }

        this.elapsed += dt * 0.55;
        this.drawCurve();
    }

    pause(): void {
        this.paused = true;
    }

    resume(): void {
        this.paused = false;
    }

    reset(): void {
        this.settings = { ...defaultSettings };
        this.elapsed = 0;
        this.persistSettings();

        if (this.context) {
            this.renderLayout(this.context.viewport.current);
        }
    }

    unmount(): void {
        this.unsubscribeViewport?.();
        this.unsubscribeViewport = null;
        this.curveGraphics = null;
        this.root?.destroy();
        this.root = null;
        this.context = null;
    }

    private renderLayout(viewport: ViewportSnapshot): void {
        const root = this.root;

        if (!root) {
            return;
        }

        clearNode(root);
        root.setPosition(0, 0, 0);
        fillNode(root, viewport.width, viewport.height, palette.background);

        const compact = viewport.breakpoint === 'compact';
        const horizontalPadding = compact ? 18 : 44;
        const topInset = viewport.safeInsets.top + (compact ? 82 : 96);
        const bottomInset = viewport.safeInsets.bottom + (compact ? 176 : 142);
        const contentWidth = viewport.width
            - viewport.safeInsets.left
            - viewport.safeInsets.right
            - horizontalPadding * 2;
        const plotTop = viewport.height / 2 - topInset;
        const plotBottom = -viewport.height / 2 + bottomInset;
        this.plotWidth = Math.max(240, contentWidth);
        this.plotHeight = Math.max(180, plotTop - plotBottom);
        const plotCenterY = (plotTop + plotBottom) / 2;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;

        const plot = createUiNode(
            root,
            'CurvePlot',
            this.plotWidth,
            this.plotHeight,
            centerX,
            plotCenterY,
        );
        fillNode(plot, this.plotWidth, this.plotHeight, palette.surfaceSoft, 20);
        strokeNode(plot, this.plotWidth, this.plotHeight, palette.border, 20, 1.5);
        this.drawGrid(plot);

        const curveNode = createUiNode(plot, 'Curve', this.plotWidth, this.plotHeight);
        this.curveGraphics = curveNode.addComponent(Graphics);
        this.drawCurve();

        createPill(
            root,
            `${this.settings.frequencyX}:${this.settings.frequencyY}`,
            compact ? 78 : 90,
            centerX - this.plotWidth / 2 + (compact ? 47 : 54),
            plotTop - 26,
            true,
        );

        createLabel(
            root,
            'Lissajous field · x = sin(at + φ), y = sin(bt)',
            Math.min(this.plotWidth - 120, 520),
            30,
            compact ? 13 : 15,
            palette.muted,
            centerX + (compact ? 42 : 72),
            plotTop - 26,
            HorizontalTextAlignment.LEFT,
        );

        this.renderControls(root, viewport, centerX);
    }

    private renderControls(root: Node, viewport: ViewportSnapshot, centerX: number): void {
        const compact = viewport.breakpoint === 'compact';
        const panelWidth = Math.min(
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right - 24,
            compact ? 620 : 880,
        );
        const panelHeight = compact ? 142 : 104;
        const panelY = -viewport.height / 2
            + viewport.safeInsets.bottom
            + panelHeight / 2
            + 14;
        const panel = createUiNode(root, 'CurveControls', panelWidth, panelHeight, centerX, panelY);
        fillNode(panel, panelWidth, panelHeight, palette.surface, 18);

        if (compact) {
            this.renderCompactControls(panel, panelWidth);
        } else {
            this.renderWideControls(panel, panelWidth);
        }
    }

    private renderWideControls(panel: Node, panelWidth: number): void {
        const groups = [
            {
                label: `X FREQ  ${this.settings.frequencyX}`,
                x: -panelWidth * 0.31,
                decrease: () => this.adjust('frequencyX', -1),
                increase: () => this.adjust('frequencyX', 1),
            },
            {
                label: `Y FREQ  ${this.settings.frequencyY}`,
                x: 0,
                decrease: () => this.adjust('frequencyY', -1),
                increase: () => this.adjust('frequencyY', 1),
            },
            {
                label: `PHASE  ${this.settings.phase.toFixed(2)}`,
                x: panelWidth * 0.31,
                decrease: () => this.adjust('phase', -0.1),
                increase: () => this.adjust('phase', 0.1),
            },
        ];

        for (const group of groups) {
            createLabel(panel, group.label, 180, 30, 14, palette.muted, group.x, 27);
            createButton(panel, {
                name: `${group.label}:decrease`,
                text: '−',
                width: 54,
                height: 42,
                x: group.x - 34,
                y: -20,
                variant: 'secondary',
                fontSize: 24,
                onPress: group.decrease,
            });
            createButton(panel, {
                name: `${group.label}:increase`,
                text: '+',
                width: 54,
                height: 42,
                x: group.x + 34,
                y: -20,
                variant: 'primary',
                fontSize: 22,
                onPress: group.increase,
            });
        }
    }

    private renderCompactControls(panel: Node, panelWidth: number): void {
        const rowY = [38, -38];
        const columnX = [-panelWidth * 0.27, 0, panelWidth * 0.27];
        const controls = [
            {
                label: `X ${this.settings.frequencyX}`,
                decrease: () => this.adjust('frequencyX', -1),
                increase: () => this.adjust('frequencyX', 1),
            },
            {
                label: `Y ${this.settings.frequencyY}`,
                decrease: () => this.adjust('frequencyY', -1),
                increase: () => this.adjust('frequencyY', 1),
            },
            {
                label: `φ ${this.settings.phase.toFixed(1)}`,
                decrease: () => this.adjust('phase', -0.1),
                increase: () => this.adjust('phase', 0.1),
            },
        ];

        for (let index = 0; index < controls.length; index += 1) {
            const control = controls[index];
            const x = columnX[index];
            createLabel(panel, control.label, 92, 28, 14, palette.muted, x, rowY[0]);
            createButton(panel, {
                name: `${control.label}:decrease`,
                text: '−',
                width: 42,
                height: 38,
                x: x - 26,
                y: rowY[1],
                variant: 'secondary',
                fontSize: 21,
                onPress: control.decrease,
            });
            createButton(panel, {
                name: `${control.label}:increase`,
                text: '+',
                width: 42,
                height: 38,
                x: x + 26,
                y: rowY[1],
                fontSize: 19,
                onPress: control.increase,
            });
        }
    }

    private adjust(key: keyof CurveSettings, delta: number): void {
        if (key === 'phase') {
            this.settings.phase = Math.max(0, Math.min(Math.PI, this.settings.phase + delta));
        } else {
            this.settings[key] = Math.max(1, Math.min(9, Math.round(this.settings[key] + delta)));
        }

        this.persistSettings();

        if (this.context) {
            this.renderLayout(this.context.viewport.current);
        }
    }

    private persistSettings(): void {
        this.context?.storage.set('module:parametric-curve:settings', this.settings);
    }

    private drawGrid(plot: Node): void {
        const gridNode = createUiNode(plot, 'CurveGrid', this.plotWidth, this.plotHeight);
        const graphics = gridNode.addComponent(Graphics);
        graphics.lineWidth = 1;
        graphics.strokeColor = new Color(72, 89, 120, 80);

        const verticalSteps = 10;
        const horizontalSteps = 8;

        for (let index = 1; index < verticalSteps; index += 1) {
            const x = -this.plotWidth / 2 + (this.plotWidth * index) / verticalSteps;
            graphics.moveTo(x, -this.plotHeight / 2);
            graphics.lineTo(x, this.plotHeight / 2);
        }

        for (let index = 1; index < horizontalSteps; index += 1) {
            const y = -this.plotHeight / 2 + (this.plotHeight * index) / horizontalSteps;
            graphics.moveTo(-this.plotWidth / 2, y);
            graphics.lineTo(this.plotWidth / 2, y);
        }

        graphics.stroke();
        graphics.lineWidth = 1.5;
        graphics.strokeColor = new Color(110, 129, 161, 130);
        graphics.moveTo(-this.plotWidth / 2, 0);
        graphics.lineTo(this.plotWidth / 2, 0);
        graphics.moveTo(0, -this.plotHeight / 2);
        graphics.lineTo(0, this.plotHeight / 2);
        graphics.stroke();
    }

    private drawCurve(): void {
        const graphics = this.curveGraphics;

        if (!graphics) {
            return;
        }

        graphics.clear();
        const scaleX = this.plotWidth * 0.42;
        const scaleY = this.plotHeight * 0.40;
        const sampleCount = Math.max(320, Math.round(this.plotWidth * 0.72));

        for (let trail = 3; trail >= 0; trail -= 1) {
            const alpha = 52 + (3 - trail) * 54;
            graphics.strokeColor = trail === 0
                ? new Color(54, 221, 184, 255)
                : new Color(255, 92, 142, alpha);
            graphics.lineWidth = trail === 0 ? 3 : 1.5;
            const phase = this.settings.phase + this.elapsed - trail * 0.07;

            for (let index = 0; index <= sampleCount; index += 1) {
                const t = (Math.PI * 2 * index) / sampleCount;
                const x = Math.sin(this.settings.frequencyX * t + phase) * scaleX;
                const y = Math.sin(this.settings.frequencyY * t) * scaleY;

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
            this.settings.frequencyX * markerT + this.settings.phase + this.elapsed,
        ) * scaleX;
        const markerY = Math.sin(this.settings.frequencyY * markerT) * scaleY;
        graphics.fillColor = palette.warning;
        graphics.circle(markerX, markerY, 6);
        graphics.fill();
    }
}

export const parametricCurveDefinition: ModuleDefinition = {
    id: 'parametric-curve-lab',
    title: 'Parametric Curve Lab',
    description: 'Animate and tune a code-generated Lissajous field in real time.',
    category: 'mathematics',
    tags: ['curves', 'graphics', 'animation'],
    capabilities: ['pause', 'reset', 'settings', 'save-state'],
    status: 'ready',
    order: 10,
    create: () => new ParametricCurveModule(),
};
