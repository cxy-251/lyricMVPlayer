import { Node } from 'cc';
import type {
    InteractiveModule,
    ModuleContext,
} from '../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../services/ViewportService';
import { createUiNode, resizeNode } from '../ui/UiFactory';

const MINIMUM_LAYOUT_WIDTH = 320;
const MINIMUM_LAYOUT_HEIGHT = 480;

export abstract class ResponsiveModule implements InteractiveModule {
    protected context: ModuleContext | null = null;
    protected root: Node | null = null;

    private unsubscribeViewport: (() => void) | null = null;

    protected abstract readonly rootName: string;

    mount(context: ModuleContext): void | Promise<void> {
        if (this.context) {
            throw new Error(`${this.rootName} is already mounted`);
        }

        this.context = context;
        const viewport = context.viewport.current;
        this.root = createUiNode(
            context.host,
            this.rootName,
            viewport.width,
            viewport.height,
        );

        this.onMount();
        let initializing = true;

        try {
            this.unsubscribeViewport = context.viewport.subscribe((snapshot) => {
                try {
                    if (!this.root) {
                        return;
                    }

                    this.root.setScale(1, 1, 1);
                    resizeNode(this.root, snapshot.width, snapshot.height);
                    this.render(snapshot);
                    this.applyViewportScale(snapshot);
                } catch (error) {
                    if (initializing) {
                        throw error;
                    }

                    context.reportError(error);
                }
            });
        } finally {
            initializing = false;
        }
    }

    async unmount(): Promise<void> {
        this.unsubscribeViewport?.();
        this.unsubscribeViewport = null;

        try {
            await this.onUnmount();
        } finally {
            this.root?.destroy();
            this.root = null;
            this.context = null;
        }
    }

    protected requireContext(): ModuleContext {
        if (!this.context) {
            throw new Error(`${this.rootName} is not mounted`);
        }

        return this.context;
    }

    protected requireRoot(): Node {
        if (!this.root) {
            throw new Error(`${this.rootName} has no root node`);
        }

        return this.root;
    }

    protected onMount(): void {}

    protected onUnmount(): void | Promise<void> {}

    protected abstract render(viewport: ViewportSnapshot): void;

    private applyViewportScale(viewport: ViewportSnapshot): void {
        if (!this.root) {
            return;
        }
        const safeWidth = Math.max(
            1,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const safeHeight = Math.max(
            1,
            viewport.height - viewport.safeInsets.top - viewport.safeInsets.bottom,
        );
        const scale = Math.min(
            1,
            safeWidth / MINIMUM_LAYOUT_WIDTH,
            safeHeight / MINIMUM_LAYOUT_HEIGHT,
        );
        this.root.setScale(scale, scale, 1);
    }
}
