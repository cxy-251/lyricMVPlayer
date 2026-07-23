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
            subtitle: 'LABORATORY',
            backLabel: 'HOME',
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
            subtitle: parentLab?.title ?? definition.category.toUpperCase(),
            backLabel: parentLab ? 'LAB' : 'HOME',
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
        const barHeight = compact ? 68 : 76;
        const contentWidth = width - safeInsets.left - safeInsets.right;
        const centerX = (safeInsets.left - safeInsets.right) / 2;
        const y = height / 2 - safeInsets.top - barHeight / 2;

        this.root.setPosition(centerX, y, 0);
        resizeNode(this.root, contentWidth, barHeight);
        fillNode(this.root, contentWidth, barHeight, palette.backgroundRaised);

        createButton(this.root, {
            name: 'NavigationBack',
            text: compact ? '←' : `← ${state.backLabel}`,
            width: compact ? 56 : 118,
            height: 44,
            x: -contentWidth / 2 + (compact ? 38 : 70),
            variant: 'ghost',
            fontSize: compact ? 26 : 16,
            onPress: state.handlers.onBack,
        });

        const actionWidth = compact ? 52 : 94;
        const actionGap = compact ? 10 : 12;
        const hasPause = state.capabilities.includes('pause');
        const hasReset = state.capabilities.includes('reset');
        let rightCursor = contentWidth / 2 - 18;

        if (hasReset && state.handlers.onReset) {
            rightCursor -= actionWidth / 2;
            createButton(this.root, {
                name: 'NavigationReset',
                text: compact ? 'R' : 'RESET',
                width: actionWidth,
                height: 44,
                x: rightCursor,
                variant: 'secondary',
                fontSize: compact ? 16 : 14,
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
                height: 44,
                x: rightCursor,
                variant: state.paused ? 'primary' : 'secondary',
                fontSize: compact ? 19 : 14,
                onPress: state.handlers.onTogglePause,
            });
        }

        const leftBoundary = -contentWidth / 2 + (compact ? 78 : 142);
        const titleRightBoundary = rightCursor - actionWidth / 2 - 12;
        const titleWidth = Math.max(120, titleRightBoundary - leftBoundary);
        const titleX = leftBoundary + titleWidth / 2;

        createLabel(
            this.root,
            state.title,
            titleWidth,
            34,
            compact ? 18 : 22,
            palette.text,
            titleX,
            compact ? 0 : 10,
            HorizontalTextAlignment.LEFT,
        );

        if (!compact) {
            createLabel(
                this.root,
                state.subtitle.toUpperCase(),
                titleWidth,
                22,
                11,
                palette.muted,
                titleX,
                -18,
                HorizontalTextAlignment.LEFT,
            );
        }
    }
}
