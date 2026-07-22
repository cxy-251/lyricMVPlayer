import type {
    InteractiveModule,
    ModuleDefinition,
} from '../contracts/InteractiveModule';
import type { AppShell } from '../shell/AppShell';
import type { AppState } from './AppState';
import type { ModuleHost } from './ModuleHost';
import type { ModuleRegistry } from './ModuleRegistry';

const homeDefinition: ModuleDefinition = {
    id: 'home',
    title: 'Cocos Lab',
    description: 'Interactive works catalog',
    category: 'system',
    hidden: true,
    create: () => {
        throw new Error('Home module is created by the application shell');
    },
};

export class NavigationService {
    private transition: Promise<void> = Promise.resolve();

    constructor(
        private readonly registry: ModuleRegistry,
        private readonly moduleHost: ModuleHost,
        private readonly shell: AppShell,
        private readonly appState: AppState,
        private readonly createHome: () => InteractiveModule,
    ) {}

    home(): Promise<void> {
        return this.enqueue(() => this.activate(homeDefinition, this.createHome(), true));
    }

    open(moduleId: string): Promise<void> {
        return this.enqueue(() => {
            const definition = this.registry.get(moduleId);
            return this.activate(definition, definition.create(), false);
        });
    }

    togglePause(): void {
        const paused = this.moduleHost.togglePause();
        this.shell.navigationBar.setPaused(paused);
    }

    reset(): void {
        this.moduleHost.reset();
    }

    setAppVisible(visible: boolean): void {
        this.moduleHost.setAppVisible(visible);
        this.shell.navigationBar.setPaused(this.moduleHost.paused);
    }

    async dispose(): Promise<void> {
        await this.moduleHost.dispose();
        this.shell.navigationBar.showHome();
        this.shell.clearOverlay();
    }

    private enqueue(operation: () => Promise<void>): Promise<void> {
        const next = this.transition.then(operation, operation);
        this.transition = next.catch(() => undefined);
        return next;
    }

    private async activate(
        definition: ModuleDefinition,
        module: InteractiveModule,
        isHome: boolean,
    ): Promise<void> {
        this.shell.clearOverlay();

        try {
            await this.moduleHost.activate(definition, module, {
                open: (moduleId) => this.open(moduleId),
                home: () => this.home(),
            });
            this.appState.clearError();

            if (isHome) {
                this.shell.navigationBar.showHome();
            } else {
                this.shell.navigationBar.showModule(
                    definition,
                    {
                        onBack: () => {
                            void this.home();
                        },
                        onTogglePause: () => {
                            this.togglePause();
                        },
                        onReset: () => {
                            this.reset();
                        },
                    },
                    this.moduleHost.paused,
                );
            }
        } catch (error) {
            this.appState.setError(error);
            console.error(`[cocoslab] failed to open ${definition.id}`, error);
            const message = error instanceof Error ? error.message : String(error);
            this.shell.showError(message, () => {
                void this.home();
            });
        }
    }
}
