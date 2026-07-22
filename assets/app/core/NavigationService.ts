import type { Node } from 'cc';
import type {
    InteractiveModule,
    ModuleContext,
} from '../contracts/InteractiveModule';
import type { ModuleRegistry } from './ModuleRegistry';

export class NavigationService {
    private host: Node | null = null;
    private activeModule: InteractiveModule | null = null;
    private transition: Promise<void> = Promise.resolve();

    constructor(
        private readonly registry: ModuleRegistry,
        private readonly createHome: () => InteractiveModule,
    ) {}

    attachHost(host: Node): void {
        this.host = host;
    }

    detachHost(host: Node): Promise<void> {
        if (this.host !== host) {
            return Promise.resolve();
        }

        return this.enqueue(async () => {
            await this.disposeActiveModule();
            this.host = null;
        });
    }

    home(): Promise<void> {
        return this.enqueue(() => this.activate('home', this.createHome()));
    }

    open(moduleId: string): Promise<void> {
        return this.enqueue(() => {
            const definition = this.registry.get(moduleId);
            return this.activate(moduleId, definition.create());
        });
    }

    private enqueue(operation: () => Promise<void>): Promise<void> {
        const next = this.transition.then(operation, operation);
        this.transition = next.catch(() => undefined);
        return next;
    }

    private async activate(
        moduleId: string,
        module: InteractiveModule,
    ): Promise<void> {
        const host = this.host;

        if (!host) {
            throw new Error('Navigation host is not attached');
        }

        await this.disposeActiveModule();
        this.destroyHostChildren(host);

        const context: ModuleContext = {
            host,
            moduleId,
            open: (targetId) => this.open(targetId),
            home: () => this.home(),
        };

        this.activeModule = module;

        try {
            await module.mount(context);
        } catch (error) {
            this.activeModule = null;
            this.destroyHostChildren(host);
            throw error;
        }
    }

    private async disposeActiveModule(): Promise<void> {
        const activeModule = this.activeModule;
        this.activeModule = null;

        if (!activeModule) {
            return;
        }

        try {
            await activeModule.unmount();
        } finally {
            if (this.host) {
                this.destroyHostChildren(this.host);
            }
        }
    }

    private destroyHostChildren(host: Node): void {
        for (const child of [...host.children]) {
            child.destroy();
        }
    }
}
