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
    createButton,
    createLabel,
    createUiNode,
    fillNode,
    palette,
    strokeNode,
} from '../../ui/UiFactory';

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

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const contentWidth = Math.min(1080, safeWidth - (compact ? 32 : 72));
        const left = centerX - contentWidth / 2;
        const top = viewport.height / 2 - viewport.safeInsets.top - (compact ? 42 : 62);

        createLabel(
            root,
            'COCOS LAB',
            contentWidth,
            24,
            12,
            palette.subtle,
            centerX,
            top,
            HorizontalTextAlignment.LEFT,
        );
        createLabel(
            root,
            'Laboratories',
            contentWidth,
            compact ? 52 : 70,
            compact ? 38 : 52,
            palette.text,
            centerX,
            top - (compact ? 42 : 54),
            HorizontalTextAlignment.LEFT,
        );
        createLabel(
            root,
            'Choose a field, then open a working experiment.',
            contentWidth,
            34,
            compact ? 14 : 16,
            palette.muted,
            centerX,
            top - (compact ? 86 : 108),
            HorizontalTextAlignment.LEFT,
        );

        const labs = this.registry.labs();
        const columns = compact ? 1 : Math.min(2, labs.length);
        const gap = compact ? 14 : 18;
        const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
        const cardHeight = compact ? 176 : 194;
        const cardsTop = top - (compact ? 126 : 156);

        for (let index = 0; index < labs.length; index += 1) {
            const row = Math.floor(index / columns);
            const column = index % columns;
            const x = left + cardWidth / 2 + column * (cardWidth + gap);
            const y = cardsTop - cardHeight / 2 - row * (cardHeight + gap);
            this.renderLabCard(root, labs[index], index, cardWidth, cardHeight, x, y, compact);
        }
    }

    private renderLabCard(
        root: Node,
        lab: LabDefinition,
        index: number,
        width: number,
        height: number,
        x: number,
        y: number,
        compact: boolean,
    ): void {
        const modules = this.registry.listByLab(lab.id);
        const card = createUiNode(root, `LaboratoryCard:${lab.id}`, width, height, x, y);
        fillNode(card, width, height, palette.surface, 8);
        strokeNode(card, width, height, palette.border, 8, 1);

        const innerWidth = width - 36;
        const leftX = -width / 2 + 18 + innerWidth / 2;

        createLabel(
            card,
            String(index + 1).padStart(2, '0'),
            innerWidth,
            24,
            11,
            palette.subtle,
            leftX,
            height / 2 - 24,
            HorizontalTextAlignment.LEFT,
        );
        createLabel(
            card,
            lab.title,
            innerWidth,
            42,
            compact ? 23 : 27,
            palette.text,
            leftX,
            height / 2 - 60,
            HorizontalTextAlignment.LEFT,
        );
        createLabel(
            card,
            lab.description,
            innerWidth,
            48,
            compact ? 13 : 14,
            palette.muted,
            leftX,
            height / 2 - 102,
            HorizontalTextAlignment.LEFT,
        );
        createLabel(
            card,
            `${modules.length} ${modules.length === 1 ? 'experiment' : 'experiments'}  ·  ${modules[0].title}`,
            Math.max(100, width - 150),
            28,
            11,
            palette.subtle,
            -52,
            -height / 2 + 28,
            HorizontalTextAlignment.LEFT,
        );
        createButton(card, {
            name: `OpenLaboratory:${lab.id}`,
            text: 'OPEN →',
            width: 96,
            height: 36,
            x: width / 2 - 66,
            y: -height / 2 + 28,
            fontSize: 12,
            variant: 'primary',
            onPress: () => {
                void this.context?.openLab(lab.id);
            },
        });
    }
}
