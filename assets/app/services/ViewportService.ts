import {
    director,
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
    private surfaceWidth = 0;
    private surfaceHeight = 0;
    private previewToolbarInset = 0;

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
            window.addEventListener('pointermove', this.handlePreviewPointerMove, { passive: true });
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
            window.removeEventListener('pointermove', this.handlePreviewPointerMove);

            if (this.animationFrame !== 0) {
                window.cancelAnimationFrame(this.animationFrame);
                this.animationFrame = 0;
            }
        }

        this.surfaceWidth = 0;
        this.surfaceHeight = 0;
        this.previewToolbarInset = 0;
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

    private readonly handlePreviewPointerMove = (event: PointerEvent): void => {
        // Creator reveals its preview controls when the pointer reaches the top.
        // Re-scan at that moment so the navigation bar stays below the overlay.
        if (event.clientY <= 110) {
            this.scheduleBrowserSurfaceSync();
        }
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

        const browserViewport = window.visualViewport;
        const width = Math.max(1, Math.round(
            browserViewport?.width
            ?? document.documentElement.clientWidth
            ?? window.innerWidth,
        ));
        const height = Math.max(1, Math.round(
            browserViewport?.height
            ?? document.documentElement.clientHeight
            ?? window.innerHeight,
        ));
        this.previewToolbarInset = this.detectCreatorPreviewToolbarInset();

        this.applyDocumentStyles();
        this.applyCanvasStyles();

        if (width === this.surfaceWidth && height === this.surfaceHeight) {
            return;
        }

        this.applyingResolution = true;

        try {
            this.surfaceWidth = width;
            this.surfaceHeight = height;

            // Resize the DOM frame, canvas, design coordinate space and render
            // target together. Leaving any one at 1280 x 720 creates borders.
            view.setFrameSize(width, height);
            view.setCanvasSize(width, height);
            view.setDesignResolutionSize(width, height, ResolutionPolicy.EXACT_FIT);

            const canvasSize = view.getCanvasSize();
            director.root?.resize(
                Math.max(1, Math.round(canvasSize.width)),
                Math.max(1, Math.round(canvasSize.height)),
            );
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

    private detectCreatorPreviewToolbarInset(): number {
        if (!this.hasBrowserDom()) {
            return 0;
        }

        let previewScriptDetected = false;
        let controlCount = 0;
        let maximumBottom = 0;

        for (const currentDocument of this.accessibleDocuments()) {
            const scriptSources = Array.from(currentDocument.scripts)
                .map((script) => script.src)
                .join(' ');

            if (/preview-scripts|cocos[^/]*preview|\/preview\//i.test(scriptSources)) {
                previewScriptDetected = true;
            }

            const gameRoots = [
                currentDocument.getElementById('Cocos3dGameContainer'),
                currentDocument.getElementById('GameDiv'),
                currentDocument.getElementById('GameContainer'),
                currentDocument.getElementById('GameCanvas'),
            ].filter((candidate): candidate is HTMLElement => candidate instanceof HTMLElement);

            const controls = currentDocument.querySelectorAll<HTMLElement>(
                'select, input, button, [role="button"]',
            );

            for (const control of Array.from(controls)) {
                if (gameRoots.some((root) => root.contains(control))) {
                    continue;
                }

                const rect = control.getBoundingClientRect();

                if (
                    rect.width <= 0
                    || rect.height < 16
                    || rect.height > 72
                    || rect.bottom <= 0
                    || rect.top > 96
                ) {
                    continue;
                }

                controlCount += 1;
                maximumBottom = Math.max(maximumBottom, rect.bottom);
            }
        }

        if (controlCount >= 2) {
            return Math.max(48, Math.min(72, Math.ceil(maximumBottom + 8)));
        }

        // Creator preview scripts are a reliable fallback even when the toolbar
        // is temporarily translated off-screen until the pointer reaches it.
        return previewScriptDetected ? 56 : 0;
    }

    private accessibleDocuments(): readonly Document[] {
        const documents: Document[] = [document];

        try {
            if (window.parent !== window && window.parent.document !== document) {
                documents.push(window.parent.document);
            }
        } catch {
            // A cross-origin parent is not part of the Creator local preview.
        }

        return documents;
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

        // On Web, sys.getSafeAreaRect() may retain Boot.scene's saved 1280 x 720
        // rectangle after the browser surface has resized. Using it would turn the
        // stale size difference into a huge top inset and push navigation inward.
        if (this.hasBrowserDom()) {
            return {
                width,
                height,
                orientation: width >= height ? 'landscape' : 'portrait',
                breakpoint: width < 720 ? 'compact' : width < 1180 ? 'medium' : 'wide',
                safeInsets: {
                    top: this.previewToolbarInset,
                    right: 0,
                    bottom: 0,
                    left: 0,
                },
            };
        }

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
