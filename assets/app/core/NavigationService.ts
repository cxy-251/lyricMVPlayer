import type {
    InteractiveModule,
    LabDefinition,
    LabId,
    ModuleDefinition,
} from '../contracts/InteractiveModule';
import type { AppShell } from '../shell/AppShell';
import type { AppState } from './AppState';
import type { ModuleHost } from './ModuleHost';
import type { ModuleRegistry } from './ModuleRegistry';

const homeDefinition: ModuleDefinition = {
    id: 'home',
    title: 'Cocos Lab',
    description: 'Interactive laboratory catalog',
    category: 'system',
    hidden: true,
    create: () => {
        throw new Error('Home module is created by the application shell');
    },
};

type NavigationRoute =
    | { readonly kind: 'home' }
    | { readonly kind: 'lab'; readonly labId: LabId }
    | { readonly kind: 'module'; readonly moduleId: string; readonly labId?: LabId };

export class NavigationService {
    private transition: Promise<void> = Promise.resolve();
    private route: NavigationRoute = { kind: 'home' };
    private disposed = false;
    private disposal: Promise<void> | null = null;

    constructor(
        private readonly registry: ModuleRegistry,
        private readonly moduleHost: ModuleHost,
        private readonly shell: AppShell,
        private readonly appState: AppState,
        private readonly createHome: () => InteractiveModule,
        private readonly createLabCatalog: (labId: LabId) => InteractiveModule,
    ) {}

    home(): Promise<void> {
        return this.enqueue(() => this.activate(
            homeDefinition,
            this.createHome(),
            { kind: 'home' },
        ));
    }

    openLab(labId: LabId): Promise<void> {
        return this.enqueue(() => {
            const lab = this.registry.getLab(labId);
            return this.activate(
                this.createLabDefinition(lab),
                this.createLabCatalog(labId),
                { kind: 'lab', labId },
            );
        });
    }

    open(moduleId: string): Promise<void> {
        return this.enqueue(() => {
            const definition = this.registry.get(moduleId);
            return this.activate(
                definition,
                definition.create(),
                { kind: 'module', moduleId, labId: definition.labId },
            );
        });
    }

    back(): Promise<void> {
        if (this.route.kind === 'module' && this.route.labId) {
            return this.openLab(this.route.labId);
        }

        if (this.route.kind === 'lab' || this.route.kind === 'module') {
            return this.home();
        }

        return Promise.resolve();
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

    dispose(): Promise<void> {
        if (this.disposal) {
            return this.disposal;
        }

        this.disposed = true;
        this.disposal = (async () => {
            await this.transition.catch(() => undefined);
            this.route = { kind: 'home' };
            await this.moduleHost.dispose();
            this.shell.navigationBar.showHome();
            this.shell.clearOverlay();
        })();
        return this.disposal;
    }

    private enqueue(operation: () => Promise<void>): Promise<void> {
        if (this.disposed) {
            return Promise.reject(new Error('Navigation service is disposed'));
        }

        const next = this.transition.then(operation, operation);
        this.transition = next.catch(() => undefined);
        return next;
    }

    private async activate(
        definition: ModuleDefinition,
        module: InteractiveModule,
        destination: NavigationRoute,
    ): Promise<void> {
        this.shell.clearOverlay();

        try {
            await this.moduleHost.activate(definition, module, {
                open: (moduleId) => this.open(moduleId),
                openLab: (labId) => this.openLab(labId),
                back: () => this.back(),
                home: () => this.home(),
            });
            this.route = destination;
            this.appState.clearError();
            this.renderNavigation(destination, definition);
        } catch (error) {
            this.route = { kind: 'home' };
            this.appState.setError(error);
            console.error(`[cocoslab] failed to open ${definition.id}`, error);
            const message = error instanceof Error ? error.message : String(error);
            this.shell.showError(message, () => {
                void this.home();
            });
        }
    }

    private renderNavigation(route: NavigationRoute, definition: ModuleDefinition): void {
        if (route.kind === 'home') {
            this.shell.navigationBar.showHome();
            return;
        }

        if (route.kind === 'lab') {
            this.shell.navigationBar.showLab(
                this.registry.getLab(route.labId),
                () => {
                    void this.home();
                },
            );
            return;
        }

        const parentLab = route.labId ? this.registry.getLab(route.labId) : null;
        this.shell.navigationBar.showModule(
            definition,
            parentLab,
            {
                onBack: () => {
                    void this.back();
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

    private createLabDefinition(lab: LabDefinition): ModuleDefinition {
        return {
            id: `lab-${lab.id}`,
            title: lab.title,
            description: lab.description,
            category: lab.id === 'physics' ? 'simulation' : 'mathematics',
            labId: lab.id,
            hidden: true,
            create: () => {
                throw new Error('Laboratory catalog is created by the application shell');
            },
        };
    }
}
