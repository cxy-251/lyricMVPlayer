import {
    Color,
    Mask,
    Node,
    ScrollView,
} from 'cc';
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
import { createCatalogCard, type CatalogCardStyle } from './CatalogCard';

const MATHEMATICS_CATALOG_STYLE: CatalogCardStyle = {
    card: new Color(26, 24, 51, 255),
    hover: new Color(37, 34, 70, 255),
    border: new Color(74, 69, 111, 255),
    ink: new Color(242, 237, 225, 255),
    muted: new Color(157, 154, 184, 255),
    accent: new Color(79, 214, 226, 255),
    radius: 3,
};

const PHYSICS_CATALOG_STYLE: CatalogCardStyle = {
    card: new Color(35, 32, 24, 255),
    hover: new Color(48, 42, 29, 255),
    border: new Color(92, 76, 45, 255),
    ink: new Color(241, 232, 210, 255),
    muted: new Color(171, 161, 140, 255),
    accent: new Color(255, 177, 59, 255),
    radius: 4,
};

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
        fillNode(
            root,
            viewport.width,
            viewport.height,
            this.labId === 'mathematics'
                ? new Color(16, 15, 31, 255)
                : this.labId === 'physics'
                    ? new Color(23, 22, 18, 255)
                    : palette.background,
        );

        if (this.labId === 'games' && modules.length > 1) {
            this.page = 0;
            this.renderScrollableGrid(
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

    private renderScrollableGrid(
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
        const viewportHeight = Math.max(1, contentTop - contentBottom);
        const gap = compact ? 12 : 20;
        const desiredColumns = compact
            ? contentWidth >= 560 ? 2 : 1
            : viewport.breakpoint === 'wide'
                ? 3
                : 2;
        const minimumCardWidth = compact ? 220 : 260;
        const capacity = Math.max(
            1,
            Math.floor((contentWidth + gap) / (minimumCardWidth + gap)),
        );
        const columns = Math.max(
            1,
            Math.min(desiredColumns, capacity, modules.length),
        );
        const maximumCardWidth = compact ? 420 : 380;
        const cardWidth = Math.max(
            1,
            Math.min(
                maximumCardWidth,
                (contentWidth - gap * (columns - 1)) / columns,
            ),
        );
        const cardHeight = Math.max(
            compact ? 230 : 260,
            Math.min(compact ? 350 : 360, cardWidth * 0.96),
        );
        const rows = Math.max(1, Math.ceil(modules.length / columns));
        const verticalPadding = compact ? 10 : 14;
        const contentHeight = Math.max(
            viewportHeight,
            verticalPadding * 2
                + rows * cardHeight
                + Math.max(0, rows - 1) * gap,
        );
        const gridWidth = columns * cardWidth + gap * (columns - 1);
        const startX = -gridWidth / 2 + cardWidth / 2;
        const startY = contentHeight / 2 - verticalPadding - cardHeight / 2;
        const scrollCenterY = (contentTop + contentBottom) / 2;

        const scrollRoot = createUiNode(
            root,
            'GamesCatalogScroll',
            contentWidth,
            viewportHeight,
            centerX,
            scrollCenterY,
        );
        const view = createUiNode(
            scrollRoot,
            'View',
            contentWidth,
            viewportHeight,
        );
        const mask = view.addComponent(Mask);
        mask.type = Mask.Type.RECT;
        const content = createUiNode(
            view,
            'Content',
            contentWidth,
            contentHeight,
            0,
            (viewportHeight - contentHeight) / 2,
        );

        for (let index = 0; index < modules.length; index += 1) {
            const definition = modules[index];
            const row = Math.floor(index / columns);
            const column = index % columns;
            createCatalogCard(content, {
                name: `ModuleCard:${definition.id}`,
                title: definition.title,
                subtitle: definition.catalog.subtitle,
                cover: definition.catalog.cover ?? fallbackCover,
                width: cardWidth,
                height: cardHeight,
                x: startX + column * (cardWidth + gap),
                y: startY - row * (cardHeight + gap),
                directOpen: compact,
                style: this.catalogStyle(),
                onOpen: () => {
                    void this.context?.open(definition.id);
                },
            });
        }

        const scrollView = scrollRoot.addComponent(ScrollView);
        scrollView.content = content;
        scrollView.horizontal = false;
        scrollView.vertical = contentHeight > viewportHeight + 1;
        scrollView.inertia = true;
        scrollView.brake = 0.72;
        scrollView.elastic = false;
        scrollView.cancelInnerEvents = true;
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
        const balancedFour = !compact
            && modules.length === 4
            && availableHeight >= 520;
        const columns = compact
            ? 1
            : singleModule
                ? 1
                : balancedFour
                    ? 2
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
        const preferredCardHeight = balancedFour
            ? Math.min((availableHeight - gap) / 2, cardWidth * 0.72)
            : Math.min(
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
                style: this.catalogStyle(),
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

    private catalogStyle(): CatalogCardStyle | undefined {
        if (this.labId === 'mathematics') {
            return MATHEMATICS_CATALOG_STYLE;
        }
        if (this.labId === 'physics') {
            return PHYSICS_CATALOG_STYLE;
        }
        return undefined;
    }
}
