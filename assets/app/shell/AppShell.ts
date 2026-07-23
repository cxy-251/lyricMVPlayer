import {
    BlockInputEvents,
    Canvas,
    Color,
    Layers,
    Node,
} from 'cc';
import type { ViewportService, ViewportSnapshot } from '../services/ViewportService';
import {
    clearNode,
    createLabel,
    createUiNode,
    fillNode,
    palette,
    resizeNode,
} from '../ui/UiFactory';
import {
    clearWebUiScope,
    getWebUiScope,
} from '../ui/WebUiKit';
import { NavigationBar } from './NavigationBar';

const ERROR_SCOPE = 'error-overlay';

export class AppShell {
    readonly root: Node;
    readonly contentLayer: Node;
    readonly navigationLayer: Node;
    readonly overlayLayer: Node;
    readonly navigationBar: NavigationBar;

    private viewport: ViewportSnapshot;
    private readonly unsubscribeViewport: () => void;

    constructor(
        private readonly canvasNode: Node,
        viewportService: ViewportService,
    ) {
        this.viewport = viewportService.current;
        this.configureCanvas();
        this.root = this.createRoot();
        this.contentLayer = this.createLayer('ContentLayer', 0);
        this.navigationLayer = this.createLayer('NavigationLayer', 1);
        this.overlayLayer = this.createLayer('OverlayLayer', 2);
        this.overlayLayer.active = false;
        this.navigationBar = new NavigationBar(this.navigationLayer, viewportService);

        this.unsubscribeViewport = viewportService.subscribe((snapshot) => {
            this.viewport = snapshot;
            this.applyViewport();
        });
    }

    belongsTo(canvasNode: Node): boolean {
        return this.canvasNode === canvasNode;
    }

    clearOverlay(): void {
        clearNode(this.overlayLayer);
        clearWebUiScope(ERROR_SCOPE);
        this.overlayLayer.active = false;
    }

    showError(message: string, onHome: () => void): void {
        clearNode(this.overlayLayer);
        this.overlayLayer.active = true;
        this.overlayLayer.getComponent(BlockInputEvents)
            ?? this.overlayLayer.addComponent(BlockInputEvents);

        const { width, height, safeInsets } = this.viewport;
        fillNode(this.overlayLayer, width, height, palette.background);

        const panelWidth = Math.min(620, width - safeInsets.left - safeInsets.right - 40);
        const panelHeight = 280;
        const panel = createUiNode(this.overlayLayer, 'ErrorPanel', panelWidth, panelHeight);
        fillNode(panel, panelWidth, panelHeight, palette.surfaceSoft, 20);
        createLabel(panel, 'MODULE ERROR', panelWidth - 48, 44, 26, palette.danger, 0, 82);
        createLabel(panel, message, panelWidth - 64, 94, 17, palette.text, 0, 12);

        const scope = getWebUiScope(ERROR_SCOPE);

        if (!scope) {
            return;
        }

        const button = document.createElement('wa-button') as HTMLElement;
        button.setAttribute('appearance', 'filled');
        button.setAttribute('variant', 'brand');
        button.setAttribute('size', 'm');
        button.textContent = 'Return home';
        button.style.position = 'absolute';
        button.style.left = '50%';
        button.style.top = `${Math.round(height / 2 + 62)}px`;
        button.style.transform = 'translateX(-50%)';
        button.style.pointerEvents = 'auto';
        button.addEventListener('click', onHome);
        scope.appendChild(button);
    }

    dispose(): void {
        this.unsubscribeViewport();
        this.navigationBar.dispose();
        clearWebUiScope(ERROR_SCOPE);
        this.root.destroy();
    }

    private configureCanvas(): void {
        const canvas = this.canvasNode.getComponent(Canvas);
        const camera = canvas?.cameraComponent;

        if (camera) {
            camera.clearColor = new Color(242, 241, 237, 255);
        }
    }

    private createRoot(): Node {
        const existing = this.canvasNode.getChildByName('AppShell');
        const root = existing ?? new Node('AppShell');

        if (!existing) {
            root.layer = Layers.Enum.UI_2D;
            this.canvasNode.addChild(root);
        } else {
            clearNode(root);
        }

        root.setPosition(0, 0, 0);
        return root;
    }

    private createLayer(name: string, siblingIndex: number): Node {
        const layer = new Node(name);
        layer.layer = Layers.Enum.UI_2D;
        this.root.addChild(layer);
        layer.setSiblingIndex(siblingIndex);
        layer.setPosition(0, 0, 0);
        return layer;
    }

    private applyViewport(): void {
        const { width, height } = this.viewport;

        // Boot.scene stores a 1280 x 720 Canvas at (640, 360). Keep the scene
        // Canvas synchronized with the live design resolution on every resize.
        resizeNode(this.canvasNode, width, height);
        this.canvasNode.setPosition(width / 2, height / 2, 0);
        resizeNode(this.root, width, height);

        for (const layer of [this.contentLayer, this.navigationLayer, this.overlayLayer]) {
            layer.setPosition(0, 0, 0);
            resizeNode(layer, width, height);
        }
    }
}
