import {
    _decorator,
    Canvas,
    Color,
    Component,
    director,
    HorizontalTextAlignment,
    Label,
    Layers,
    Node,
    profiler,
    UITransform,
    VerticalTextAlignment,
} from 'cc';

const { ccclass } = _decorator;

interface NavigationHandle {
    home(): void | Promise<void>;
}

interface AppRootHandle {
    attachCanvas(canvasNode: Node): Promise<NavigationHandle>;
    detachCanvas(canvasNode: Node): Promise<void>;
}

@ccclass('Bootstrap')
export class Bootstrap extends Component {
    private appRoot: AppRootHandle | null = null;
    private canvasNode: Node | null = null;
    private statusNode: Node | null = null;

    onEnable(): void {
        profiler.hideStats();
    }

    onLoad(): void {
        profiler.hideStats();

        try {
            const canvas = this.resolveCanvas();
            const camera = canvas.cameraComponent;

            if (camera) {
                camera.clearColor = new Color(242, 240, 234, 255);
            }

            this.canvasNode = canvas.node;
            this.showStatus('Starting Cocos Lab…', new Color(79, 86, 81, 255));
            void this.initializeApplication();
        } catch (error: unknown) {
            this.showStartupError(error);
        }
    }

    onDestroy(): void {
        const appRoot = this.appRoot;
        const canvasNode = this.canvasNode;

        if (appRoot && canvasNode) {
            void appRoot.detachCanvas(canvasNode);
        }

        this.clearStatus();
        this.canvasNode = null;
        this.appRoot = null;
    }

    private async initializeApplication(): Promise<void> {
        try {
            const canvasNode = this.canvasNode;

            if (!canvasNode) {
                throw new Error('Canvas was released before application startup');
            }

            const module = await import('../core/AppRoot');
            const appRoot = module.AppRoot.ensure() as AppRootHandle;
            this.appRoot = appRoot;

            const navigation = await appRoot.attachCanvas(canvasNode);
            await navigation.home();
            this.clearStatus();
        } catch (error: unknown) {
            this.showStartupError(error);
        }
    }

    private showStartupError(error: unknown): void {
        profiler.hideStats();
        const message = error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error);
        console.error('[cocoslab] startup failed', error);
        this.showStatus(
            `COCOS LAB STARTUP ERROR\n${message}`,
            new Color(151, 67, 67, 255),
        );
    }

    private showStatus(text: string, color: Color): void {
        const canvasNode = this.canvasNode;

        if (!canvasNode) {
            return;
        }

        const node = this.statusNode ?? new Node('BootstrapStatus');

        if (!this.statusNode) {
            node.layer = Layers.Enum.UI_2D;
            canvasNode.addChild(node);
            const transform = node.addComponent(UITransform);
            transform.setContentSize(760, 120);
            const label = node.addComponent(Label);
            label.fontSize = 18;
            label.lineHeight = 28;
            label.horizontalAlign = HorizontalTextAlignment.CENTER;
            label.verticalAlign = VerticalTextAlignment.CENTER;
            label.enableWrapText = true;
            this.statusNode = node;
        }

        node.setPosition(0, 0, 0);
        const label = node.getComponent(Label);

        if (label) {
            label.string = text;
            label.color = color;
        }
    }

    private clearStatus(): void {
        this.statusNode?.destroy();
        this.statusNode = null;
    }

    private resolveCanvas(): Canvas {
        let current: Node | null = this.node;

        while (current) {
            const canvas = current.getComponent(Canvas);

            if (canvas) {
                return canvas;
            }

            current = current.parent;
        }

        const scene = director.getScene();
        const canvas = scene ? this.findCanvas(scene) : null;

        if (!canvas) {
            throw new Error('Bootstrap requires a Canvas in the active scene');
        }

        return canvas;
    }

    private findCanvas(node: Node): Canvas | null {
        const canvas = node.getComponent(Canvas);

        if (canvas) {
            return canvas;
        }

        for (const child of node.children) {
            const nested = this.findCanvas(child);

            if (nested) {
                return nested;
            }
        }

        return null;
    }
}
