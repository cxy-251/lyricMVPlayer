import {
    HorizontalTextAlignment,
    Node,
} from 'cc';
import type {
    LabDefinition,
    ModuleCapability,
    ModuleDefinition,
} from '../contracts/InteractiveModule';
import type { ViewportService, ViewportSnapshot } from '../services/ViewportService';
import {
    clearNode,
    createIconButton,
    createLabel,
    nativeTheme,
    resizeNode,
} from '../ui/UiFactory';

interface NavigationHandlers {
    readonly onBack: () => void;
    readonly onTogglePause?: () => void;
    readonly onReset?: () => void;
}

interface NavigationState {
    readonly title: string;
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
            capabilities: [],
            paused: false,
            handlers: { onBack },
        };
        this.root.active = true;
        this.render();
    }

    showModule(
        definition: ModuleDefinition,
        _parentLab: LabDefinition | null,
        handlers: NavigationHandlers,
        paused: boolean,
    ): void {
        this.state = {
            title: definition.title,
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
        const controlSize = 44;
        const topMargin = compact ? 10 : 14;
        const contentWidth = width - safeInsets.left - safeInsets.right;
        const centerX = (safeInsets.left - safeInsets.right) / 2;
        const y = height / 2 - safeInsets.top - topMargin - controlSize / 2;

        this.root.setPosition(centerX, y, 0);
        resizeNode(this.root, contentWidth, controlSize);

        const sidePadding = compact ? 10 : 18;
        const backX = -contentWidth / 2 + sidePadding + controlSize / 2;
        createIconButton(this.root, {
            name: 'NavigationBack',
            icon: 'back',
            x: backX,
            onPress: state.handlers.onBack,
        });

        const hasPause = state.capabilities.includes('pause');
        const hasReset = state.capabilities.includes('reset');
        const gap = 8;
        let rightCursor = contentWidth / 2 - sidePadding;

        if (hasReset && state.handlers.onReset) {
            rightCursor -= controlSize / 2;
            createIconButton(this.root, {
                name: 'NavigationReset',
                icon: 'reset',
                x: rightCursor,
                onPress: state.handlers.onReset,
            });
            rightCursor -= controlSize / 2 + gap;
        }

        if (hasPause && state.handlers.onTogglePause) {
            rightCursor -= controlSize / 2;
            createIconButton(this.root, {
                name: 'NavigationPause',
                icon: state.paused ? 'play' : 'pause',
                x: rightCursor,
                selected: state.paused,
                onPress: state.handlers.onTogglePause,
            });
        }

        const titleLeft = backX + controlSize / 2 + (compact ? 4 : 8);
        const titleRight = hasPause || hasReset
            ? rightCursor - controlSize / 2 - 12
            : contentWidth / 2 - sidePadding;
        const titleWidth = Math.max(80, titleRight - titleLeft);

        createLabel(
            this.root,
            state.title,
            titleWidth,
            controlSize,
            compact ? 12 : 13,
            nativeTheme.muted,
            titleLeft + titleWidth / 2,
            0,
            HorizontalTextAlignment.LEFT,
        );
    }
}
