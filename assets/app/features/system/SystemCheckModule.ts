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
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const panelWidth = Math.min(compact ? 560 : 820, safeWidth - (compact ? 28 : 64));
        const panelHeight = Math.min(compact ? 440 : 480, viewport.height - 150);
        const panelY = -18;
        const panel = createUiNode(root, 'ArchitecturePanel', panelWidth, panelHeight, centerX, panelY);
        fillNode(panel, panelWidth, panelHeight, palette.surface, 22);
        strokeNode(panel, panelWidth, panelHeight, palette.border, 22, 1.5);

        createPill(panel, 'runtime', 88, -panelWidth / 2 + 62, panelHeight / 2 - 32, true);
        createLabel(
            panel,
            'APPLICATION ARCHITECTURE',
            panelWidth - 48,
            52,
            compact ? 26 : 34,
            palette.text,
            0,
            panelHeight / 2 - 84,
        );
        createLabel(
            panel,
            'The active scene is only the host. Application services and works are managed independently.',
            panelWidth - 70,
            64,
            compact ? 14 : 16,
            palette.muted,
            0,
            panelHeight / 2 - 132,
        );

        const checks = [
            ['APP SHELL', 'Content, navigation and overlay layers are isolated.'],
            ['MODULE HOST', 'Mount, update, pause, reset and unmount are centralized.'],
            ['RESPONSIVE UI', 'Viewport, orientation and safe-area changes propagate.'],
            ['APP SERVICES', 'Input, storage and application state use shared interfaces.'],
            ['CLEAN EXIT', 'A module owns and releases its runtime node tree.'],
        ] as const;
        const rowHeight = compact ? 56 : 60;
        const listTop = panelHeight / 2 - 190;

        for (let index = 0; index < checks.length; index += 1) {
            const [title, description] = checks[index];
            const y = listTop - index * rowHeight;
            const dot = createUiNode(panel, `Check:${title}`, 10, 10, -panelWidth / 2 + 40, y + 2);
            fillNode(dot, 10, 10, palette.primary, 5);
            createLabel(
                panel,
                title,
                compact ? 118 : 150,
                28,
                compact ? 12 : 13,
                palette.primary,
                -panelWidth / 2 + (compact ? 112 : 132),
                y + 13,
                HorizontalTextAlignment.LEFT,
            );
            createLabel(
                panel,
                description,
                panelWidth - (compact ? 92 : 104),
                34,
                compact ? 13 : 15,
                palette.text,
                30,
                y - 11,
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
