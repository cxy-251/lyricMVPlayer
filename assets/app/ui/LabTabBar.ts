import { Node } from 'cc';
import {
    clearNode,
    createButton,
    createUiNode,
    fillNode,
    palette,
    resizeNode,
    strokeNode,
} from './UiFactory';

const TAB_HEIGHT = 40;
const TAB_GAP = 6;
const VERTICAL_PADDING = 6;

export interface LabTabDefinition<T extends string> {
    readonly id: T;
    readonly label: string;
}

export class LabTabBar<T extends string> {
    private readonly root: Node;
    private lastWidth = -1;
    private lastY = Number.NaN;
    private lastActive: T | null = null;

    constructor(
        parent: Node,
        private readonly tabs: readonly LabTabDefinition<T>[],
        private readonly onSelect: (id: T) => void,
    ) {
        this.root = createUiNode(parent, 'LabTabBar', 1, 1);
    }

    static measureHeight(tabCount: number, width: number): number {
        const columns = this.columns(tabCount, width);
        const rows = Math.max(1, Math.ceil(tabCount / columns));
        return rows * TAB_HEIGHT
            + Math.max(0, rows - 1) * TAB_GAP
            + VERTICAL_PADDING * 2;
    }

    render(width: number, y: number, active: T): void {
        const safeWidth = Math.max(1, width);
        if (
            this.lastWidth === safeWidth
            && this.lastY === y
            && this.lastActive === active
        ) {
            return;
        }
        this.lastWidth = safeWidth;
        this.lastY = y;
        this.lastActive = active;

        clearNode(this.root);
        const columns = LabTabBar.columns(this.tabs.length, safeWidth);
        const rows = Math.max(1, Math.ceil(this.tabs.length / columns));
        const height = LabTabBar.measureHeight(this.tabs.length, safeWidth);
        resizeNode(this.root, safeWidth, height);
        this.root.setPosition(0, y, 0);
        fillNode(this.root, safeWidth, height, palette.backgroundRaised, 9);
        strokeNode(this.root, safeWidth, height, palette.border, 9, 1);

        const usableWidth = Math.max(1, safeWidth - VERTICAL_PADDING * 2);
        const tabWidth = Math.max(
            44,
            (usableWidth - Math.max(0, columns - 1) * TAB_GAP) / columns,
        );
        const rowWidth = columns * tabWidth + Math.max(0, columns - 1) * TAB_GAP;
        const firstX = -rowWidth / 2 + tabWidth / 2;
        const firstY = height / 2 - VERTICAL_PADDING - TAB_HEIGHT / 2;

        this.tabs.forEach((tab, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            createButton(this.root, {
                name: `LabTab:${tab.id}`,
                text: tab.label,
                width: tabWidth,
                height: TAB_HEIGHT,
                x: firstX + column * (tabWidth + TAB_GAP),
                y: firstY - row * (TAB_HEIGHT + TAB_GAP),
                fontSize: safeWidth < 430 ? 9 : 10,
                variant: tab.id === active ? 'primary' : 'secondary',
                shape: 'rounded',
                onPress: () => {
                    if (tab.id !== this.lastActive) this.onSelect(tab.id);
                },
            });
        });
    }

    destroy(): void {
        this.root.destroy();
    }

    private static columns(tabCount: number, width: number): number {
        if (tabCount <= 1) return 1;
        if (width < 300) return 2;
        if (width < 430) return Math.min(4, tabCount);
        return Math.min(4, tabCount);
    }
}
