import {
    _decorator,
    Canvas,
    Component,
    director,
    Node,
} from 'cc';
import { AppRoot } from '../core/AppRoot';
import type { NavigationService } from '../core/NavigationService';

const { ccclass } = _decorator;

@ccclass('Bootstrap')
export class Bootstrap extends Component {
    private appRoot: AppRoot | null = null;
    private canvasNode: Node | null = null;
    private navigationReady: Promise<NavigationService> | null = null;

    onLoad(): void {
        const canvas = this.resolveCanvas();
        this.canvasNode = canvas.node;
        this.appRoot = AppRoot.ensure();
        this.navigationReady = this.appRoot.attachCanvas(this.canvasNode);
    }

    start(): void {
        void this.navigationReady
            ?.then((navigation) => navigation.home())
            .catch((error: unknown) => {
                console.error('[cocoslab] bootstrap failed', error);
            });
    }

    onDestroy(): void {
        if (this.appRoot && this.canvasNode) {
            void this.appRoot.detachCanvas(this.canvasNode);
        }

        this.navigationReady = null;
        this.canvasNode = null;
        this.appRoot = null;
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
