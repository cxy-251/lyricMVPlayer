import { Node } from 'cc';
import { clearNode, createButton, createUiNode } from './UiFactory';

const TAB_HEIGHT = 36;
const TAB_ROW_HEIGHT = 44;
const TAB_GAP = 6;

export interface TabStripOption<T extends string> {
    readonly value: T;
    readonly label: string;
}

export interface TabStripOptions<T extends string> {
    readonly name: string;
    readonly width: number;
    readonly y: number;
    readonly selected: T;
    readonly tabs: readonly TabStripOption<T>[];
    readonly onSelect: (value: T) => void;
}

export function measureTabStripHeight(itemCount: number, width: number): number {
    const columns = tabColumns(itemCount, width);
    const rows = Math.max(1, Math.ceil(itemCount / columns));
    return rows * TAB_ROW_HEIGHT + Math.max(0, rows - 1) * TAB_GAP;
}

export function createTabStrip<T extends string>(
    parent: Node,
    options: TabStripOptions<T>,
): Node {
    const columns = tabColumns(options.tabs.length, options.width);
    const height = measureTabStripHeight(options.tabs.length, options.width);
    const root = createUiNode(
        parent,
        options.name,
        options.width,
        height,
        0,
        options.y,
    );
    clearNode(root);

    const horizontalGap = 6;
    const buttonWidth = Math.max(
        56,
        (options.width - horizontalGap * (columns - 1)) / columns,
    );
    const totalWidth = columns * buttonWidth + (columns - 1) * horizontalGap;
    const left = -totalWidth / 2 + buttonWidth / 2;
    const top = height / 2 - TAB_ROW_HEIGHT / 2;

    options.tabs.forEach((tab, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        createButton(root, {
            name: `${options.name}:${tab.value}`,
            text: tab.label,
            width: buttonWidth,
            height: TAB_HEIGHT,
            x: left + column * (buttonWidth + horizontalGap),
            y: top - row * (TAB_ROW_HEIGHT + TAB_GAP),
            fontSize: buttonWidth < 88 ? 9 : 10,
            variant: tab.value === options.selected ? 'primary' : 'secondary',
            shape: 'capsule',
            onPress: () => options.onSelect(tab.value),
        });
    });

    return root;
}

function tabColumns(itemCount: number, width: number): number {
    if (itemCount <= 1) return 1;
    if (width >= 860) return Math.min(itemCount, 8);
    if (width >= 520) return Math.min(itemCount, 4);
    return Math.min(itemCount, 2);
}
