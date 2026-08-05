import {
    Color,
    HorizontalTextAlignment,
    Label,
    Node,
} from 'cc';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import {
    clearNode,
    createLabel,
    fillNode,
    palette,
} from '../../../ui/UiFactory';
import type { CursorSpaceBounds } from './CursorSpaceModel';
import {
    CursorSpaceInputController,
    type CursorSpaceViewActions,
} from './input/CursorSpaceInputController';
import {
    CursorSpaceGraphicsRenderer,
} from './rendering/CursorSpaceGraphicsRenderer';
import {
    CursorSpaceInstancedRenderer,
} from './rendering/CursorSpaceInstancedRenderer';
import type {
    CursorSpaceRenderCapacity,
    CursorSpaceViewState,
} from './CursorSpaceViewTypes';

export type { CursorSpaceViewActions } from './input/CursorSpaceInputController';

export class CursorSpaceView {
    private readonly playerProjectileColor = new Color(
        palette.primaryText.r,
        palette.primaryText.g,
        palette.primaryText.b,
        225,
    );
    private readonly enemyProjectileColor = new Color(
        palette.danger.r,
        palette.danger.g,
        palette.danger.b,
        235,
    );
    private readonly enemyColor = new Color(
        palette.warning.r,
        palette.warning.g,
        palette.warning.b,
        220,
    );
    private readonly playerColor = new Color(
        palette.accent.r,
        palette.accent.g,
        palette.accent.b,
        255,
    );
    private readonly effectColor = new Color(
        palette.primaryText.r,
        palette.primaryText.g,
        palette.primaryText.b,
        215,
    );
    private readonly starColor = new Color(
        palette.subtle.r,
        palette.subtle.g,
        palette.subtle.b,
        72,
    );
    private readonly inputController: CursorSpaceInputController;
    private readonly graphicsRenderer: CursorSpaceGraphicsRenderer;

    private instancedRenderer: CursorSpaceInstancedRenderer | null = null;
    private statsLabel: Label | null = null;
    private statsBaseFontSize = 12;
    private statsCharacterBudget = 68;

    constructor(
        private readonly root: Node,
        private readonly capacity: CursorSpaceRenderCapacity,
        private readonly actions: CursorSpaceViewActions,
    ) {
        this.inputController = new CursorSpaceInputController(root, actions);
        this.graphicsRenderer = new CursorSpaceGraphicsRenderer(root, {
            playerProjectile: this.playerProjectileColor,
            enemyProjectile: this.enemyProjectileColor,
            enemy: this.enemyColor,
            player: this.playerColor,
            effect: this.effectColor,
            star: this.starColor,
        });
    }

    layout(viewport: ViewportSnapshot): void {
        this.instancedRenderer?.dispose();
        this.instancedRenderer = null;
        this.graphicsRenderer.dispose();
        this.statsLabel = null;
        clearNode(this.root);
        this.root.setPosition(0, 0, 0);
        fillNode(this.root, viewport.width, viewport.height, palette.background);

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = Math.max(
            2,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const safeHeight = Math.max(
            2,
            viewport.height - viewport.safeInsets.top - viewport.safeInsets.bottom,
        );
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const safeCenterY = (viewport.safeInsets.bottom - viewport.safeInsets.top) / 2;
        const navigationHeight = compact ? 62 : 72;
        const playWidth = Math.max(2, safeWidth - (compact ? 20 : 32));
        const playHeight = Math.max(2, safeHeight - navigationHeight - 20);
        const playCenterY = safeCenterY - navigationHeight / 2 + 4;
        const bounds: CursorSpaceBounds = {
            left: centerX - playWidth / 2,
            right: centerX + playWidth / 2,
            bottom: playCenterY - playHeight / 2,
            top: playCenterY + playHeight / 2,
        };
        this.actions.boundsChanged(bounds);

        try {
            this.instancedRenderer = new CursorSpaceInstancedRenderer({
                parent: this.root,
                viewport,
                bounds,
                enemyCapacity: this.capacity.enemies,
                projectileCapacity: this.capacity.projectiles,
                effectCapacity: this.capacity.effects,
                colors: {
                    enemy: this.enemyColor,
                    playerProjectile: this.playerProjectileColor,
                    enemyProjectile: this.enemyProjectileColor,
                    effect: this.effectColor,
                    player: this.playerColor,
                    playerOutline: palette.primaryText,
                },
            });
        } catch (error) {
            console.warn(
                '[cocoslab] Cursor Space GPU instancing unavailable; using Graphics fallback',
                error,
            );
            this.instancedRenderer = null;
        }

        this.graphicsRenderer.layout(viewport, bounds, !this.instancedRenderer);
        const statsY = bounds.top + Math.max(12, (navigationHeight - 12) * 0.45);
        this.statsBaseFontSize = compact ? 10 : 12;
        this.statsCharacterBudget = compact ? 46 : 68;
        const statsNode = createLabel(
            this.root,
            '',
            Math.min(playWidth, compact ? 420 : 720),
            compact ? 20 : 24,
            this.statsBaseFontSize,
            palette.muted,
            centerX,
            statsY,
            HorizontalTextAlignment.CENTER,
        );
        this.statsLabel = statsNode.getComponent(Label);
        if (this.statsLabel) {
            this.statsLabel.enableWrapText = false;
        }
    }

    render(state: CursorSpaceViewState): void {
        this.instancedRenderer?.sync(state);
        this.graphicsRenderer.render(state);
        if (this.statsLabel) {
            const ratio = Math.min(
                1,
                this.statsCharacterBudget / Math.max(1, state.stats.length),
            );
            const fontSize = Math.max(
                7,
                Math.floor(this.statsBaseFontSize * Math.sqrt(ratio)),
            );
            this.statsLabel.fontSize = fontSize;
            this.statsLabel.lineHeight = Math.round(fontSize * 1.35);
            this.statsLabel.string = state.stats;
        }
    }

    destroy(): void {
        this.inputController.destroy();
        this.instancedRenderer?.dispose();
        this.instancedRenderer = null;
        this.graphicsRenderer.dispose();
        this.statsLabel = null;
        clearNode(this.root);
    }
}
