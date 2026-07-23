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
    createUiNode,
    fillNode,
    palette,
} from '../../ui/UiFactory';
import { createLibraryIconButton } from '../../ui/WebIcons';
import {
    clearWebUiScope,
    getWebUiScope,
} from '../../ui/WebUiKit';
import { createCatalogCard } from './CatalogCard';
import type { CatalogCoverKind } from './CatalogCovers';

const LAB_CATALOG_SCOPE = 'lab-catalog';

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
        clearWebUiScope(LAB_CATALOG_SCOPE);
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
        const contentTop = viewport.height / 2 - viewport.safeInsets.top - (compact ? 70 : 78);
        const contentBottom = -viewport.height / 2 + viewport.safeInsets.bottom + 24;
        const availableHeight = Math.max(220, contentTop - contentBottom);
        const contentWidth = Math.min(1280, safeWidth - (compact ? 24 : 56));

        clearNode(root);
        fillNode(root, viewport.width, viewport.height, palette.background);
        const webParent = getWebUiScope(LAB_CATALOG_SCOPE);

        const singleModule = modules.length === 1;
        const columns = compact
            ? 1
            : singleModule
                ? 1
                : viewport.breakpoint === 'wide'
                    ? Math.min(3, modules.length)
                    : Math.min(2, modules.length);
        const gap = compact ? 14 : 28;
        const maximumCardWidth = singleModule
            ? compact ? 460 : 560
            : compact ? 430 : 440;
        const cardWidth = Math.max(220, Math.min(
            maximumCardWidth,
            (contentWidth - gap * (columns - 1)) / columns,
        ));
        const cardHeight = Math.max(
            compact ? 220 : 340,
            Math.min(
                singleModule ? compact ? 430 : 660 : compact ? 400 : 500,
                availableHeight,
                cardWidth * (singleModule ? 1.14 : 1.08),
            ),
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
                webParent,
                onOpen: () => {
                    void this.context?.open(definition.id);
                },
            });
        }

        if (pageCount > 1 && webParent) {
            this.renderPager(webParent, viewport, pageCount);
        }
    }

    private renderPager(
        parent: HTMLElement,
        viewport: ViewportSnapshot,
        pageCount: number,
    ): void {
        const pager = document.createElement('div');
        pager.className = 'cocoslab-navigation';
        pager.style.left = '50%';
        pager.style.bottom = `${viewport.safeInsets.bottom + 8}px`;
        pager.style.width = '156px';
        pager.style.height = '44px';
        pager.style.transform = 'translateX(-50%)';
        pager.style.justifyContent = 'center';

        createLibraryIconButton({
            parent: pager,
            icon: 'arrow-left',
            label: 'Previous page',
            onPress: () => {
                this.page = (this.page - 1 + pageCount) % pageCount;
                this.render(viewport);
            },
        });

        const count = document.createElement('span');
        count.className = 'cocoslab-navigation-title';
        count.textContent = `${this.page + 1} / ${pageCount}`;
        pager.appendChild(count);

        createLibraryIconButton({
            parent: pager,
            icon: 'arrow-right',
            label: 'Next page',
            onPress: () => {
                this.page = (this.page + 1) % pageCount;
                this.render(viewport);
            },
        });

        parent.appendChild(pager);
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
