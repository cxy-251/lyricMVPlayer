import {
    _decorator,
    Component,
    director,
    game,
    Game,
    Node,
} from 'cc';
import { cursorSpaceDefinition } from '../features/games/CursorSpaceModule';
import { HomeModule } from '../features/home/HomeModule';
import { LabCatalogModule } from '../features/home/LabCatalogModule';
import { lissajousDefinition } from '../features/mathematics/lissajous';
import { doublePendulumDefinition } from '../features/physics/double-pendulum';
import { systemCheckDefinition } from '../features/system/SystemCheckModule';
import { InputService } from '../services/InputService';
import { StorageService } from '../services/StorageService';
import { ViewportService } from '../services/ViewportService';
import { AppShell } from '../shell/AppShell';
import { AppState } from './AppState';
import { ModuleHost } from './ModuleHost';
import { ModuleRegistry } from './ModuleRegistry';
import { NavigationService } from './NavigationService';

const { ccclass } = _decorator;

@ccclass('AppRoot')
export class AppRoot extends Component {
    private static instance: AppRoot | null = null;

    private readonly moduleRegistry = new ModuleRegistry();
    private readonly appStateService = new AppState();
    private readonly viewportService = new ViewportService();
    private readonly storageService = new StorageService();
    private readonly inputService = new InputService();

    private shell: AppShell | null = null;
    private moduleHost: ModuleHost | null = null;
    private navigationService: NavigationService | null = null;
    private inputDisposers: Array<() => void> = [];
    private shellTransition: Promise<void> = Promise.resolve();
    private initialized = false;
    private shuttingDown = false;

    static ensure(): AppRoot {
        if (AppRoot.instance) {
            return AppRoot.instance;
        }

        const scene = director.getScene();

        if (!scene) {
            throw new Error('Cannot create AppRoot before a scene is running');
        }

        const node = new Node('AppRoot');
        scene.addChild(node);
        const appRoot = node.addComponent(AppRoot);
        director.addPersistRootNode(node);
        return appRoot;
    }

    get appState(): AppState {
        return this.appStateService;
    }

    attachCanvas(canvasNode: Node): Promise<NavigationService> {
        return this.enqueueShellTransition(() => this.attachCanvasNow(canvasNode));
    }

    detachCanvas(canvasNode?: Node): Promise<void> {
        return this.enqueueShellTransition(() => this.detachCanvasNow(canvasNode));
    }

    onLoad(): void {
        if (AppRoot.instance && AppRoot.instance !== this) {
            this.node.destroy();
            return;
        }

        AppRoot.instance = this;
        this.initialize();
    }

    update(dt: number): void {
        this.moduleHost?.update(dt);
    }

    onDestroy(): void {
        if (AppRoot.instance !== this) {
            return;
        }

        this.shuttingDown = true;
        game.off(Game.EVENT_HIDE, this.handleAppHide, this);
        game.off(Game.EVENT_SHOW, this.handleAppShow, this);
        this.clearInputBindings();
        this.inputService.stop();
        this.viewportService.stop();

        const navigation = this.navigationService;
        const shell = this.shell;
        this.navigationService = null;
        this.moduleHost = null;
        this.shell = null;

        if (navigation) {
            void navigation.dispose()
                .catch((error: unknown) => {
                    console.error('[cocoslab] failed to dispose application shell', error);
                })
                .finally(() => {
                    shell?.dispose();
                });
        } else {
            shell?.dispose();
        }

        AppRoot.instance = null;
    }

    private initialize(): void {
        if (this.initialized) {
            return;
        }

        this.moduleRegistry.registerAll([
            lissajousDefinition,
            doublePendulumDefinition,
            cursorSpaceDefinition,
            systemCheckDefinition,
        ]);
        this.viewportService.start();
        this.inputService.start();
        game.on(Game.EVENT_HIDE, this.handleAppHide, this);
        game.on(Game.EVENT_SHOW, this.handleAppShow, this);
        this.initialized = true;
    }

    private async attachCanvasNow(canvasNode: Node): Promise<NavigationService> {
        if (this.shuttingDown) {
            throw new Error('Cannot attach a Canvas while AppRoot is shutting down');
        }

        this.initialize();

        if (this.shell?.belongsTo(canvasNode) && this.navigationService) {
            return this.navigationService;
        }

        await this.detachCanvasNow();

        this.shell = new AppShell(canvasNode, this.viewportService);
        this.moduleHost = new ModuleHost(
            this.shell.contentLayer,
            this.viewportService,
            this.storageService,
            this.inputService,
            this.appStateService,
            this.handleModuleRuntimeError,
        );
        this.navigationService = new NavigationService(
            this.moduleRegistry,
            this.moduleHost,
            this.shell,
            this.appStateService,
            () => new HomeModule(this.moduleRegistry),
            (labId) => new LabCatalogModule(this.moduleRegistry, labId),
        );
        this.navigationService.setAppVisible(this.appStateService.current.appVisible);
        this.bindInput(this.navigationService);
        return this.navigationService;
    }

    private async detachCanvasNow(canvasNode?: Node): Promise<void> {
        const shell = this.shell;

        if (!shell || (canvasNode && !shell.belongsTo(canvasNode))) {
            return;
        }

        const navigation = this.navigationService;
        this.clearInputBindings();
        this.navigationService = null;
        this.moduleHost = null;
        this.shell = null;

        try {
            await navigation?.dispose();
        } finally {
            shell.dispose();
        }
    }

    private enqueueShellTransition<T>(operation: () => Promise<T>): Promise<T> {
        const next = this.shellTransition.then(operation, () => operation());
        this.shellTransition = next.then(
            () => undefined,
            () => undefined,
        );
        return next;
    }

    private bindInput(navigation: NavigationService): void {
        this.clearInputBindings();
        this.inputDisposers = [
            this.inputService.bind('back', () => {
                void navigation.back();
            }),
            this.inputService.bind('toggle-pause', () => {
                navigation.togglePause();
            }),
            this.inputService.bind('reset', () => {
                navigation.reset();
            }),
        ];
    }

    private clearInputBindings(): void {
        for (const dispose of this.inputDisposers) {
            dispose();
        }

        this.inputDisposers = [];
    }

    private readonly handleModuleRuntimeError = (error: unknown): void => {
        const message = error instanceof Error ? error.message : String(error);
        this.shell?.showError(message, () => {
            void this.navigationService?.home();
        });
    };

    private readonly handleAppHide = (): void => {
        this.appStateService.setVisible(false);
        this.navigationService?.setAppVisible(false);
    };

    private readonly handleAppShow = (): void => {
        this.appStateService.setVisible(true);
        this.navigationService?.setAppVisible(true);
    };
}
