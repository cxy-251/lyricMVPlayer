import { Node } from 'cc';
import type {
    InteractiveModule,
    LabId,
    ModuleContext,
    ModuleDefinition,
} from '../../contracts/InteractiveModule';
import type { ModuleRegistry } from '../../core/ModuleRegistry';
import type { ViewportSnapshot } from '../../services/ViewportService';
import {
    clearNode,
    createButton,
    createLabel,
    createUiNode,
    fillNode,
    palette,
} from '../../ui/UiFactory';
import { createCatalogCard } from './CatalogCard';
import type { CatalogCoverKind } from './CatalogCovers';

export class LabCatalogModule implements InteractiveModule {
    private root: Node | null = null;
    private context: ModuleContext | null = null;
    private page = 0;
    private unsubscribeViewport: (() => void) | null = null;

    constructor(
        private readonly registry: ModuleRegistry,
        private readonly labId: LabId,
    ) {}

    mount(context: ModuleContext): void {
        this.context = context;
        const viewport = context.viewport.current;
        this.root = createUiNode(context.host, `LaboratoryCatalog:${this.labId}`, viewport.width, viewport.height);
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

        this.registry.getLab(this.labId);
        const modules = this.registry.listByLab(this.labId);
        const compact = viewport.breakpoint === 'compact';
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const contentTop = viewport.height / 2 - viewport.safeInsets.top - (compact ? 78 : 86);
        const contentBottom = -viewport.height / 2 + viewport.safeInsets.bottom + 28;
        const availableHeight = Math.max(180, contentTop - contentBottom);
        const contentWidth = Math.min(1120, safeWidth - (compact ? 28 : 72));

        clearNode(root);
        fillNode(root, viewport.width, viewport.height, palette.background);

        const columns = compact
            ? 1
            : viewport.breakpoint === 'wide'
                ? Math.min(3, modules.length)
                : Math.min(2, modules.length);
        const gap = compact ? 14 : 22;
        const maximumCardWidth = compact ? 360 : 350;
        const cardWidth = Math.min(
            maximumCardWidth,
            (contentWidth - gap * (columns - 1)) / columns,
        );
        const cardHeight = Math.min(
            compact ? 330 : 420,
            Math.max(190, cardWidth * 1.12),
        );
        const rowsPerPage = Math.max(
            1,
            Math.floor((availableHeight + gap) / (cardHeight + gap)),
        );
        const pageSize = Math.max(1, rowsPerPage * columns);
        const pageCount = Math.max(1, Math.ceil(modules.length / pageSize));
        this.page = Math.min(this.page, pageCount - 1);
        const visible = modules.slice(this.page * pageSize, (this.page + 1) * pageSize);
        const rows = Math.ceil(visible.length / columns);
        const gridWidth = columns * cardWidth + gap * (columns - 1);
        const gridHeight = rows * cardHeight + gap * (rows - 1);
        const gridCenterY = (contentTop + contentBottom) / 2 + (pageCount > 1 ? 18 : 0);
        const startX = centerX - gridWidth / 2 + cardWidth / 2;
        const startY = gridCenterY + gridHeight / 2 - cardHeight / 2;

        for (let index = 0; index < visible.length; index += 1) {
            const definition = visible[index];
            const row = Math.floor(index / columns);
            const column = index % columns;

            createCatalogCard(root, {
                name: `ModuleCard:${definition.id}`,
                title: definition.title,
                subtitle: this.subtitleForModule(definition),
                cover: this.coverForModule(definition),
                width: cardWidth,
                height: cardHeight,
                x: startX + column * (cardWidth + gap),
                y: startY - row * (cardHeight + gap),
                onOpen: () => {
                    void this.context?.open(definition.id);
                },
            });
        }

        if (pageCount > 1) {
            this.renderPager(root, viewport, centerX, pageCount);
        }
    }

    private renderPager(
        root: Node,
        viewport: ViewportSnapshot,
        centerX: number,
        pageCount: number,
    ): void {
        const y = -viewport.height / 2 + viewport.safeInsets.bottom + 26;

        createButton(root, {
            name: 'LaboratoryCatalogPrevious',
            text: '←',
            width: 38,
            height: 32,
            x: centerX - 50,
            y,
            variant: 'ghost',
            onPress: () => {
                this.page = (this.page - 1 + pageCount) % pageCount;
                this.render(viewport);
            },
        });
        createLabel(root, `${this.page + 1}/${pageCount}`, 48, 32, 11, palette.subtle, centerX, y);
        createButton(root, {
            name: 'LaboratoryCatalogNext',
            text: '→',
            width: 38,
            height: 32,
            x: centerX + 50,
            y,
            variant: 'ghost',
            onPress: () => {
                this.page = (this.page + 1) % pageCount;
                this.render(viewport);
            },
        });
    }

    private coverForModule(definition: ModuleDefinition): CatalogCoverKind {
        return definition.id === 'double-pendulum-lab'
            ? 'double-pendulum'
            : 'parametric-curve';
    }

    private subtitleForModule(definition: ModuleDefinition): string {
        if (definition.id === 'double-pendulum-lab') {
            return 'ideal conservative system';
        }

        return 'code generated curve system';
    }
}
