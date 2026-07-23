import {
    HorizontalTextAlignment,
    Label,
    Layout,
    Node,
    Size,
} from 'cc';
import type { ViewportBreakpoint } from '../services/ViewportService';
import {
    clearNode,
    createButton,
    createLabel,
    createSlider,
    createToggle,
    createUiNode,
    fillNode,
    palette,
    resizeNode,
    strokeNode,
} from '../ui/UiFactory';
import type { ParameterController } from './ParameterController';
import type {
    NumberParameter,
    ParameterDefinition,
    ParameterSchema,
} from './ParameterSchema';

export interface ParameterPanelLayout {
    readonly width: number;
    readonly x: number;
    readonly y: number;
    readonly breakpoint: ViewportBreakpoint;
}

interface PanelMetrics {
    readonly columns: number;
    readonly rows: number;
    readonly pageSize: number;
    readonly pageCount: number;
    readonly height: number;
    readonly rowHeight: number;
    readonly pagerHeight: number;
}

export class ParameterPanel {
    private readonly root: Node;
    private page = 0;
    private layout: ParameterPanelLayout | null = null;

    constructor(
        parent: Node,
        private readonly schema: ParameterSchema,
        private readonly controller: ParameterController,
        private readonly onChange: (key: string) => void,
    ) {
        this.root = createUiNode(parent, 'ParameterPanel', 1, 1);
    }

    static measureHeight(
        itemCount: number,
        width: number,
        breakpoint: ViewportBreakpoint,
    ): number {
        return this.measure(itemCount, width, breakpoint).height;
    }

    render(layout: ParameterPanelLayout): void {
        this.layout = layout;
        const metrics = ParameterPanel.measure(
            this.schema.length,
            layout.width,
            layout.breakpoint,
        );
        this.page = Math.min(this.page, metrics.pageCount - 1);

        clearNode(this.root);
        resizeNode(this.root, layout.width, metrics.height);
        this.root.setPosition(layout.x, layout.y, 0);
        fillNode(this.root, layout.width, metrics.height, palette.surfaceSoft, 16);
        strokeNode(this.root, layout.width, metrics.height, palette.border, 16, 1);

        const start = this.page * metrics.pageSize;
        const visible = this.schema.slice(start, start + metrics.pageSize);
        const contentHeight = metrics.height - metrics.pagerHeight;
        const content = createUiNode(
            this.root,
            'ParameterGrid',
            layout.width - 24,
            contentHeight - 8,
            0,
            metrics.pagerHeight / 2 + 2,
        );
        const cellWidth = (layout.width - 24) / metrics.columns;
        const grid = content.addComponent(Layout);
        grid.type = Layout.Type.GRID;
        grid.resizeMode = Layout.ResizeMode.NONE;
        grid.startAxis = Layout.AxisDirection.HORIZONTAL;
        grid.constraint = Layout.Constraint.FIXED_COL;
        grid.constraintNum = metrics.columns;
        grid.cellSize = new Size(cellWidth, metrics.rowHeight);
        grid.spacingX = 0;
        grid.spacingY = 0;
        grid.padding = 0;

        for (const definition of visible) {
            this.renderControl(content, definition, cellWidth - 12, metrics.rowHeight - 8);
        }

        grid.updateLayout(true);

        if (metrics.pageCount > 1) {
            this.renderPager(metrics, layout.width);
        }
    }

    destroy(): void {
        this.root.destroy();
        this.layout = null;
    }

    private renderControl(
        parent: Node,
        definition: ParameterDefinition,
        width: number,
        height: number,
    ): void {
        const group = createUiNode(parent, `Parameter:${definition.key}`, width, height);

        if (definition.kind === 'number') {
            this.renderNumber(group, definition, width, height);
        } else if (definition.kind === 'toggle') {
            this.renderToggle(group, definition, width, height);
        } else {
            this.renderSelect(group, definition, width, height);
        }
    }

    private renderNumber(
        group: Node,
        definition: NumberParameter,
        width: number,
        height: number,
    ): void {
        const labelY = height / 2 - 18;
        createLabel(
            group,
            definition.label,
            width * 0.58,
            24,
            11,
            palette.subtle,
            -width * 0.21,
            labelY,
            HorizontalTextAlignment.LEFT,
        );
        const valueNode = createLabel(
            group,
            this.controller.format(definition),
            width * 0.4,
            24,
            12,
            palette.text,
            width * 0.28,
            labelY,
            HorizontalTextAlignment.RIGHT,
        );
        const valueLabel = valueNode.getComponent(Label);
        const range = Math.max(definition.step, definition.maximum - definition.minimum);
        const initialProgress = (this.controller.getNumber(definition.key) - definition.minimum) / range;

        createSlider(group, {
            name: `${definition.key}:slider`,
            width: Math.max(80, width - 6),
            progress: initialProgress,
            y: -height * 0.19,
            onChange: (progress) => {
                const next = this.valueFromProgress(definition, progress);

                if (!this.controller.set(definition.key, next)) {
                    return;
                }

                if (valueLabel) {
                    valueLabel.string = this.controller.format(definition);
                }
                this.onChange(definition.key);
            },
        });
    }

    private renderToggle(
        group: Node,
        definition: ParameterDefinition & { readonly kind: 'toggle' },
        width: number,
        _height: number,
    ): void {
        createLabel(
            group,
            definition.label,
            width - 74,
            32,
            11,
            palette.subtle,
            -28,
            0,
            HorizontalTextAlignment.LEFT,
        );
        createToggle(group, {
            name: `${definition.key}:toggle`,
            checked: this.controller.getBoolean(definition.key),
            x: width / 2 - 30,
            onChange: (checked) => {
                if (!this.controller.set(definition.key, checked)) {
                    return;
                }

                this.onChange(definition.key);
            },
        });
    }

    private renderSelect(
        group: Node,
        definition: ParameterDefinition & { readonly kind: 'select' },
        width: number,
        height: number,
    ): void {
        const labelY = height / 2 - 18;
        createLabel(
            group,
            definition.label,
            width - 8,
            22,
            11,
            palette.subtle,
            0,
            labelY,
        );
        const valueWidth = Math.max(58, width - 92);

        createButton(group, {
            name: `${definition.key}:previous`,
            text: '‹',
            width: 36,
            height: 36,
            x: -valueWidth / 2 - 24,
            y: -height * 0.2,
            variant: 'ghost',
            shape: 'circle',
            fontSize: 20,
            onPress: () => this.change(definition.key, () => {
                this.controller.cycle(definition.key, -1);
            }),
        });
        createLabel(
            group,
            this.controller.format(definition),
            valueWidth,
            36,
            12,
            palette.text,
            0,
            -height * 0.2,
        );
        createButton(group, {
            name: `${definition.key}:next`,
            text: '›',
            width: 36,
            height: 36,
            x: valueWidth / 2 + 24,
            y: -height * 0.2,
            variant: 'ghost',
            shape: 'circle',
            fontSize: 20,
            onPress: () => this.change(definition.key, () => {
                this.controller.cycle(definition.key, 1);
            }),
        });
    }

    private renderPager(metrics: PanelMetrics, width: number): void {
        const y = -metrics.height / 2 + metrics.pagerHeight / 2 + 3;

        createButton(this.root, {
            name: 'ParameterPagePrevious',
            text: '←',
            width: 34,
            height: 34,
            x: -52,
            y,
            variant: 'ghost',
            shape: 'circle',
            fontSize: 14,
            onPress: () => {
                this.page = (this.page - 1 + metrics.pageCount) % metrics.pageCount;
                this.renderCurrent();
            },
        });
        createLabel(
            this.root,
            `${this.page + 1} / ${metrics.pageCount}`,
            58,
            30,
            11,
            palette.muted,
            0,
            y,
        );
        createButton(this.root, {
            name: 'ParameterPageNext',
            text: '→',
            width: 34,
            height: 34,
            x: 52,
            y,
            variant: 'ghost',
            shape: 'circle',
            fontSize: 14,
            onPress: () => {
                this.page = (this.page + 1) % metrics.pageCount;
                this.renderCurrent();
            },
        });

        createLabel(
            this.root,
            'PARAMETERS',
            120,
            28,
            10,
            palette.subtle,
            -width / 2 + 72,
            y,
            HorizontalTextAlignment.LEFT,
        );
    }

    private valueFromProgress(definition: NumberParameter, progress: number): number {
        const stepCount = Math.max(
            1,
            Math.round((definition.maximum - definition.minimum) / definition.step),
        );
        const stepIndex = Math.round(Math.max(0, Math.min(1, progress)) * stepCount);
        return definition.minimum + stepIndex * definition.step;
    }

    private change(key: string, action: () => void): void {
        action();
        this.onChange(key);
        this.renderCurrent();
    }

    private renderCurrent(): void {
        if (this.layout) {
            this.render(this.layout);
        }
    }

    private static measure(
        itemCount: number,
        width: number,
        breakpoint: ViewportBreakpoint,
    ): PanelMetrics {
        const columns = breakpoint === 'compact'
            ? 2
            : width < 980
                ? 3
                : 4;
        const maximumRows = 2;
        const pageSize = columns * maximumRows;
        const pageCount = Math.max(1, Math.ceil(itemCount / pageSize));
        const visibleCount = Math.min(itemCount, pageSize);
        const rows = Math.max(1, Math.ceil(visibleCount / columns));
        const rowHeight = 78;
        const pagerHeight = pageCount > 1 ? 40 : 12;

        return {
            columns,
            rows,
            pageSize,
            pageCount,
            rowHeight,
            pagerHeight,
            height: rows * rowHeight + pagerHeight + 14,
        };
    }
}
