import { HorizontalTextAlignment, Node } from 'cc';
import type { ViewportBreakpoint } from '../services/ViewportService';
import {
    clearNode,
    createButton,
    createLabel,
    createUiNode,
    fillNode,
    palette,
    resizeNode,
    strokeNode,
} from '../ui/UiFactory';
import type { ParameterController } from './ParameterController';
import type {
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
        fillNode(this.root, layout.width, metrics.height, palette.surface, 18);
        strokeNode(this.root, layout.width, metrics.height, palette.border, 18, 1.25);

        const start = this.page * metrics.pageSize;
        const visible = this.schema.slice(start, start + metrics.pageSize);
        const contentHeight = metrics.height - metrics.pagerHeight;
        const cellWidth = (layout.width - 24) / metrics.columns;
        const top = contentHeight / 2 - metrics.rowHeight / 2;

        for (let index = 0; index < visible.length; index += 1) {
            const row = Math.floor(index / metrics.columns);
            const column = index % metrics.columns;
            const x = -layout.width / 2 + 12 + cellWidth * (column + 0.5);
            const y = top - row * metrics.rowHeight + metrics.pagerHeight / 2;
            this.renderControl(visible[index], cellWidth - 10, x, y);
        }

        if (metrics.pageCount > 1) {
            this.renderPager(metrics, layout.width);
        }
    }

    destroy(): void {
        this.root.destroy();
        this.layout = null;
    }

    private renderControl(
        definition: ParameterDefinition,
        width: number,
        x: number,
        y: number,
    ): void {
        const group = createUiNode(this.root, `Parameter:${definition.key}`, width, 60, x, y);
        createLabel(
            group,
            definition.label.toUpperCase(),
            width - 8,
            22,
            11,
            palette.subtle,
            0,
            19,
            HorizontalTextAlignment.CENTER,
        );

        if (definition.kind === 'number') {
            this.renderNumber(group, definition, width);
        } else if (definition.kind === 'toggle') {
            this.renderToggle(group, definition, width);
        } else {
            this.renderSelect(group, definition, width);
        }
    }

    private renderNumber(
        group: Node,
        definition: ParameterDefinition & { readonly kind: 'number' },
        width: number,
    ): void {
        const buttonWidth = Math.min(38, Math.max(32, width * 0.22));
        const valueWidth = Math.max(48, width - buttonWidth * 2 - 12);

        createButton(group, {
            name: `${definition.key}:decrease`,
            text: '−',
            width: buttonWidth,
            height: 32,
            x: -valueWidth / 2 - buttonWidth / 2 - 4,
            y: -12,
            variant: 'secondary',
            fontSize: 20,
            onPress: () => this.change(definition.key, () => {
                this.controller.adjust(definition.key, -1);
            }),
        });
        createLabel(
            group,
            this.controller.format(definition),
            valueWidth,
            32,
            14,
            palette.text,
            0,
            -12,
        );
        createButton(group, {
            name: `${definition.key}:increase`,
            text: '+',
            width: buttonWidth,
            height: 32,
            x: valueWidth / 2 + buttonWidth / 2 + 4,
            y: -12,
            fontSize: 18,
            onPress: () => this.change(definition.key, () => {
                this.controller.adjust(definition.key, 1);
            }),
        });
    }

    private renderToggle(
        group: Node,
        definition: ParameterDefinition & { readonly kind: 'toggle' },
        width: number,
    ): void {
        createButton(group, {
            name: `${definition.key}:toggle`,
            text: this.controller.format(definition),
            width: Math.min(112, width - 18),
            height: 32,
            y: -12,
            variant: this.controller.getBoolean(definition.key) ? 'primary' : 'secondary',
            fontSize: 13,
            onPress: () => this.change(definition.key, () => {
                this.controller.toggle(definition.key);
            }),
        });
    }

    private renderSelect(
        group: Node,
        definition: ParameterDefinition & { readonly kind: 'select' },
        width: number,
    ): void {
        const buttonWidth = 34;
        const valueWidth = Math.max(58, width - buttonWidth * 2 - 12);

        createButton(group, {
            name: `${definition.key}:previous`,
            text: '‹',
            width: buttonWidth,
            height: 32,
            x: -valueWidth / 2 - buttonWidth / 2 - 4,
            y: -12,
            variant: 'secondary',
            fontSize: 20,
            onPress: () => this.change(definition.key, () => {
                this.controller.cycle(definition.key, -1);
            }),
        });
        createLabel(
            group,
            this.controller.format(definition).toUpperCase(),
            valueWidth,
            32,
            12,
            palette.text,
            0,
            -12,
        );
        createButton(group, {
            name: `${definition.key}:next`,
            text: '›',
            width: buttonWidth,
            height: 32,
            x: valueWidth / 2 + buttonWidth / 2 + 4,
            y: -12,
            variant: 'secondary',
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
            width: 44,
            height: 30,
            x: -58,
            y,
            variant: 'ghost',
            fontSize: 15,
            onPress: () => {
                this.page = (this.page - 1 + metrics.pageCount) % metrics.pageCount;
                this.renderCurrent();
            },
        });
        createLabel(
            this.root,
            `${this.page + 1} / ${metrics.pageCount}`,
            64,
            30,
            12,
            palette.muted,
            0,
            y,
        );
        createButton(this.root, {
            name: 'ParameterPageNext',
            text: '→',
            width: 44,
            height: 30,
            x: 58,
            y,
            variant: 'ghost',
            fontSize: 15,
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
        const rowHeight = 68;
        const pagerHeight = pageCount > 1 ? 38 : 12;

        return {
            columns,
            rows,
            pageSize,
            pageCount,
            rowHeight,
            pagerHeight,
            height: rows * rowHeight + pagerHeight + 12,
        };
    }
}
