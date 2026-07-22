import { screen, sys, view } from 'cc';

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

    get current(): ViewportSnapshot {
        return this.snapshot;
    }

    start(): void {
        if (this.started) {
            return;
        }

        this.started = true;
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

    private readonly handleViewportChange = (): void => {
        this.refresh();
    };

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
