import { Node } from 'cc';
import type { ViewportBreakpoint } from '../services/ViewportService';
import { createUiNode } from '../ui/UiFactory';
import { createLibraryIconButton } from '../ui/WebIcons';
import {
    applyRect,
    clearWebUiScope,
    cocosRectToCss,
    getWebUiScope,
} from '../ui/WebUiKit';
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

const PARAMETER_SCOPE = 'parameters';

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
        const parent = getWebUiScope(PARAMETER_SCOPE);

        if (!parent) {
            return;
        }

        const card = document.createElement('wa-card') as HTMLElement;
        card.className = 'cocoslab-parameter-card';
        card.setAttribute('appearance', 'filled-outlined');
        applyRect(card, cocosRectToCss(layout.x, layout.y, layout.width, metrics.height));

        const grid = document.createElement('div');
        grid.className = 'cocoslab-parameter-grid';
        grid.style.gridTemplateColumns = `repeat(${metrics.columns}, minmax(0, 1fr))`;

        const start = this.page * metrics.pageSize;
        const visible = this.schema.slice(start, start + metrics.pageSize);

        for (const definition of visible) {
            grid.appendChild(this.renderControl(definition));
        }

        card.appendChild(grid);

        if (metrics.pageCount > 1) {
            card.appendChild(this.renderPager(metrics.pageCount));
        }

        parent.appendChild(card);
    }

    destroy(): void {
        clearWebUiScope(PARAMETER_SCOPE);
        this.root.destroy();
        this.layout = null;
    }

    private renderControl(definition: ParameterDefinition): HTMLElement {
        const group = document.createElement('div');
        group.className = 'cocoslab-parameter-control';

        if (definition.kind === 'number') {
            this.renderNumber(group, definition);
        } else if (definition.kind === 'toggle') {
            this.renderToggle(group, definition);
        } else {
            this.renderSelect(group, definition);
        }

        return group;
    }

    private renderNumber(group: HTMLElement, definition: NumberParameter): void {
        const header = document.createElement('div');
        header.className = 'cocoslab-parameter-header';
        const label = document.createElement('span');
        label.textContent = definition.label;
        const value = document.createElement('span');
        value.className = 'cocoslab-parameter-value';
        value.textContent = this.controller.format(definition);
        header.append(label, value);

        const slider = document.createElement('wa-slider') as HTMLElement & {
            value: number;
            min: number;
            max: number;
            step: number;
        };
        slider.setAttribute('aria-label', definition.label);
        slider.setAttribute('size', 's');
        slider.min = definition.minimum;
        slider.max = definition.maximum;
        slider.step = definition.step;
        slider.value = this.controller.getNumber(definition.key);
        slider.addEventListener('input', () => {
            if (!this.controller.set(definition.key, Number(slider.value))) {
                return;
            }

            value.textContent = this.controller.format(definition);
            this.onChange(definition.key);
        });

        group.append(header, slider);
    }

    private renderToggle(
        group: HTMLElement,
        definition: ParameterDefinition & { readonly kind: 'toggle' },
    ): void {
        const toggle = document.createElement('wa-switch') as HTMLElement & { checked: boolean };
        toggle.setAttribute('size', 's');
        toggle.textContent = definition.label;
        toggle.checked = this.controller.getBoolean(definition.key);
        toggle.addEventListener('change', () => {
            if (!this.controller.set(definition.key, Boolean(toggle.checked))) {
                return;
            }

            this.onChange(definition.key);
        });
        group.appendChild(toggle);
    }

    private renderSelect(
        group: HTMLElement,
        definition: ParameterDefinition & { readonly kind: 'select' },
    ): void {
        const header = document.createElement('div');
        header.className = 'cocoslab-parameter-header';
        const label = document.createElement('span');
        label.textContent = definition.label;
        const value = document.createElement('span');
        value.className = 'cocoslab-parameter-value';
        value.textContent = this.controller.format(definition);
        header.append(label, value);

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.alignItems = 'center';
        controls.style.justifyContent = 'center';
        controls.style.gap = '8px';

        createLibraryIconButton({
            parent: controls,
            icon: 'chevron-left',
            label: `Previous ${definition.label}`,
            onPress: () => this.change(definition.key, () => {
                this.controller.cycle(definition.key, -1);
            }),
        });
        createLibraryIconButton({
            parent: controls,
            icon: 'chevron-right',
            label: `Next ${definition.label}`,
            onPress: () => this.change(definition.key, () => {
                this.controller.cycle(definition.key, 1);
            }),
        });

        group.append(header, controls);
    }

    private renderPager(pageCount: number): HTMLElement {
        const pager = document.createElement('div');
        pager.style.display = 'flex';
        pager.style.alignItems = 'center';
        pager.style.justifyContent = 'center';
        pager.style.gap = '8px';
        pager.style.gridColumn = '1 / -1';

        createLibraryIconButton({
            parent: pager,
            icon: 'arrow-left',
            label: 'Previous parameter page',
            onPress: () => {
                this.page = (this.page - 1 + pageCount) % pageCount;
                this.renderCurrent();
            },
        });

        const label = document.createElement('span');
        label.className = 'cocoslab-navigation-title';
        label.textContent = `${this.page + 1} / ${pageCount}`;
        pager.appendChild(label);

        createLibraryIconButton({
            parent: pager,
            icon: 'arrow-right',
            label: 'Next parameter page',
            onPress: () => {
                this.page = (this.page + 1) % pageCount;
                this.renderCurrent();
            },
        });

        return pager;
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
        const pagerHeight = pageCount > 1 ? 48 : 0;

        return {
            columns,
            rows,
            pageSize,
            pageCount,
            rowHeight,
            pagerHeight,
            height: rows * rowHeight + pagerHeight + 28,
        };
    }
}
