import {
    Color,
    Graphics,
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
        const barHeight = compact ? 54 : 60;
        const contentWidth = width - safeInsets.left - safeInsets.right;
        const centerX = (safeInsets.left - safeInsets.right) / 2;

        // Creator Browser Preview reveals an external toolbar when the pointer
        // reaches the top edge. Keep app navigation at one stable canvas
        // coordinate instead of following that toolbar or safe-area changes.
        const fixedTopOffset = compact ? 64 : 68;
        const y = height / 2 - fixedTopOffset - barHeight / 2;

        this.root.setPosition(centerX, y, 0);
        resizeNode(this.root, contentWidth, barHeight);
        fillNode(this.root, contentWidth, barHeight, palette.background);
        this.drawDivider(contentWidth, barHeight);

        const sidePadding = compact ? 12 : 22;
        const backWidth = compact ? 46 : 64;
        this.createTextAction(
            'NavigationBack',
            '←',
            backWidth,
            barHeight,
            -contentWidth / 2 + sidePadding + backWidth / 2,
            0,
            compact ? 23 : 20,
            state.handlers.onBack,
        );

        const actionWidth = compact ? 48 : 68;
        const actionGap = compact ? 2 : 6;
        const hasPause = state.capabilities.includes('pause');
        const hasReset = state.capabilities.includes('reset');
        let rightCursor = contentWidth / 2 - sidePadding;

        if (hasReset && state.handlers.onReset) {
            rightCursor -= actionWidth / 2;
            this.createTextAction(
                'NavigationReset',
                compact ? 'R' : 'RESET',
                actionWidth,
                barHeight,
                rightCursor,
                0,
                compact ? 13 : 11,
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
                barHeight,
                rightCursor,
                0,
                compact ? 16 : 11,
                state.handlers.onTogglePause,
                state.paused ? new Color(45, 92, 214, 255) : palette.muted,
            );
        }

        const leftBoundary = -contentWidth / 2 + sidePadding + backWidth + 8;
        const rightBoundary = Math.min(contentWidth / 2 - sidePadding, rightCursor - actionWidth / 2 - 8);
        const titleWidth = Math.max(80, rightBoundary - leftBoundary);
        const titleX = leftBoundary + titleWidth / 2;

        createLabel(
            this.root,
            state.title,
            titleWidth,
            barHeight,
            compact ? 13 : 14,
            palette.muted,
            titleX,
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

    private drawDivider(width: number, height: number): void {
        const line = createUiNode(this.root, 'NavigationDivider', width, 2, 0, -height / 2 + 1);
        const graphics = line.addComponent(Graphics);
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1;
        graphics.moveTo(-width / 2, 0);
        graphics.lineTo(width / 2, 0);
        graphics.stroke();
    }
}
