import { Node } from 'cc';
import type {
    InteractiveModule,
    LabId,
    ModuleContext,
    VisibleModuleDefinition,
} from '../../contracts/InteractiveModule';
import type { ModuleRegistry } from '../../core/ModuleRegistry';
import type { ViewportSnapshot } from '../../services/ViewportService';
import {
    clearNode,
    createIconButton,
    createLabel,
    createUiNode,
    fillNode,
    nativeTheme,
    palette,
} from '../../ui/UiFactory';
import { createCatalogCard } from './CatalogCard';

interface WaterfallPlacement {
    readonly definition: VisibleModuleDefinition;
    readonly column: number;
    readonly height: number;
}

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
        this.root = createUiNode(
            context.host,
            `LaboratoryCatalog:${this.labId}`,
            viewport.width,
            viewport.height,
        );
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

        const lab = this.registry.getLab(this.labId);
        const modules = this.registry.listByLab(this.labId);
        const compact = viewport.breakpoint === 'compact';
        const safeWidth = Math.max(
            1,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const contentTop = viewport.height / 2
            - viewport.safeInsets.top
            - (compact ? 70 : 78);
        const contentBottom = -viewport.height / 2
            + viewport.safeInsets.bottom
            + 24;
        const contentWidth = Math.max(
            1,
            Math.min(1280, safeWidth - (compact ? 18 : 48)),
        );

        clearNode(root);
        fillNode(root, viewport.width, viewport.height, palette.background);

        if (this.labId === 'games' && modules.length > 1) {
            this.page = 0;
            this.renderWaterfall(
                root,
                viewport,
                modules,
                lab.cover,
                compact,
                centerX,
                contentTop,
                contentBottom,
                contentWidth,
            );
            return;
        }

        this.renderPagedGrid(
            root,
            viewport,
            modules,
            lab.cover,
            compact,
            centerX,
            contentTop,
            contentBottom,
            contentWidth,
        );
    }

    private renderWaterfall(
        root: Node,
        viewport: ViewportSnapshot,
        modules: readonly VisibleModuleDefinition[],
        fallbackCover: string,
        compact: boolean,
        centerX: number,
        contentTop: number,
        contentBottom: number,
        contentWidth: number,
    ): void {
        const availableHeight = Math.max(1, contentTop - contentBottom);
        const baseGap = compact ? 10 : 18;
        const desiredColumns = compact
            ? contentWidth >= 300 ? 2 : 1
            : viewport.breakpoint === 'wide'
                ? Math.min(3, modules.length)
                : Math.min(2, modules.length);
        const minimumCardWidth = compact ? 132 : 238;
        const capacity = Math.max(
            1,
            Math.floor((contentWidth + baseGap) / (minimumCardWidth + baseGap)),
        );
        const columns = Math.max(
            1,
            Math.min(desiredColumns, capacity, modules.length),
        );
        const cardWidth = Math.max(
            1,
            (contentWidth - baseGap * (columns - 1)) / columns,
        );
        const rawHeights = modules.map((definition) => {
            const ratio = this.waterfallRatio(definition.id);
            return Math.max(
                compact ? 132 : 190,
                Math.min(
                    compact ? 250 : 390,
                    cardWidth * ratio,
                ),
            );
        });

        const rawColumnHeights = new Array<number>(columns).fill(0);
        for (const height of rawHeights) {
            const column = this.shortestColumn(rawColumnHeights);
            rawColumnHeights[column] += (
                rawColumnHeights[column] > 0 ? baseGap : 0
            ) + height;
        }
        const tallestRawColumn = Math.max(...rawColumnHeights, 1);
        const scale = Math.min(1, availableHeight / tallestRawColumn);
        const gap = Math.max(4, baseGap * scale);
        const scaledHeights = rawHeights.map((height) => Math.max(84, height * scale));
        const placements: WaterfallPlacement[] = [];
        const columnHeights = new Array<number>(columns).fill(0);

        for (let index = 0; index < modules.length; index += 1) {
            const column = this.shortestColumn(columnHeights);
            const height = scaledHeights[index];
            placements.push({
                definition: modules[index],
                column,
                height,
            });
            columnHeights[column] += (
                columnHeights[column] > 0 ? gap : 0
            ) + height;
        }

        const waterfallWidth = columns * cardWidth + gap * (columns - 1);
        const startX = centerX - waterfallWidth / 2 + cardWidth / 2;
        const consumedHeights = new Array<number>(columns).fill(0);

        for (const placement of placements) {
            const { definition, column, height } = placement;
            const previousHeight = consumedHeights[column];
            const y = contentTop
                - previousHeight
                - (previousHeight > 0 ? gap : 0)
                - height / 2;
            consumedHeights[column] = previousHeight
                + (previousHeight > 0 ? gap : 0)
                + height;

            createCatalogCard(root, {
                name: `ModuleCard:${definition.id}`,
                title: definition.title,
                subtitle: definition.catalog.subtitle,
                cover: definition.catalog.cover ?? fallbackCover,
                width: cardWidth,
                height,
                x: startX + column * (cardWidth + gap),
                y,
                directOpen: compact,
                onOpen: () => {
                    void this.context?.open(definition.id);
                },
            });
        }
    }

    private renderPagedGrid(
        root: Node,
        viewport: ViewportSnapshot,
        modules: readonly VisibleModuleDefinition[],
        fallbackCover: string,
        compact: boolean,
        centerX: number,
        contentTop: number,
        contentBottom: number,
        contentWidth: number,
    ): void {
        const availableHeight = Math.max(1, contentTop - contentBottom);
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
        const cardWidth = Math.max(1, Math.min(
            maximumCardWidth,
            (contentWidth - gap * (columns - 1)) / columns,
        ));
        const preferredCardHeight = Math.min(
            singleModule ? compact ? 430 : 660 : compact ? 400 : 500,
            cardWidth * (singleModule ? 1.14 : 1.08),
        );
        const cardHeight = Math.max(1, Math.min(preferredCardHeight, availableHeight));
        const rowsPerPage = Math.max(
            1,
            Math.floor((availableHeight + gap) / (cardHeight + gap)),
        );
        const pageSize = Math.max(1, rowsPerPage * columns);
        const pageCount = Math.max(1, Math.ceil(modules.length / pageSize));
        this.page = Math.min(this.page, pageCount - 1);
        const visible = modules.slice(
            this.page * pageSize,
            (this.page + 1) * pageSize,
        );
        const rows = Math.max(1, Math.ceil(visible.length / columns));
        const gridWidth = columns * cardWidth + gap * (columns - 1);
        const gridHeight = rows * cardHeight + gap * (rows - 1);
        const gridCenterY = (contentTop + contentBottom) / 2
            + (pageCount > 1 ? 18 : 0);
        const startX = centerX - gridWidth / 2 + cardWidth / 2;
        const startY = gridCenterY + gridHeight / 2 - cardHeight / 2;

        for (let index = 0; index < visible.length; index += 1) {
            const definition = visible[index];
            const row = Math.floor(index / columns);
            const column = index % columns;

            createCatalogCard(root, {
                name: `ModuleCard:${definition.id}`,
                title: definition.title,
                subtitle: definition.catalog.subtitle,
                cover: definition.catalog.cover ?? fallbackCover,
                width: cardWidth,
                height: cardHeight,
                x: startX + column * (cardWidth + gap),
                y: startY - row * (cardHeight + gap),
                directOpen: compact,
                onOpen: () => {
                    void this.context?.open(definition.id);
                },
            });
        }

        if (pageCount > 1) {
            this.renderPager(root, viewport, centerX, pageCount);
        }
    }

    private waterfallRatio(moduleId: string): number {
        const ratios = [0.86, 1.04, 1.2, 0.94, 1.12, 0.9, 1.16] as const;
        let hash = 0;
        for (let index = 0; index < moduleId.length; index += 1) {
            hash = (hash * 31 + moduleId.charCodeAt(index)) >>> 0;
        }
        return ratios[hash % ratios.length];
    }

    private shortestColumn(heights: readonly number[]): number {
        let bestIndex = 0;
        for (let index = 1; index < heights.length; index += 1) {
            if (heights[index] < heights[bestIndex]) {
                bestIndex = index;
            }
        }
        return bestIndex;
    }

    private renderPager(
        root: Node,
        viewport: ViewportSnapshot,
        centerX: number,
        pageCount: number,
    ): void {
        const y = -viewport.height / 2 + viewport.safeInsets.bottom + 24;

        createIconButton(root, {
            name: 'LaboratoryCatalogPrevious',
            icon: 'chevron-left',
            x: centerX - 54,
            y,
            tone: 'lilac',
            onPress: () => {
                this.page = (this.page - 1 + pageCount) % pageCount;
                this.render(viewport);
            },
        });
        createLabel(
            root,
            `${this.page + 1}/${pageCount}`,
            48,
            32,
            11,
            nativeTheme.muted,
            centerX,
            y,
        );
        createIconButton(root, {
            name: 'LaboratoryCatalogNext',
            icon: 'chevron-right',
            x: centerX + 54,
            y,
            tone: 'lilac',
            onPress: () => {
                this.page = (this.page + 1) % pageCount;
                this.render(viewport);
            },
        });
    }
}
