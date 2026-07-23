import { HorizontalTextAlignment, Node } from 'cc';
import type {
    LabDefinition,
    ModuleCapability,
    ModuleDefinition,
} from '../contracts/InteractiveModule';
import type { ViewportService, ViewportSnapshot } from '../services/ViewportService';
import {
    clearNode,
    createButton,
    createLabel,
    createUiNode,
    fillNode,
    palette,
    resizeNode,
} from '../ui/UiFactory';

interface NavigationHandlers {
    readonly onBack: () => void;
    readonly onTogglePause?: () => void;
    readonly onReset?: () => void;
}

interface NavigationState {
    readonly title: string;
    readonly subtitle: string;
    readonly backLabel: string;
    readonly capabilities: readonly ModuleCapability[];
    readonly paused: boolean;
    readonly handlers: NavigationHandlers;
}

export class NavigationBar {
    private state: NavigationState | null = null;
    private viewport: ViewportSnapshot;
    private readonly unsubscribeViewport: () => void;

    constructor(
        private readonly root: Node,
        viewportService: ViewportService,
    ) {
        this.viewport = viewportService.current;
        this.unsubscribeViewport = viewportService.subscribe((snapshot) => {
            this.viewport = snapshot;
            this.render();
        });
        this.showHome();
    }

    showHome(): void {
        this.state = null;
        clearNode(this.root);
        this.root.active = false;
    }

    showLab(lab: LabDefinition, onBack: () => void): void {
        this.state = {
            title: lab.title,
            subtitle: 'Laboratory',
            backLabel: 'Home',
            capabilities: [],
            paused: false,
            handlers: { onBack },
        };
        this.root.active = true;
        this.render();
    }

    showModule(
        definition: ModuleDefinition,
        parentLab: LabDefinition | null,
        handlers: NavigationHandlers,
        paused: boolean,
    ): void {
        this.state = {
            title: definition.title,
            subtitle: parentLab?.title ?? definition.category,
            backLabel: parentLab ? 'Laboratory' : 'Home',
            capabilities: definition.capabilities ?? [],
            paused,
            handlers,
        };
        this.root.active = true;
        this.render();
    }

    setPaused(paused: boolean): void {
        if (!this.state || this.state.paused === paused) {
            return;
        }

        this.state = { ...this.state, paused };
        this.render();
    }

    dispose(): void {
        this.unsubscribeViewport();
        clearNode(this.root);
    }

    private render(): void {
        const state = this.state;

        if (!state) {
            return;
        }

        clearNode(this.root);

        const { width, height, breakpoint, safeInsets } = this.viewport;
        const compact = breakpoint === 'compact';
        const barHeight = compact ? 60 : 66;
        const contentWidth = width - safeInsets.left - safeInsets.right;
        const centerX = (safeInsets.left - safeInsets.right) / 2;
        const y = height / 2 - safeInsets.top - barHeight / 2;

        this.root.setPosition(centerX, y, 0);
        resizeNode(this.root, contentWidth, barHeight);
        fillNode(this.root, contentWidth, barHeight, palette.backgroundRaised);
        const divider = createUiNode(this.root, 'NavigationDivider', contentWidth, 1, 0, -barHeight / 2 + 0.5);
        fillNode(divider, contentWidth, 1, palette.border);

        createButton(this.root, {
            name: 'NavigationBack',
            text: compact ? '←' : `← ${state.backLabel}`,
            width: compact ? 44 : 112,
            height: 36,
            x: -contentWidth / 2 + (compact ? 28 : 64),
            variant: 'ghost',
            fontSize: compact ? 22 : 13,
            onPress: state.handlers.onBack,
        });

        const actionWidth = compact ? 44 : 82;
        const actionGap = 8;
        const hasPause = state.capabilities.includes('pause');
        const hasReset = state.capabilities.includes('reset');
        let rightCursor = contentWidth / 2 - 14;

        if (hasReset && state.handlers.onReset) {
            rightCursor -= actionWidth / 2;
            createButton(this.root, {
                name: 'NavigationReset',
                text: compact ? 'R' : 'RESET',
                width: actionWidth,
                height: 34,
                x: rightCursor,
                variant: 'secondary',
                fontSize: compact ? 13 : 11,
                onPress: state.handlers.onReset,
            });
            rightCursor -= actionWidth / 2 + actionGap;
        }

        if (hasPause && state.handlers.onTogglePause) {
            rightCursor -= actionWidth / 2;
            createButton(this.root, {
                name: 'NavigationPause',
                text: compact ? (state.paused ? '▶' : 'Ⅱ') : (state.paused ? 'RESUME' : 'PAUSE'),
                width: actionWidth,
                height: 34,
                x: rightCursor,
                variant: state.paused ? 'primary' : 'secondary',
                fontSize: compact ? 15 : 11,
                onPress: state.handlers.onTogglePause,
            });
        }

        const leftBoundary = -contentWidth / 2 + (compact ? 58 : 126);
        const rightBoundary = rightCursor - actionWidth / 2 - 12;
        const titleWidth = Math.max(100, rightBoundary - leftBoundary);
        const titleX = leftBoundary + titleWidth / 2;

        createLabel(
            this.root,
            state.title,
            titleWidth,
            28,
            compact ? 16 : 18,
            palette.text,
            titleX,
            compact ? 0 : 7,
            HorizontalTextAlignment.LEFT,
        );

        if (!compact) {
            createLabel(
                this.root,
                state.subtitle,
                titleWidth,
                18,
                10,
                palette.subtle,
                titleX,
                -14,
                HorizontalTextAlignment.LEFT,
            );
        }
    }
}
