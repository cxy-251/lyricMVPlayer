import {
    BlockInputEvents,
    Color,
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
    createUiNode,
    nativeTheme,
    resizeNode,
} from '../ui/UiFactory';

interface NavigationHandlers {
    readonly onBack: () => void;
    readonly onTogglePause?: () => void;
    readonly onReset?: () => void;
}

interface NavigationState {
    readonly labId: 'mathematics' | 'physics' | 'games' | null;
    readonly title: string;
    readonly capabilities: readonly ModuleCapability[];
    readonly paused: boolean;
    readonly handlers: NavigationHandlers;
}

export class NavigationBar {
    private readonly root: Node;
    private state: NavigationState | null = null;
    private viewport: ViewportSnapshot;
    private backPending = false;
    private readonly unsubscribeViewport: () => void;

    constructor(
        host: Node,
        viewportService: ViewportService,
    ) {
        this.root = createUiNode(host, 'NavigationBarRoot', 1, 1);
        this.viewport = viewportService.current;
        this.root.getComponent(BlockInputEvents)
            ?? this.root.addComponent(BlockInputEvents);
        this.unsubscribeViewport = viewportService.subscribe((snapshot) => {
            this.viewport = snapshot;
            this.render();
        });
        this.showHome();
    }

    showHome(): void {
        this.state = null;
        this.backPending = false;
        clearNode(this.root);
        this.root.active = false;
    }

    showLab(lab: LabDefinition, onBack: () => void): void {
        this.state = {
            labId: lab.id,
            title: lab.title,
            capabilities: [],
            paused: false,
            handlers: { onBack },
        };
        this.backPending = false;
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
            labId: parentLab?.id ?? null,
            title: definition.title,
            capabilities: definition.capabilities ?? [],
            paused,
            handlers,
        };
        this.backPending = false;
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
        this.state = null;
        this.backPending = false;
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
        const theme = this.themeFor(state.labId);
        const backX = -contentWidth / 2 + sidePadding + controlSize / 2;
        createIconButton(this.root, {
            name: 'NavigationBack',
            icon: 'back',
            x: backX,
            colors: theme.controls,
            onPress: () => this.requestBack(state),
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
                colors: theme.controls,
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
                colors: theme.controls,
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
            theme.label,
            titleLeft + titleWidth / 2,
            0,
            HorizontalTextAlignment.LEFT,
        );
    }

    private themeFor(labId: NavigationState['labId']): {
        readonly label: Color;
        readonly controls?: {
            readonly control: Color;
            readonly hover: Color;
            readonly selected: Color;
            readonly border: Color;
            readonly borderStrong: Color;
            readonly icon: Color;
            readonly selectedIcon: Color;
        };
    } {
        if (labId === 'mathematics') {
            return {
                label: new Color(157, 154, 184, 255),
                controls: {
                    control: new Color(31, 29, 57, 255),
                    hover: new Color(46, 43, 78, 255),
                    selected: new Color(65, 48, 75, 255),
                    border: new Color(75, 70, 113, 255),
                    borderStrong: new Color(79, 214, 226, 255),
                    icon: new Color(242, 237, 225, 255),
                    selectedIcon: new Color(255, 108, 105, 255),
                },
            };
        }
        if (labId === 'physics') {
            return {
                label: new Color(171, 161, 140, 255),
                controls: {
                    control: new Color(42, 38, 28, 255),
                    hover: new Color(58, 48, 30, 255),
                    selected: new Color(75, 47, 28, 255),
                    border: new Color(92, 76, 45, 255),
                    borderStrong: new Color(255, 177, 59, 255),
                    icon: new Color(241, 232, 210, 255),
                    selectedIcon: new Color(228, 86, 60, 255),
                },
            };
        }
        return { label: nativeTheme.muted };
    }

    private requestBack(state: NavigationState): void {
        if (this.backPending || this.state !== state) {
            return;
        }

        this.backPending = true;
        try {
            state.handlers.onBack();
        } catch (error) {
            this.backPending = false;
            throw error;
        }
    }
}
