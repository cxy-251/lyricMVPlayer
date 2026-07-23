import {
    Color,
    Graphics,
    HorizontalTextAlignment,
    Node,
} from 'cc';
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
    createPill,
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
        root.setPosition(0, 0, 0);
        fillNode(root, viewport.width, viewport.height, palette.background);
        this.drawDecoration(root, viewport.width, viewport.height);

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const titleY = viewport.height / 2 - viewport.safeInsets.top - (compact ? 54 : 72);

        createLabel(
            root,
            'COCOS LAB',
            Math.min(760, safeWidth - 32),
            compact ? 54 : 70,
            compact ? 38 : 54,
            palette.text,
            centerX,
            titleY,
        );
        createLabel(
            root,
            'Choose a laboratory built from working interactive modules',
            Math.min(900, safeWidth - 40),
            38,
            compact ? 14 : 18,
            palette.muted,
            centerX,
            titleY - (compact ? 48 : 60),
        );

        const labs = this.registry.labs();
        const cardsTop = titleY - (compact ? 104 : 128);
        const columns = compact ? 1 : Math.min(2, labs.length);
        const gap = compact ? 16 : 22;
        const horizontalPadding = compact ? 18 : 42;
        const gridWidth = Math.min(1120, safeWidth - horizontalPadding * 2);
        const cardWidth = (gridWidth - gap * (columns - 1)) / columns;
        const cardHeight = compact ? 210 : 238;

        for (let index = 0; index < labs.length; index += 1) {
            const row = Math.floor(index / columns);
            const column = index % columns;
            const rowCount = Math.min(columns, labs.length - row * columns);
            const rowWidth = cardWidth * rowCount + gap * (rowCount - 1);
            const rowStart = centerX - rowWidth / 2 + cardWidth / 2;
            const x = rowStart + column * (cardWidth + gap);
            const y = cardsTop - cardHeight / 2 - row * (cardHeight + gap);
            this.renderLabCard(root, labs[index], cardWidth, cardHeight, x, y, compact);
        }
    }

    private renderLabCard(
        root: Node,
        lab: LabDefinition,
        width: number,
        height: number,
        x: number,
        y: number,
        compact: boolean,
    ): void {
        const modules = this.registry.listByLab(lab.id);
        const card = createUiNode(root, `LaboratoryCard:${lab.id}`, width, height, x, y);
        fillNode(card, width, height, palette.surface, 22);
        strokeNode(card, width, height, palette.border, 22, 1.5);

        createPill(
            card,
            `${modules.length} ${modules.length === 1 ? 'MODULE' : 'MODULES'}`,
            104,
            -width / 2 + 68,
            height / 2 - 30,
            true,
        );
        createLabel(
            card,
            lab.title,
            width - 38,
            46,
            compact ? 25 : 30,
            palette.text,
            0,
            height / 2 - 78,
            HorizontalTextAlignment.LEFT,
        );
        createLabel(
            card,
            lab.description,
            width - 38,
            compact ? 52 : 58,
            compact ? 14 : 16,
            palette.muted,
            0,
            height / 2 - 126,
            HorizontalTextAlignment.LEFT,
        );

        const moduleNames = modules.map((definition) => definition.title).join('  ·  ');
        createLabel(
            card,
            moduleNames,
            width - 150,
            42,
            compact ? 12 : 13,
            palette.subtle,
            -54,
            -height / 2 + 34,
            HorizontalTextAlignment.LEFT,
        );
        createButton(card, {
            name: `OpenLaboratory:${lab.id}`,
            text: 'ENTER',
            width: 98,
            height: 42,
            x: width / 2 - 68,
            y: -height / 2 + 34,
            fontSize: 13,
            onPress: () => {
                void this.context?.openLab(lab.id);
            },
        });
    }

    private drawDecoration(parent: Node, width: number, height: number): void {
        const decoration = createUiNode(parent, 'LaboratoryDecoration', width, height);
        const radiusLimit = Math.min(width, height) * 0.62;
        const ringsNode = createUiNode(decoration, 'LaboratoryRings', width, height);
        const rings = ringsNode.addComponent(Graphics);
        rings.strokeColor = new Color(42, 55, 78, 80);
        rings.lineWidth = 1.5;

        for (let radius = 100; radius <= radiusLimit; radius += 72) {
            rings.circle(width * 0.37, height * 0.28, radius);
        }

        rings.stroke();

        const dotsNode = createUiNode(decoration, 'LaboratoryDots', width, height);
        const dots = dotsNode.addComponent(Graphics);
        dots.fillColor = new Color(255, 92, 142, 120);

        for (let index = 0; index < 18; index += 1) {
            const angle = (Math.PI * 2 * index) / 18;
            const radius = Math.min(width, height) * 0.36;
            dots.circle(
                width * 0.37 + Math.cos(angle) * radius,
                height * 0.28 + Math.sin(angle) * radius,
                2 + (index % 3),
            );
        }

        dots.fill();
    }
}
