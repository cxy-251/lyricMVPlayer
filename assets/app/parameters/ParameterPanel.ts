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
    createIconButton,
    createLabel,
    createNativeSlider,
    createNativeToggle,
    createUiNode,
    fillNode,
    nativeTheme,
    resizeNode,
    strokeNode,
} from '../ui/UiFactory';
import type { ParameterController } from './ParameterController';
import type {
    NumberParameter,
    ParameterDefinition,
    ParameterSchema,
} from './ParameterSchema';

const DEFAULT_ROW_HEIGHT = 78;
const DETAILED_ROW_HEIGHT = 162;
const DETAILED_SCHEMA_ITEM_COUNT = 10;
const DESCRIPTION_THRESHOLD = 112;

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
        private readonly onError: (error: unknown) => void = (error) => {
            throw error;
        },
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
        const radius = Math.min(18, layout.width / 2, metrics.height / 2);
        fillNode(this.root, layout.width, metrics.height, nativeTheme.sand, radius);
        strokeNode(this.root, layout.width, metrics.height, nativeTheme.border, radius, 1);

        const start = this.page * metrics.pageSize;
        const visible = this.schema.slice(start, start + metrics.pageSize);
        const contentHeight = metrics.height - metrics.pagerHeight;
        const contentWidth = Math.max(1, layout.width - 24);
        const content = createUiNode(
            this.root,
            'ParameterGrid',
            contentWidth,
            Math.max(1, contentHeight - 8),
            0,
            metrics.pagerHeight / 2 + 2,
        );
        const cellWidth = contentWidth / metrics.columns;
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
            this.renderControl(
                content,
                definition,
                Math.max(1, cellWidth - 12),
                Math.max(1, metrics.rowHeight - 8),
            );
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
        const detailed = height >= DESCRIPTION_THRESHOLD;
        const labelY = detailed ? height / 2 - 22 : height / 2 - 18;
        createLabel(
            group,
            definition.label,
            Math.max(1, width * 0.58),
            24,
            11,
            nativeTheme.muted,
            -width * 0.21,
            labelY,
            HorizontalTextAlignment.LEFT,
        );
        const valueNode = createLabel(
            group,
            this.controller.format(definition),
            Math.max(1, width * 0.4),
            24,
            12,
            nativeTheme.ink,
            width * 0.28,
            labelY,
            HorizontalTextAlignment.RIGHT,
        );
        const valueLabel = valueNode.getComponent(Label);
        this.renderDescription(group, definition.description, width, height);
        const range = Math.max(definition.step, definition.maximum - definition.minimum);
        const initialProgress = (this.controller.getNumber(definition.key) - definition.minimum) / range;

        createNativeSlider(group, {
            name: `${definition.key}:slider`,
            width: Math.max(44, width - 6),
            progress: initialProgress,
            y: detailed ? -height / 2 + 29 : -height * 0.19,
            onChange: (progress) => {
                this.guard(() => {
                    const next = this.valueFromProgress(definition, progress);

                    if (!this.controller.set(definition.key, next)) {
                        return;
                    }

                    if (valueLabel) {
                        valueLabel.string = this.controller.format(definition);
                    }
                    this.onChange(definition.key);
                });
            },
        });
    }

    private renderToggle(
        group: Node,
        definition: ParameterDefinition & { readonly kind: 'toggle' },
        width: number,
        height: number,
    ): void {
        const detailed = height >= DESCRIPTION_THRESHOLD;
        const controlY = detailed ? height / 2 - 24 : 0;
        createLabel(
            group,
            definition.label,
            Math.max(1, width - 74),
            32,
            11,
            nativeTheme.muted,
            -28,
            controlY,
            HorizontalTextAlignment.LEFT,
        );
        this.renderDescription(group, definition.description, width, height);
        createNativeToggle(group, {
            name: `${definition.key}:toggle`,
            checked: this.controller.getBoolean(definition.key),
            x: width / 2 - 30,
            y: controlY,
            onChange: (checked) => {
                this.guard(() => {
                    if (!this.controller.set(definition.key, checked)) {
                        return;
                    }

                    this.onChange(definition.key);
                });
            },
        });
    }

    private renderSelect(
        group: Node,
        definition: ParameterDefinition & { readonly kind: 'select' },
        width: number,
        height: number,
    ): void {
        const detailed = height >= DESCRIPTION_THRESHOLD;
        const labelY = detailed ? height / 2 - 22 : height / 2 - 18;
        const selectorY = detailed ? -height / 2 + 31 : -height * 0.2;
        createLabel(
            group,
            definition.label,
            Math.max(1, width - 8),
            22,
            11,
            nativeTheme.muted,
            0,
            labelY,
        );
        this.renderDescription(group, definition.description, width, height);
        const valueWidth = Math.max(36, width - 100);

        createIconButton(group, {
            name: `${definition.key}:previous`,
            icon: 'chevron-left',
            x: -valueWidth / 2 - 26,
            y: selectorY,
            onPress: () => this.guard(() => this.change(
                definition.key,
                () => this.controller.cycle(definition.key, -1),
            )),
        });
        createLabel(
            group,
            this.controller.format(definition),
            valueWidth,
            36,
            12,
            nativeTheme.ink,
            0,
            selectorY,
        );
        createIconButton(group, {
            name: `${definition.key}:next`,
            icon: 'chevron-right',
            x: valueWidth / 2 + 26,
            y: selectorY,
            onPress: () => this.guard(() => this.change(
                definition.key,
                () => this.controller.cycle(definition.key, 1),
            )),
        });
    }

    private renderDescription(
        parent: Node,
        description: string | undefined,
        width: number,
        height: number,
    ): void {
        if (!description || height < DESCRIPTION_THRESHOLD) {
            return;
        }
        const node = createLabel(
            parent,
            description,
            Math.max(1, width - 8),
            Math.max(32, height - 84),
            9,
            nativeTheme.muted,
            0,
            3,
            HorizontalTextAlignment.LEFT,
        );
        const label = node.getComponent(Label);
        if (label) {
            label.lineHeight = 13;
            label.enableWrapText = true;
        }
    }

    private renderPager(metrics: PanelMetrics, width: number): void {
        const y = -metrics.height / 2 + metrics.pagerHeight / 2 + 3;

        createIconButton(this.root, {
            name: 'ParameterPagePrevious',
            icon: 'chevron-left',
            x: -54,
            y,
            onPress: () => this.guard(() => {
                this.page = (this.page - 1 + metrics.pageCount) % metrics.pageCount;
                this.renderCurrent();
            }),
        });
        createLabel(
            this.root,
            `${this.page + 1} / ${metrics.pageCount}`,
            58,
            30,
            11,
            nativeTheme.muted,
            0,
            y,
        );
        createIconButton(this.root, {
            name: 'ParameterPageNext',
            icon: 'chevron-right',
            x: 54,
            y,
            onPress: () => this.guard(() => {
                this.page = (this.page + 1) % metrics.pageCount;
                this.renderCurrent();
            }),
        });

        createLabel(
            this.root,
            'PARAMETERS',
            Math.max(1, Math.min(120, width - 24)),
            28,
            10,
            nativeTheme.muted,
            -width / 2 + Math.min(72, width / 2),
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

    private change(key: string, action: () => boolean): void {
        if (!action()) {
            return;
        }

        this.onChange(key);
        this.renderCurrent();
    }

    private renderCurrent(): void {
        if (this.layout) {
            this.render(this.layout);
        }
    }

    private guard(action: () => void): void {
        try {
            action();
        } catch (error) {
            this.onError(error);
        }
    }

    private static measure(
        itemCount: number,
        width: number,
        breakpoint: ViewportBreakpoint,
    ): PanelMetrics {
        const columns = breakpoint === 'compact'
            ? width < 420 ? 1 : 2
            : width < 980
                ? 3
                : 4;
        const maximumRows = 2;
        const pageSize = columns * maximumRows;
        const pageCount = Math.max(1, Math.ceil(itemCount / pageSize));
        const visibleCount = Math.min(itemCount, pageSize);
        const rows = Math.max(1, Math.ceil(visibleCount / columns));
        const rowHeight = itemCount === DETAILED_SCHEMA_ITEM_COUNT
            ? DETAILED_ROW_HEIGHT
            : DEFAULT_ROW_HEIGHT;
        const pagerHeight = pageCount > 1 ? 44 : 12;

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
