import {
    BlockInputEvents,
    Canvas,
    Layers,
    Node,
} from 'cc';
import type { ViewportService, ViewportSnapshot } from '../services/ViewportService';
import {
    clearNode,
    createLabel,
    createTextButton,
    createUiNode,
    fillNode,
    nativeTheme,
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
        this.overlayLayer.active = false;
    }

    showError(message: string, onHome: () => void): void {
        clearNode(this.overlayLayer);
        this.overlayLayer.active = true;
        this.overlayLayer.getComponent(BlockInputEvents)
            ?? this.overlayLayer.addComponent(BlockInputEvents);

        const { width, height, safeInsets } = this.viewport;
        fillNode(this.overlayLayer, width, height, nativeTheme.background);

        const safeWidth = Math.max(1, width - safeInsets.left - safeInsets.right);
        const safeHeight = Math.max(1, height - safeInsets.top - safeInsets.bottom);
        const centerX = (safeInsets.left - safeInsets.right) / 2;
        const centerY = (safeInsets.bottom - safeInsets.top) / 2;
        const panelWidth = Math.max(1, Math.min(620, safeWidth - 32));
        const panelHeight = Math.max(1, Math.min(280, safeHeight - 32));
        const compact = panelWidth < 380 || panelHeight < 240;
        const radius = Math.min(22, panelWidth / 2, panelHeight / 2);
        const buttonWidth = Math.max(96, Math.min(168, panelWidth - 48));
        const titleY = panelHeight / 2 - (compact ? 34 : 58);
        const buttonY = -panelHeight / 2 + 38;
        const messageTop = titleY - (compact ? 30 : 38);
        const messageBottom = buttonY + 28;
        const messageHeight = Math.max(24, messageTop - messageBottom);
        const messageY = (messageTop + messageBottom) / 2;

        const panel = createUiNode(
            this.overlayLayer,
            'ErrorPanel',
            panelWidth,
            panelHeight,
            centerX,
            centerY,
        );
        fillNode(panel, panelWidth, panelHeight, nativeTheme.card, radius);

        createLabel(
            panel,
            'MODULE ERROR',
            Math.max(1, panelWidth - 48),
            compact ? 34 : 44,
            compact ? 20 : 26,
            palette.danger,
            0,
            titleY,
        );
        createLabel(
            panel,
            message,
            Math.max(1, panelWidth - 64),
            messageHeight,
            compact ? 14 : 17,
            nativeTheme.ink,
            0,
            messageY,
        );
        createTextButton(panel, {
            name: 'ErrorHome',
            text: 'Return home',
            width: buttonWidth,
            y: buttonY,
            onPress: onHome,
        });
    }

    dispose(): void {
        this.unsubscribeViewport();
        this.navigationBar.dispose();
        this.root.destroy();
    }

    private configureCanvas(): void {
        const canvas = this.canvasNode.getComponent(Canvas);
        const camera = canvas?.cameraComponent;

        if (camera) {
            camera.clearColor = nativeTheme.background;
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

        resizeNode(this.canvasNode, width, height);
        this.canvasNode.setPosition(width / 2, height / 2, 0);
        resizeNode(this.root, width, height);

        for (const layer of [this.contentLayer, this.navigationLayer, this.overlayLayer]) {
            layer.setPosition(0, 0, 0);
            resizeNode(layer, width, height);
        }
    }
}
