import {
    profiler,
    ResolutionPolicy,
    screen,
    sys,
    view,
} from 'cc';

export type ViewportBreakpoint = 'compact' | 'medium' | 'wide';
export type ViewportOrientation = 'portrait' | 'landscape';

export interface ViewportInsets {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
}

export interface ViewportSnapshot {
    readonly width: number;
    readonly height: number;
    readonly orientation: ViewportOrientation;
    readonly breakpoint: ViewportBreakpoint;
    readonly safeInsets: ViewportInsets;
}

type ViewportListener = (snapshot: ViewportSnapshot) => void;

export class ViewportService {
    private snapshot = this.readSnapshot();
    private readonly listeners = new Set<ViewportListener>();
    private started = false;
    private applyingResolution = false;
    private animationFrame = 0;

    get current(): ViewportSnapshot {
        return this.snapshot;
    }

    start(): void {
        if (this.started) {
            return;
        }

        this.started = true;
        profiler.hideStats();

        if (this.hasBrowserDom()) {
            // Cocos' automatic browser resize reapplies the scene's saved resolution
            // policy. CocosLab owns the complete web surface instead.
            view.resizeWithBrowserSize(false);
            window.addEventListener('resize', this.handleBrowserResize, { passive: true });
            window.visualViewport?.addEventListener('resize', this.handleBrowserResize, { passive: true });
            this.applyBrowserSurface();
            this.scheduleBrowserSurfaceSync();
        }

        screen.on('window-resize', this.handleViewportChange, this);
        screen.on('orientation-change', this.handleViewportChange, this);
        this.refresh();
    }

    stop(): void {
        if (!this.started) {
            return;
        }

        screen.off('window-resize', this.handleViewportChange, this);
        screen.off('orientation-change', this.handleViewportChange, this);

        if (this.hasBrowserDom()) {
            window.removeEventListener('resize', this.handleBrowserResize);
            window.visualViewport?.removeEventListener('resize', this.handleBrowserResize);

            if (this.animationFrame !== 0) {
                window.cancelAnimationFrame(this.animationFrame);
                this.animationFrame = 0;
            }
        }

        this.started = false;
        this.listeners.clear();
    }

    subscribe(listener: ViewportListener, emitImmediately = true): () => void {
        this.listeners.add(listener);

        if (emitImmediately) {
            listener(this.snapshot);
        }

        return () => {
            this.listeners.delete(listener);
        };
    }

    refresh(): void {
        const next = this.readSnapshot();

        if (this.equals(next, this.snapshot)) {
            return;
        }

        this.snapshot = next;

        for (const listener of [...this.listeners]) {
            listener(this.snapshot);
        }
    }

    private readonly handleBrowserResize = (): void => {
        this.scheduleBrowserSurfaceSync();
    };

    private readonly handleViewportChange = (): void => {
        if (this.hasBrowserDom()) {
            this.scheduleBrowserSurfaceSync();
            return;
        }

        this.refresh();
    };

    private scheduleBrowserSurfaceSync(): void {
        if (!this.hasBrowserDom()) {
            return;
        }

        if (this.animationFrame !== 0) {
            window.cancelAnimationFrame(this.animationFrame);
        }

        this.animationFrame = window.requestAnimationFrame(() => {
            this.animationFrame = 0;
            this.applyBrowserSurface();
            this.refresh();
        });
    }

    private applyBrowserSurface(): void {
        if (!this.hasBrowserDom() || this.applyingResolution) {
            return;
        }

        const viewport = window.visualViewport;
        const width = Math.max(1, Math.round(
            viewport?.width
            ?? document.documentElement.clientWidth
            ?? window.innerWidth,
        ));
        const height = Math.max(1, Math.round(
            viewport?.height
            ?? document.documentElement.clientHeight
            ?? window.innerHeight,
        ));

        this.applyingResolution = true;

        try {
            this.applyDocumentStyles();

            // Resize every layer involved in a Cocos Web surface. Updating only
            // the design resolution leaves the outer container at 1280 x 720.
            view.setFrameSize(width, height);
            view.setCanvasSize(width, height);
            view.setDesignResolutionSize(width, height, ResolutionPolicy.EXACT_FIT);
            this.applyCanvasStyles();
        } finally {
            this.applyingResolution = false;
        }
    }

    private applyDocumentStyles(): void {
        const rootStyle = document.documentElement.style;
        rootStyle.width = '100%';
        rootStyle.height = '100%';
        rootStyle.margin = '0';
        rootStyle.padding = '0';
        rootStyle.overflow = 'hidden';
        rootStyle.background = '#f7f6f2';

        const bodyStyle = document.body.style;
        bodyStyle.width = '100%';
        bodyStyle.height = '100%';
        bodyStyle.margin = '0';
        bodyStyle.padding = '0';
        bodyStyle.overflow = 'hidden';
        bodyStyle.background = '#f7f6f2';
    }

    private applyCanvasStyles(): void {
        const container = document.getElementById('Cocos3dGameContainer')
            ?? document.getElementById('GameDiv')
            ?? document.getElementById('GameContainer');

        if (container instanceof HTMLElement) {
            const style = container.style;
            style.position = 'fixed';
            style.inset = '0';
            style.width = '100vw';
            style.height = '100vh';
            style.maxWidth = 'none';
            style.maxHeight = 'none';
            style.margin = '0';
            style.padding = '0';
            style.overflow = 'hidden';
            style.background = '#f7f6f2';
        }

        const canvas = document.getElementById('GameCanvas')
            ?? document.querySelector('canvas');

        if (canvas instanceof HTMLCanvasElement) {
            const style = canvas.style;
            style.position = 'absolute';
            style.inset = '0';
            style.display = 'block';
            style.width = '100%';
            style.height = '100%';
            style.maxWidth = 'none';
            style.maxHeight = 'none';
            style.margin = '0';
            style.padding = '0';
            style.background = '#f7f6f2';
        }
    }

    private hasBrowserDom(): boolean {
        return typeof window !== 'undefined'
            && typeof document !== 'undefined'
            && Boolean(document.documentElement)
            && Boolean(document.body);
    }

    private readSnapshot(): ViewportSnapshot {
        const visible = view.getVisibleSize();
        const width = Math.max(1, visible.width);
        const height = Math.max(1, visible.height);
        const safeArea = sys.getSafeAreaRect();

        const safeInsets: ViewportInsets = {
            left: Math.max(0, safeArea.x),
            bottom: Math.max(0, safeArea.y),
            right: Math.max(0, width - safeArea.x - safeArea.width),
            top: Math.max(0, height - safeArea.y - safeArea.height),
        };

        return {
            width,
            height,
            orientation: width >= height ? 'landscape' : 'portrait',
            breakpoint: width < 720 ? 'compact' : width < 1180 ? 'medium' : 'wide',
            safeInsets,
        };
    }

    private equals(left: ViewportSnapshot, right: ViewportSnapshot): boolean {
        return left.width === right.width
            && left.height === right.height
            && left.orientation === right.orientation
            && left.breakpoint === right.breakpoint
            && left.safeInsets.top === right.safeInsets.top
            && left.safeInsets.right === right.safeInsets.right
            && left.safeInsets.bottom === right.safeInsets.bottom
            && left.safeInsets.left === right.safeInsets.left;
    }
}
