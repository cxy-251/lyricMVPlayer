import { HorizontalTextAlignment, Node } from 'cc';
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

        const lab = this.registry.getLab(this.labId);
        const modules = this.registry.listByLab(this.labId);
        const compact = viewport.breakpoint === 'compact';
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const contentWidth = Math.min(1080, safeWidth - (compact ? 32 : 72));
        const top = viewport.height / 2 - viewport.safeInsets.top - (compact ? 104 : 118);

        clearNode(root);
        fillNode(root, viewport.width, viewport.height, palette.background);

        createLabel(
            root,
            lab.title,
            contentWidth,
            compact ? 46 : 58,
            compact ? 31 : 42,
            palette.text,
            centerX,
            top,
            HorizontalTextAlignment.LEFT,
        );
        createLabel(
            root,
            lab.description,
            contentWidth,
            40,
            compact ? 14 : 16,
            palette.muted,
            centerX,
            top - (compact ? 46 : 58),
            HorizontalTextAlignment.LEFT,
        );
        createLabel(
            root,
            `${modules.length} ${modules.length === 1 ? 'EXPERIMENT' : 'EXPERIMENTS'}`,
            contentWidth,
            24,
            11,
            palette.subtle,
            centerX,
            top - (compact ? 82 : 98),
            HorizontalTextAlignment.LEFT,
        );

        this.renderRows(
            root,
            modules,
            viewport,
            centerX,
            contentWidth,
            top - (compact ? 116 : 134),
        );
    }

    private renderRows(
        root: Node,
        modules: readonly ModuleDefinition[],
        viewport: ViewportSnapshot,
        centerX: number,
        contentWidth: number,
        rowsTop: number,
    ): void {
        const compact = viewport.breakpoint === 'compact';
        const rowHeight = compact ? 142 : 154;
        const gap = 12;
        const rowsBottom = -viewport.height / 2 + viewport.safeInsets.bottom + 56;
        const availableHeight = Math.max(rowHeight, rowsTop - rowsBottom);
        const pageSize = Math.max(1, Math.floor((availableHeight + gap) / (rowHeight + gap)));
        const pageCount = Math.max(1, Math.ceil(modules.length / pageSize));
        this.page = Math.min(this.page, pageCount - 1);
        const visible = modules.slice(this.page * pageSize, (this.page + 1) * pageSize);

        for (let index = 0; index < visible.length; index += 1) {
            const y = rowsTop - rowHeight / 2 - index * (rowHeight + gap);
            this.renderModuleRow(root, visible[index], contentWidth, rowHeight, centerX, y, compact);
        }

        if (pageCount > 1) {
            const y = rowsBottom - 16;
            createButton(root, {
                name: 'LaboratoryCatalogPrevious',
                text: '←',
                width: 42,
                height: 34,
                x: centerX - 52,
                y,
                variant: 'secondary',
                onPress: () => {
                    this.page = (this.page - 1 + pageCount) % pageCount;
                    this.render(viewport);
                },
            });
            createLabel(root, `${this.page + 1} / ${pageCount}`, 54, 34, 12, palette.muted, centerX, y);
            createButton(root, {
                name: 'LaboratoryCatalogNext',
                text: '→',
                width: 42,
                height: 34,
                x: centerX + 52,
                y,
                variant: 'secondary',
                onPress: () => {
                    this.page = (this.page + 1) % pageCount;
                    this.render(viewport);
                },
            });
        }
    }

    private renderModuleRow(
        root: Node,
        definition: ModuleDefinition,
        width: number,
        height: number,
        x: number,
        y: number,
        compact: boolean,
    ): void {
        const row = createUiNode(root, `ModuleRow:${definition.id}`, width, height, x, y);
        fillNode(row, width, height, palette.surface, 8);
        strokeNode(row, width, height, palette.border, 8, 1);

        const innerWidth = width - 36;
        const leftX = -width / 2 + 18 + innerWidth / 2;

        createLabel(
            row,
            definition.title,
            innerWidth - 116,
            38,
            compact ? 22 : 25,
            palette.text,
            leftX - 58,
            height / 2 - 34,
            HorizontalTextAlignment.LEFT,
        );
        createLabel(
            row,
            definition.description,
            innerWidth - 116,
            compact ? 50 : 54,
            compact ? 13 : 14,
            palette.muted,
            leftX - 58,
            4,
            HorizontalTextAlignment.LEFT,
        );
        createLabel(
            row,
            definition.tags?.join(' · ').toUpperCase() ?? '',
            innerWidth - 116,
            24,
            10,
            palette.subtle,
            leftX - 58,
            -height / 2 + 24,
            HorizontalTextAlignment.LEFT,
        );
        createButton(row, {
            name: `Open:${definition.id}`,
            text: 'OPEN →',
            width: 96,
            height: 38,
            x: width / 2 - 66,
            y: 0,
            fontSize: 12,
            variant: 'primary',
            onPress: () => {
                void this.context?.open(definition.id);
            },
        });
    }
}
