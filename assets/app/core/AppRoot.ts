import { _decorator, Component, director, Node } from 'cc';
import { HomeModule } from '../features/home/HomeModule';
import { systemCheckDefinition } from '../features/system/SystemCheckModule';
import { ModuleRegistry } from './ModuleRegistry';
import { NavigationService } from './NavigationService';

const { ccclass } = _decorator;

@ccclass('AppRoot')
export class AppRoot extends Component {
    private static instance: AppRoot | null = null;

    private readonly moduleRegistry = new ModuleRegistry();
    private navigationService: NavigationService | null = null;
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

    get navigation(): NavigationService {
        this.initialize();

        if (!this.navigationService) {
            throw new Error('Navigation service is not initialized');
        }

        return this.navigationService;
    }

    onLoad(): void {
        if (AppRoot.instance && AppRoot.instance !== this) {
            this.node.destroy();
            return;
        }

        AppRoot.instance = this;
        this.initialize();
    }

    onDestroy(): void {
        if (AppRoot.instance === this) {
            AppRoot.instance = null;
        }
    }

    attachHost(host: Node): void {
        this.navigation.attachHost(host);
    }

    private initialize(): void {
        if (this.initialized) {
            return;
        }

        this.moduleRegistry.register(systemCheckDefinition);
        this.navigationService = new NavigationService(
            this.moduleRegistry,
            () => new HomeModule(this.moduleRegistry),
        );
        this.initialized = true;
    }
}
