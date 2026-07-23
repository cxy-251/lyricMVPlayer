import { HorizontalTextAlignment, Node } from 'cc';
import type {
    InteractiveModule,
    LabDefinition,
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
import type { CatalogCoverKind } from './CatalogCovers';

export class HomeModule implements InteractiveModule {
    private root: Node | null = null;
    private context: ModuleContext | null = null;
    private unsubscribeViewport: (() => void) | null = null;

    constructor(private readonly registry: ModuleRegistry) {}

    mount(context: ModuleContext): void {
        this.context = context;
        const viewport = context.viewport.current;
        this.root = createUiNode(context.host, 'LaboratoryHome', viewport.width, viewport.height);
        this.render(viewport);
        this.unsubscribeViewport = context.viewport.subscribe((snapshot) => {
            this.render(snapshot);
        });
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
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const safeHeight = viewport.height - viewport.safeInsets.top - viewport.safeInsets.bottom;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const centerY = (viewport.safeInsets.bottom - viewport.safeInsets.top) / 2 - 8;
        const contentWidth = Math.min(920, safeWidth - (compact ? 28 : 72));

        createLabel(
            root,
            'COCOS LAB',
            contentWidth,
            24,
            11,
            palette.subtle,
            centerX,
            viewport.height / 2 - viewport.safeInsets.top - 28,
            HorizontalTextAlignment.LEFT,
        );

        const columns = compact ? 1 : Math.min(2, labs.length);
        const rows = Math.ceil(labs.length / columns);
        const gap = compact ? 14 : 22;
        const availableHeight = Math.max(220, safeHeight - (compact ? 78 : 104));
        const maximumCardWidth = compact ? 360 : 380;
        const cardWidth = Math.min(
            maximumCardWidth,
            (contentWidth - gap * (columns - 1)) / columns,
        );
        const cardHeight = Math.min(
            compact ? 300 : 430,
            Math.max(160, (availableHeight - gap * (rows - 1)) / rows),
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
                cover: this.coverForLab(lab),
                width: cardWidth,
                height: cardHeight,
                x: startX + column * (cardWidth + gap),
                y: startY - row * (cardHeight + gap),
                onOpen: () => {
                    void this.context?.openLab(lab.id);
                },
            });
        }
    }

    private coverForLab(lab: LabDefinition): CatalogCoverKind {
        return lab.id === 'physics' ? 'physics' : 'mathematics';
    }
}
