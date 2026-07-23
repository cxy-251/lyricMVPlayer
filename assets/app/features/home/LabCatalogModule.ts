import {
    HorizontalTextAlignment,
    Node,
} from 'cc';
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
    createPill,
    createUiNode,
    fillNode,
    palette,
    strokeNode,
} from '../../ui/UiFactory';

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

        const lab = this.registry.getLab(this.labId);
        const modules = this.registry.listByLab(this.labId);
        const compact = viewport.breakpoint === 'compact';
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const titleY = viewport.height / 2 - viewport.safeInsets.top - (compact ? 106 : 122);

        clearNode(root);
        fillNode(root, viewport.width, viewport.height, palette.background);

        createLabel(
            root,
            'COCOS LAB  /  LABORATORY',
            Math.min(840, safeWidth - 36),
            28,
            compact ? 11 : 12,
            palette.subtle,
            centerX,
            titleY + (compact ? 38 : 46),
        );
        createLabel(
            root,
            lab.title,
            Math.min(920, safeWidth - 36),
            compact ? 50 : 62,
            compact ? 31 : 43,
            palette.text,
            centerX,
            titleY,
        );
        createLabel(
            root,
            lab.description,
            Math.min(920, safeWidth - 44),
            42,
            compact ? 14 : 17,
            palette.muted,
            centerX,
            titleY - (compact ? 44 : 54),
        );

        this.renderCards(
            root,
            modules,
            viewport,
            centerX,
            titleY - (compact ? 92 : 112),
        );
    }

    private renderCards(
        root: Node,
        modules: readonly ModuleDefinition[],
        viewport: ViewportSnapshot,
        centerX: number,
        cardsTop: number,
    ): void {
        const compact = viewport.breakpoint === 'compact';
        const columns = viewport.breakpoint === 'wide' ? 3 : viewport.breakpoint === 'medium' ? 2 : 1;
        const horizontalPadding = compact ? 18 : 38;
        const gap = compact ? 14 : 18;
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const gridWidth = Math.min(1320, safeWidth - horizontalPadding * 2);
        const cardWidth = (gridWidth - gap * (columns - 1)) / columns;
        const cardHeight = compact ? 166 : 184;
        const cardsBottom = -viewport.height / 2 + viewport.safeInsets.bottom + 62;
        const availableHeight = Math.max(cardHeight, cardsTop - cardsBottom);
        const rows = Math.max(1, Math.floor((availableHeight + gap) / (cardHeight + gap)));
        const pageSize = rows * columns;
        const pageCount = Math.max(1, Math.ceil(modules.length / pageSize));
        this.page = Math.min(this.page, pageCount - 1);
        const visible = modules.slice(this.page * pageSize, (this.page + 1) * pageSize);

        for (let index = 0; index < visible.length; index += 1) {
            const row = Math.floor(index / columns);
            const column = index % columns;
            const rowCount = Math.min(columns, visible.length - row * columns);
            const rowWidth = cardWidth * rowCount + gap * (rowCount - 1);
            const rowStart = centerX - rowWidth / 2 + cardWidth / 2;
            const x = rowStart + column * (cardWidth + gap);
            const y = cardsTop - cardHeight / 2 - row * (cardHeight + gap);
            this.renderModuleCard(root, visible[index], cardWidth, cardHeight, x, y, compact);
        }

        if (pageCount > 1) {
            const pagerY = cardsBottom - 18;
            createButton(root, {
                name: 'LaboratoryCatalogPrevious',
                text: '←',
                width: 48,
                height: 36,
                x: centerX - 64,
                y: pagerY,
                variant: 'ghost',
                onPress: () => {
                    this.page = (this.page - 1 + pageCount) % pageCount;
                    this.render(viewport);
                },
            });
            createLabel(
                root,
                `${this.page + 1} / ${pageCount}`,
                70,
                36,
                13,
                palette.muted,
                centerX,
                pagerY,
            );
            createButton(root, {
                name: 'LaboratoryCatalogNext',
                text: '→',
                width: 48,
                height: 36,
                x: centerX + 64,
                y: pagerY,
                variant: 'ghost',
                onPress: () => {
                    this.page = (this.page + 1) % pageCount;
                    this.render(viewport);
                },
            });
        }
    }

    private renderModuleCard(
        root: Node,
        definition: ModuleDefinition,
        width: number,
        height: number,
        x: number,
        y: number,
        compact: boolean,
    ): void {
        const card = createUiNode(root, `ModuleCard:${definition.id}`, width, height, x, y);
        fillNode(card, width, height, palette.surface, 18);
        strokeNode(card, width, height, palette.border, 18, 1.25);

        createPill(
            card,
            definition.category,
            Math.max(88, definition.category.length * 8 + 22),
            -width / 2 + 66,
            height / 2 - 27,
            true,
        );
        createLabel(
            card,
            definition.title,
            width - 32,
            40,
            compact ? 21 : 24,
            palette.text,
            0,
            30,
            HorizontalTextAlignment.LEFT,
        );
        createLabel(
            card,
            definition.description,
            width - 32,
            compact ? 50 : 56,
            compact ? 14 : 15,
            palette.muted,
            0,
            -10,
            HorizontalTextAlignment.LEFT,
        );

        const tags = definition.tags?.slice(0, compact ? 2 : 3).join(' · ') ?? '';
        createLabel(
            card,
            tags.toUpperCase(),
            Math.max(80, width - 150),
            28,
            11,
            palette.subtle,
            -54,
            -height / 2 + 27,
            HorizontalTextAlignment.LEFT,
        );
        createButton(card, {
            name: `Open:${definition.id}`,
            text: 'OPEN',
            width: 92,
            height: 40,
            x: width / 2 - 62,
            y: -height / 2 + 29,
            fontSize: 13,
            onPress: () => {
                void this.context?.open(definition.id);
            },
        });
    }
}
