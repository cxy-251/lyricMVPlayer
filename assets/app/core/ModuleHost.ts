import { Node } from 'cc';
import type {
    InteractiveModule,
    ModuleContext,
    ModuleDefinition,
} from '../contracts/InteractiveModule';
import {
    isPausable,
    isResettable,
    isUpdatable,
} from '../contracts/InteractiveModule';
import type { InputService } from '../services/InputService';
import type { StorageService } from '../services/StorageService';
import type { ViewportService } from '../services/ViewportService';
import { createUiNode, resizeNode } from '../ui/UiFactory';
import type { AppState } from './AppState';

interface ModuleNavigation {
    open(moduleId: string): Promise<void>;
    home(): Promise<void>;
}

export class ModuleHost {
    private activeModule: InteractiveModule | null = null;
    private activeDefinition: ModuleDefinition | null = null;
    private activeRoot: Node | null = null;
    private manuallyPaused = false;
    private backgroundPaused = false;
    private appliedPaused = false;
    private runtimeFailed = false;
    private readonly unsubscribeViewport: () => void;

    constructor(
        private readonly contentLayer: Node,
        private readonly viewport: ViewportService,
        private readonly storage: StorageService,
        private readonly input: InputService,
        private readonly appState: AppState,
        private readonly onRuntimeError: (error: unknown) => void,
    ) {
        this.unsubscribeViewport = viewport.subscribe((snapshot) => {
            if (this.activeRoot) {
                resizeNode(this.activeRoot, snapshot.width, snapshot.height);
            }
        });
    }

    get definition(): ModuleDefinition | null {
        return this.activeDefinition;
    }

    get paused(): boolean {
        return this.appliedPaused;
    }

    async activate(
        definition: ModuleDefinition,
        module: InteractiveModule,
        navigation: ModuleNavigation,
    ): Promise<void> {
        await this.disposeActive();

        const snapshot = this.viewport.current;
        const root = createUiNode(
            this.contentLayer,
            `ModuleHost:${definition.id}`,
            snapshot.width,
            snapshot.height,
        );

        this.activeDefinition = definition;
        this.activeModule = module;
        this.activeRoot = root;
        this.manuallyPaused = false;
        this.backgroundPaused = !this.appState.current.appVisible;
        this.appliedPaused = false;
        this.runtimeFailed = false;
        this.appState.setActiveModule(definition.id, definition.title);

        const context: ModuleContext = {
            host: root,
            moduleId: definition.id,
            viewport: this.viewport,
            storage: this.storage,
            input: this.input,
            appState: this.appState,
            open: navigation.open,
            home: navigation.home,
        };

        try {
            await module.mount(context);
            this.syncPauseState();
        } catch (error) {
            await this.disposeActive();
            throw error;
        }
    }

    update(dt: number): void {
        const module = this.activeModule;

        if (
            !module
            || this.runtimeFailed
            || this.manuallyPaused
            || this.backgroundPaused
            || !isUpdatable(module)
        ) {
            return;
        }

        try {
            module.update(dt);
        } catch (error) {
            this.failRuntime(error);
        }
    }

    togglePause(): boolean {
        const module = this.activeModule;

        if (!module || this.runtimeFailed || !isPausable(module)) {
            return false;
        }

        this.manuallyPaused = !this.manuallyPaused;

        try {
            this.syncPauseState();
        } catch (error) {
            this.failRuntime(error);
        }

        return this.appliedPaused;
    }

    reset(): boolean {
        const module = this.activeModule;

        if (!module || this.runtimeFailed || !isResettable(module)) {
            return false;
        }

        try {
            module.reset();
            return true;
        } catch (error) {
            this.failRuntime(error);
            return false;
        }
    }

    setAppVisible(visible: boolean): void {
        this.backgroundPaused = !visible;

        try {
            this.syncPauseState();
        } catch (error) {
            this.failRuntime(error);
        }
    }

    async dispose(): Promise<void> {
        this.unsubscribeViewport();
        await this.disposeActive();
    }

    private syncPauseState(): void {
        const module = this.activeModule;
        const shouldPause = this.manuallyPaused || this.backgroundPaused;

        if (!module || !isPausable(module) || shouldPause === this.appliedPaused) {
            return;
        }

        this.appliedPaused = shouldPause;

        if (shouldPause) {
            module.pause();
        } else {
            module.resume();
        }
    }

    private failRuntime(error: unknown): void {
        if (this.runtimeFailed) {
            return;
        }

        this.runtimeFailed = true;
        this.appState.setError(error);
        console.error('[cocoslab] module runtime failed', error);
        this.onRuntimeError(error);
    }

    private async disposeActive(): Promise<void> {
        const module = this.activeModule;
        const root = this.activeRoot;

        this.activeModule = null;
        this.activeDefinition = null;
        this.activeRoot = null;
        this.manuallyPaused = false;
        this.backgroundPaused = false;
        this.appliedPaused = false;
        this.runtimeFailed = false;

        try {
            await module?.unmount();
        } finally {
            root?.destroy();
        }
    }
}
