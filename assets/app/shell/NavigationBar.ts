import {
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
    createLabel,
    createUiNode,
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
        const controlHeight = compact ? 42 : 44;
        const topMargin = compact ? 10 : 14;
        const contentWidth = width - safeInsets.left - safeInsets.right;
        const centerX = (safeInsets.left - safeInsets.right) / 2;
        const y = height / 2 - safeInsets.top - topMargin - controlHeight / 2;

        this.root.setPosition(centerX, y, 0);
        resizeNode(this.root, contentWidth, controlHeight);

        const sidePadding = compact ? 10 : 18;
        const backWidth = compact ? 42 : 46;
        const backX = -contentWidth / 2 + sidePadding + backWidth / 2;

        this.createTextAction(
            'NavigationBack',
            '←',
            backWidth,
            controlHeight,
            backX,
            0,
            compact ? 22 : 20,
            state.handlers.onBack,
        );

        const actionWidth = compact ? 46 : 58;
        const actionGap = compact ? 4 : 8;
        const hasPause = state.capabilities.includes('pause');
        const hasReset = state.capabilities.includes('reset');
        let rightCursor = contentWidth / 2 - sidePadding;

        if (hasReset && state.handlers.onReset) {
            rightCursor -= actionWidth / 2;
            this.createTextAction(
                'NavigationReset',
                compact ? 'R' : 'RESET',
                actionWidth,
                controlHeight,
                rightCursor,
                0,
                compact ? 12 : 10,
                state.handlers.onReset,
            );
            rightCursor -= actionWidth / 2 + actionGap;
        }

        if (hasPause && state.handlers.onTogglePause) {
            rightCursor -= actionWidth / 2;
            this.createTextAction(
                'NavigationPause',
                compact ? (state.paused ? '▶' : 'Ⅱ') : (state.paused ? 'PLAY' : 'PAUSE'),
                actionWidth,
                controlHeight,
                rightCursor,
                0,
                compact ? 15 : 10,
                state.handlers.onTogglePause,
                state.paused ? new Color(45, 92, 214, 255) : palette.muted,
            );
        }

        const titleLeft = backX + backWidth / 2 + (compact ? 4 : 8);
        const titleRight = hasPause || hasReset
            ? rightCursor - actionWidth / 2 - 12
            : contentWidth / 2 - sidePadding;
        const titleWidth = Math.max(80, titleRight - titleLeft);

        createLabel(
            this.root,
            state.title,
            titleWidth,
            controlHeight,
            compact ? 12 : 13,
            palette.muted,
            titleLeft + titleWidth / 2,
            0,
            HorizontalTextAlignment.LEFT,
        );
    }

    private createTextAction(
        name: string,
        text: string,
        width: number,
        height: number,
        x: number,
        y: number,
        fontSize: number,
        onPress: () => void,
        color = palette.text,
    ): Node {
        const action = createUiNode(this.root, name, width, height, x, y);
        createLabel(action, text, width, height, fontSize, color);
        action.on(Node.EventType.TOUCH_END, onPress);
        return action;
    }
}
