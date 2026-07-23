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
        const centerY = (viewport.safeInsets.bottom - viewport.safeInsets.top) / 2 - 4;
        const contentWidth = Math.min(1240, safeWidth - (compact ? 24 : 56));

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

        const columns = compact ? 1 : Math.min(2, labs.length);
        const rows = Math.ceil(labs.length / columns);
        const gap = compact ? 14 : 34;
        const availableHeight = Math.max(240, safeHeight - (compact ? 62 : 82));
        const rowHeightLimit = Math.max(
            170,
            (availableHeight - gap * (rows - 1)) / rows,
        );
        const maximumCardWidth = compact ? 460 : 520;
        const cardWidth = Math.max(220, Math.min(
            maximumCardWidth,
            (contentWidth - gap * (columns - 1)) / columns,
        ));
        const cardHeight = Math.max(
            compact ? 190 : 360,
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
                cover: this.coverForLab(lab),
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

    private coverForLab(lab: LabDefinition): CatalogCoverKind {
        return lab.id === 'physics' ? 'physics' : 'mathematics';
    }
}
