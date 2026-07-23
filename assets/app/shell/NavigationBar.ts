import { Node } from 'cc';
import type {
    LabDefinition,
    ModuleCapability,
    ModuleDefinition,
} from '../contracts/InteractiveModule';
import type { ViewportService, ViewportSnapshot } from '../services/ViewportService';
import { clearNode } from '../ui/UiFactory';
import {
    clearWebUiScope,
    createWebIconButton,
    getWebUiScope,
} from '../ui/WebUiKit';

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

const NAVIGATION_SCOPE = 'navigation';

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
        clearWebUiScope(NAVIGATION_SCOPE);
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
        clearWebUiScope(NAVIGATION_SCOPE);
    }

    private render(): void {
        const state = this.state;

        if (!state) {
            clearWebUiScope(NAVIGATION_SCOPE);
            return;
        }

        clearNode(this.root);
        const scope = getWebUiScope(NAVIGATION_SCOPE);

        if (!scope) {
            return;
        }

        const { width, breakpoint, safeInsets } = this.viewport;
        const compact = breakpoint === 'compact';
        const sidePadding = compact ? 10 : 18;
        const topMargin = compact ? 10 : 14;
        const navigation = document.createElement('div');
        navigation.className = 'cocoslab-navigation';
        navigation.style.left = `${safeInsets.left + sidePadding}px`;
        navigation.style.right = `${safeInsets.right + sidePadding}px`;
        navigation.style.top = `${safeInsets.top + topMargin}px`;
        navigation.style.width = `${Math.max(1, width - safeInsets.left - safeInsets.right - sidePadding * 2)}px`;
        navigation.style.height = '44px';

        createWebIconButton({
            parent: navigation,
            icon: 'arrow-left',
            label: 'Back',
            onPress: state.handlers.onBack,
        });

        const title = document.createElement('div');
        title.className = 'cocoslab-navigation-title';
        title.textContent = state.title;
        navigation.appendChild(title);

        const spacer = document.createElement('div');
        spacer.className = 'cocoslab-navigation-spacer';
        navigation.appendChild(spacer);

        if (state.capabilities.includes('pause') && state.handlers.onTogglePause) {
            createWebIconButton({
                parent: navigation,
                icon: state.paused ? 'play' : 'pause',
                label: state.paused ? 'Resume' : 'Pause',
                selected: state.paused,
                onPress: state.handlers.onTogglePause,
            });
        }

        if (state.capabilities.includes('reset') && state.handlers.onReset) {
            createWebIconButton({
                parent: navigation,
                icon: 'rotate-left',
                label: 'Reset',
                onPress: state.handlers.onReset,
            });
        }

        scope.appendChild(navigation);
    }
}
