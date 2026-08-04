import type { ViewportSnapshot } from '../../services/ViewportService';

export interface SafeViewportLayout {
    readonly width: number;
    readonly height: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
    readonly centerX: number;
    readonly centerY: number;
    readonly compact: boolean;
}

export function createSafeViewportLayout(
    viewport: ViewportSnapshot,
): SafeViewportLayout {
    const left = -viewport.width / 2 + viewport.safeInsets.left;
    const right = viewport.width / 2 - viewport.safeInsets.right;
    const bottom = -viewport.height / 2 + viewport.safeInsets.bottom;
    const top = viewport.height / 2 - viewport.safeInsets.top;
    return {
        width: Math.max(1, right - left),
        height: Math.max(1, top - bottom),
        left,
        right,
        top,
        bottom,
        centerX: (left + right) / 2,
        centerY: (bottom + top) / 2,
        compact: viewport.breakpoint === 'compact',
    };
}

export function fitViewportScale(
    viewport: ViewportSnapshot,
    minimumWidth: number,
    minimumHeight: number,
): number {
    const safe = createSafeViewportLayout(viewport);
    return Math.min(
        1,
        safe.width / Math.max(1, minimumWidth),
        safe.height / Math.max(1, minimumHeight),
    );
}
