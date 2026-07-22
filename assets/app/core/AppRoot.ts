import {
    _decorator,
    Component,
    director,
    game,
    Game,
    Node,
} from 'cc';
import { HomeModule } from '../features/home/HomeModule';
import { parametricCurveDefinition } from '../features/mathematics/ParametricCurveModule';
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
    private initialized = false;

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

    async attachCanvas(canvasNode: Node): Promise<NavigationService> {
        this.initialize();

        if (this.shell?.belongsTo(canvasNode) && this.navigationService) {
            return this.navigationService;
        }

        await this.detachCanvas();

        this.shell = new AppShell(canvasNode, this.viewportService);
        this.moduleHost = new ModuleHost(
            this.shell.contentLayer,
            this.viewportService,
            this.storageService,
            this.inputService,
            this.appStateService,
        );
        this.navigationService = new NavigationService(
            this.moduleRegistry,
            this.moduleHost,
            this.shell,
            this.appStateService,
            () => new HomeModule(this.moduleRegistry),
        );
        this.navigationService.setAppVisible(this.appStateService.current.appVisible);
        this.bindInput(this.navigationService);
        return this.navigationService;
    }

    async detachCanvas(canvasNode?: Node): Promise<void> {
        if (!this.shell || (canvasNode && !this.shell.belongsTo(canvasNode))) {
            return;
        }

        this.clearInputBindings();
        await this.navigationService?.dispose();
        this.shell.dispose();
        this.navigationService = null;
        this.moduleHost = null;
        this.shell = null;
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

        game.off(Game.EVENT_HIDE, this.handleAppHide, this);
        game.off(Game.EVENT_SHOW, this.handleAppShow, this);
        this.clearInputBindings();
        this.inputService.stop();
        this.viewportService.stop();
        void this.navigationService?.dispose();
        this.shell?.dispose();
        AppRoot.instance = null;
    }

    private initialize(): void {
        if (this.initialized) {
            return;
        }

        this.moduleRegistry.registerAll([
            parametricCurveDefinition,
            systemCheckDefinition,
        ]);
        this.viewportService.start();
        this.inputService.start();
        game.on(Game.EVENT_HIDE, this.handleAppHide, this);
        game.on(Game.EVENT_SHOW, this.handleAppShow, this);
        this.initialized = true;
    }

    private bindInput(navigation: NavigationService): void {
        this.clearInputBindings();
        this.inputDisposers = [
            this.inputService.bind('back', () => {
                if (this.appStateService.current.activeModuleId !== 'home') {
                    void navigation.home();
                }
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

    private readonly handleAppHide = (): void => {
        this.appStateService.setVisible(false);
        this.navigationService?.setAppVisible(false);
    };

    private readonly handleAppShow = (): void => {
        this.appStateService.setVisible(true);
        this.navigationService?.setAppVisible(true);
    };
}
