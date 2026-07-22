import { BlockInputEvents, Layers, Node } from 'cc';
import type { ViewportService, ViewportSnapshot } from '../services/ViewportService';
import {
    clearNode,
    createButton,
    createLabel,
    createUiNode,
    fillNode,
    palette,
    resizeNode,
} from '../ui/UiFactory';
import { NavigationBar } from './NavigationBar';

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
        fillNode(panel, panelWidth, panelHeight, palette.surface, 20);

        createLabel(panel, 'MODULE ERROR', panelWidth - 48, 44, 26, palette.danger, 0, 82);
        createLabel(panel, message, panelWidth - 64, 94, 17, palette.text, 0, 12);
        createButton(panel, {
            name: 'ErrorHome',
            text: 'RETURN HOME',
            width: 190,
            height: 52,
            y: -82,
            onPress: onHome,
        });
    }

    dispose(): void {
        this.unsubscribeViewport();
        this.navigationBar.dispose();
        this.root.destroy();
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
        resizeNode(this.root, width, height);

        for (const layer of [this.contentLayer, this.navigationLayer, this.overlayLayer]) {
            layer.setPosition(0, 0, 0);
            resizeNode(layer, width, height);
        }
    }
}
