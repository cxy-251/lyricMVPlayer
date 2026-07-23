import {
    HorizontalTextAlignment,
    Node,
} from 'cc';
import type {
    InteractiveModule,
    ModuleContext,
    ModuleDefinition,
} from '../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../services/ViewportService';
import {
    clearNode,
    createLabel,
    createPill,
    createUiNode,
    fillNode,
    palette,
    strokeNode,
} from '../../ui/UiFactory';

class SystemCheckModule implements InteractiveModule {
    private root: Node | null = null;
    private unsubscribeViewport: (() => void) | null = null;

    mount(context: ModuleContext): void {
        const viewport = context.viewport.current;
        this.root = createUiNode(context.host, 'SystemCheck', viewport.width, viewport.height);
        this.unsubscribeViewport = context.viewport.subscribe((snapshot) => {
            this.render(snapshot);
        });
    }

    unmount(): void {
        this.unsubscribeViewport?.();
        this.unsubscribeViewport = null;
        this.root?.destroy();
        this.root = null;
    }

    private render(viewport: ViewportSnapshot): void {
        const root = this.root;

        if (!root) {
            return;
        }

        clearNode(root);
        fillNode(root, viewport.width, viewport.height, palette.background);

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = Math.max(
            1,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const safeHeight = Math.max(
            1,
            viewport.height - viewport.safeInsets.top - viewport.safeInsets.bottom,
        );
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const centerY = (viewport.safeInsets.bottom - viewport.safeInsets.top) / 2;
        const panelWidth = Math.max(
            1,
            Math.min(compact ? 560 : 820, safeWidth - (compact ? 24 : 48)),
        );
        const panelHeight = Math.max(
            1,
            Math.min(compact ? 440 : 480, safeHeight - (compact ? 24 : 48)),
        );
        const narrow = compact || panelWidth < 520;
        const radius = Math.min(22, panelWidth / 2, panelHeight / 2);
        const panel = createUiNode(
            root,
            'ArchitecturePanel',
            panelWidth,
            panelHeight,
            centerX,
            centerY,
        );
        fillNode(panel, panelWidth, panelHeight, palette.surface, radius);
        strokeNode(panel, panelWidth, panelHeight, palette.border, radius, 1.5);

        const headerSpace = Math.min(180, panelHeight * 0.42);
        const pillY = panelHeight / 2 - Math.min(32, headerSpace * 0.18);
        const titleY = panelHeight / 2 - Math.min(84, headerSpace * 0.47);
        const descriptionY = panelHeight / 2 - Math.min(132, headerSpace * 0.74);

        if (panelWidth >= 120 && panelHeight >= 80) {
            createPill(panel, 'runtime', 88, -panelWidth / 2 + 62, pillY, true);
        }
        createLabel(
            panel,
            'APPLICATION ARCHITECTURE',
            Math.max(1, panelWidth - 48),
            52,
            narrow ? 24 : 34,
            palette.text,
            0,
            titleY,
        );
        createLabel(
            panel,
            'The active scene is only the host. Application services and works are managed independently.',
            Math.max(1, panelWidth - 70),
            64,
            narrow ? 13 : 16,
            palette.muted,
            0,
            descriptionY,
        );

        const checks = [
            ['APP SHELL', 'Content, navigation and overlay layers are isolated.'],
            ['MODULE HOST', 'Mount, update, pause, reset and unmount are centralized.'],
            ['RESPONSIVE UI', 'Viewport, orientation and safe-area changes propagate.'],
            ['APP SERVICES', 'Input, storage and application state use shared interfaces.'],
            ['CLEAN EXIT', 'A module owns and releases its runtime node tree.'],
        ] as const;
        const listHeight = Math.max(1, panelHeight - headerSpace - 24);
        const rowHeight = listHeight / checks.length;
        const listTop = panelHeight / 2 - headerSpace - rowHeight / 2;
        const titleWidth = narrow ? 112 : 150;
        const leftPadding = narrow ? 24 : 40;
        const titleCenterX = -panelWidth / 2 + leftPadding + titleWidth / 2 + 12;
        const descriptionLeft = titleCenterX + titleWidth / 2 + 12;
        const descriptionWidth = Math.max(
            1,
            panelWidth / 2 - 24 - descriptionLeft,
        );

        for (let index = 0; index < checks.length; index += 1) {
            const [title, description] = checks[index];
            const y = listTop - index * rowHeight;
            const dot = createUiNode(
                panel,
                `Check:${title}`,
                10,
                10,
                -panelWidth / 2 + leftPadding,
                y,
            );
            fillNode(dot, 10, 10, palette.primary, 5);
            createLabel(
                panel,
                title,
                titleWidth,
                Math.max(1, rowHeight),
                narrow ? 11 : 13,
                palette.primary,
                titleCenterX,
                y,
                HorizontalTextAlignment.LEFT,
            );
            createLabel(
                panel,
                description,
                descriptionWidth,
                Math.max(1, rowHeight),
                narrow ? 12 : 15,
                palette.text,
                descriptionLeft + descriptionWidth / 2,
                y,
                HorizontalTextAlignment.LEFT,
            );
        }
    }
}

export const systemCheckDefinition: ModuleDefinition = {
    id: 'architecture-check',
    title: 'Architecture Check',
    description: 'Inspect the live application shell and managed module lifecycle.',
    category: 'system',
    tags: ['shell', 'lifecycle', 'services'],
    status: 'ready',
    order: 900,
    create: () => new SystemCheckModule(),
};
