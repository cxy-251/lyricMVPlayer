import { HorizontalTextAlignment, Node } from 'cc';
import type {
    InteractiveModule,
    ModuleContext,
} from '../../contracts/InteractiveModule';
import type { ModuleRegistry } from '../../core/ModuleRegistry';
import type { ViewportSnapshot } from '../../services/ViewportService';
import {
    clearNode,
    createLabel,
    createUiNode,
    fillNode,
    palette,
} from '../../ui/UiFactory';
import { createCatalogCard } from './CatalogCard';

export class HomeModule implements InteractiveModule {
    private root: Node | null = null;
    private context: ModuleContext | null = null;
    private unsubscribeViewport: (() => void) | null = null;

    constructor(private readonly registry: ModuleRegistry) {}

    mount(context: ModuleContext): void {
        this.context = context;
        const viewport = context.viewport.current;
        this.root = createUiNode(context.host, 'LaboratoryHome', viewport.width, viewport.height);
        let initializing = true;

        try {
            this.unsubscribeViewport = context.viewport.subscribe((snapshot) => {
                try {
                    this.render(snapshot);
                } catch (error) {
                    if (initializing) {
                        throw error;
                    }
                    context.reportError(error);
                }
            });
        } finally {
            initializing = false;
        }
    }

    unmount(): void {
        this.unsubscribeViewport?.();
        this.unsubscribeViewport = null;
        this.root?.destroy();
        this.root = null;
        this.context = null;
    }

    private render(viewport: ViewportSnapshot): void {
        const root = this.root;
        if (!root) {
            return;
        }

        clearNode(root);
        fillNode(root, viewport.width, viewport.height, palette.background);

        const labs = this.registry.labs();
        const compact = viewport.breakpoint === 'compact';
        const safeWidth = Math.max(
            1,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const safeHeight = Math.max(
            1,
            viewport.height - viewport.safeInsets.top - viewport.safeInsets.bottom,
        );
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const centerY = (viewport.safeInsets.bottom - viewport.safeInsets.top) / 2 - 4;
        const contentWidth = Math.max(
            1,
            Math.min(1240, safeWidth - (compact ? 24 : 56)),
        );

        createLabel(
            root,
            'COCOS LAB',
            contentWidth,
            28,
            compact ? 11 : 13,
            palette.subtle,
            centerX,
            viewport.height / 2 - viewport.safeInsets.top - (compact ? 25 : 31),
            HorizontalTextAlignment.LEFT,
        );

        const columns = compact
            ? 1
            : viewport.breakpoint === 'wide'
                ? Math.min(3, labs.length)
                : Math.min(2, labs.length);
        const rows = Math.max(1, Math.ceil(labs.length / columns));
        const gap = compact ? 14 : 26;
        const availableHeight = Math.max(1, safeHeight - (compact ? 62 : 82));
        const rowHeightLimit = Math.max(
            1,
            (availableHeight - gap * (rows - 1)) / rows,
        );
        const maximumCardWidth = compact ? 460 : 520;
        const cardWidth = Math.max(1, Math.min(
            maximumCardWidth,
            (contentWidth - gap * (columns - 1)) / columns,
        ));
        const cardHeight = Math.max(
            1,
            Math.min(
                compact ? 390 : 620,
                rowHeightLimit,
                cardWidth * (compact ? 0.94 : 1.16),
            ),
        );
        const gridWidth = columns * cardWidth + gap * (columns - 1);
        const gridHeight = rows * cardHeight + gap * (rows - 1);
        const startX = centerX - gridWidth / 2 + cardWidth / 2;
        const startY = centerY + gridHeight / 2 - cardHeight / 2;

        for (let index = 0; index < labs.length; index += 1) {
            const lab = labs[index];
            const row = Math.floor(index / columns);
            const column = index % columns;
            const modules = this.registry.listByLab(lab.id);

            createCatalogCard(root, {
                name: `LaboratoryCard:${lab.id}`,
                title: lab.title,
                subtitle: `${modules.length} ${modules.length === 1 ? 'experiment' : 'experiments'}`,
                cover: lab.cover,
                width: cardWidth,
                height: cardHeight,
                x: startX + column * (cardWidth + gap),
                y: startY - row * (cardHeight + gap),
                directOpen: compact,
                onOpen: () => {
                    void this.context?.openLab(lab.id);
                },
            });
        }
    }
}
