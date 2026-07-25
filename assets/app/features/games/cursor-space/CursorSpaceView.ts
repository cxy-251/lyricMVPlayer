import {
    Color,
    EventMouse,
    EventTouch,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Node,
    UITransform,
    Vec3,
} from 'cc';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import {
    clearNode,
    createLabel,
    createUiNode,
    fillNode,
    palette,
} from '../../../ui/UiFactory';
import { cursorSpaceEscortWorldPosition } from '../CursorSpaceFormation';
import {
    CURSOR_SPACE_CURSOR_POINTS,
    CURSOR_SPACE_ENEMY_POINTS,
    CursorSpaceInstancedRenderer,
} from '../CursorSpaceInstancedRenderer';
import type {
    CursorSpaceBounds,
    CursorSpaceProjectileOwner,
} from '../CursorSpaceTypes';
import type {
    CursorSpaceRenderCapacity,
    CursorSpaceViewState,
} from './CursorSpaceViewTypes';

const ENEMY_HIT_EXPLOSION_DURATION = 0.24;

export interface CursorSpaceViewActions {
    boundsChanged(bounds: CursorSpaceBounds): void;
    humanTargetChanged(x: number, y: number): void;
    pointerReleased(): void;
}

export class CursorSpaceView {
    private readonly screenPoint = new Vec3();
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

    private instancedRenderer: CursorSpaceInstancedRenderer | null = null;
    private statsLabel: Label | null = null;
    private starsGraphics: Graphics | null = null;
    private hitExplosionsGraphics: Graphics | null = null;
    private enemiesGraphics: Graphics | null = null;
    private playerProjectilesGraphics: Graphics | null = null;
    private enemyProjectilesGraphics: Graphics | null = null;
    private effectsGraphics: Graphics | null = null;
    private playerTrailGraphics: Graphics | null = null;
    private escortsGraphics: Graphics | null = null;
    private playerGraphics: Graphics | null = null;

    constructor(
        private readonly root: Node,
        private readonly capacity: CursorSpaceRenderCapacity,
        private readonly actions: CursorSpaceViewActions,
    ) {
        this.bindPointerInput();
    }

    layout(viewport: ViewportSnapshot): void {
        this.instancedRenderer?.dispose();
        this.instancedRenderer = null;
        this.clearGraphicsReferences();
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
            clearNode(this.root);
        }

        this.starsGraphics = this.createGraphics('CursorSpaceStars', viewport);
        this.hitExplosionsGraphics = this.createGraphics('CursorSpaceHitExplosions', viewport);
        if (!this.instancedRenderer) {
            this.enemiesGraphics = this.createGraphics('CursorSpaceEnemies', viewport);
            this.playerProjectilesGraphics = this.createGraphics(
                'CursorSpacePlayerProjectiles',
                viewport,
            );
            this.enemyProjectilesGraphics = this.createGraphics(
                'CursorSpaceEnemyProjectiles',
                viewport,
            );
            this.effectsGraphics = this.createGraphics('CursorSpaceEffects', viewport);
            this.playerTrailGraphics = this.createGraphics('CursorSpacePlayerTrail', viewport);
            this.escortsGraphics = this.createGraphics('CursorSpaceEscorts', viewport);
            this.playerGraphics = this.createGraphics('CursorSpacePlayer', viewport);
        }

        const statsY = bounds.top + Math.max(12, (navigationHeight - 12) * 0.45);
        const statsNode = createLabel(
            this.root,
            '',
            Math.min(playWidth, compact ? 420 : 720),
            compact ? 20 : 24,
            compact ? 10 : 12,
            palette.muted,
            centerX,
            statsY,
            HorizontalTextAlignment.CENTER,
        );
        this.statsLabel = statsNode.getComponent(Label);
        if (this.statsLabel) {
            this.statsLabel.enableWrapText = false;
        }
        this.drawStars(bounds);
    }

    render(state: CursorSpaceViewState): void {
        if (this.instancedRenderer) {
            this.instancedRenderer.sync(
                state.player,
                state.enemies,
                state.projectiles,
                state.effects,
            );
        } else {
            this.drawEnemies(state);
            this.drawProjectiles(
                state,
                'player',
                this.playerProjectilesGraphics,
                this.playerProjectileColor,
            );
            this.drawProjectiles(
                state,
                'enemy',
                this.enemyProjectilesGraphics,
                this.enemyProjectileColor,
            );
            this.drawEffects(state);
            this.drawPlayerTrail(state);
            this.drawEscorts(state);
            this.drawPlayer(state);
        }

        this.drawHitExplosions(state);
        if (this.statsLabel) {
            this.statsLabel.string = state.stats;
        }
    }

    destroy(): void {
        this.unbindPointerInput();
        this.instancedRenderer?.dispose();
        this.instancedRenderer = null;
        this.clearGraphicsReferences();
        clearNode(this.root);
    }

    private bindPointerInput(): void {
        this.root.on(Node.EventType.MOUSE_MOVE, this.handleMouseMove, this);
        this.root.on(Node.EventType.MOUSE_LEAVE, this.handlePointerRelease, this);
        this.root.on(Node.EventType.TOUCH_START, this.handleTouch, this);
        this.root.on(Node.EventType.TOUCH_MOVE, this.handleTouch, this);
        this.root.on(Node.EventType.TOUCH_END, this.handlePointerRelease, this);
        this.root.on(Node.EventType.TOUCH_CANCEL, this.handlePointerRelease, this);
    }

    private unbindPointerInput(): void {
        this.root.off(Node.EventType.MOUSE_MOVE, this.handleMouseMove, this);
        this.root.off(Node.EventType.MOUSE_LEAVE, this.handlePointerRelease, this);
        this.root.off(Node.EventType.TOUCH_START, this.handleTouch, this);
        this.root.off(Node.EventType.TOUCH_MOVE, this.handleTouch, this);
        this.root.off(Node.EventType.TOUCH_END, this.handlePointerRelease, this);
        this.root.off(Node.EventType.TOUCH_CANCEL, this.handlePointerRelease, this);
    }

    private readonly handleMouseMove = (event: EventMouse): void => {
        const location = event.getUILocation();
        this.forwardScreenTarget(location.x, location.y);
    };

    private readonly handleTouch = (event: EventTouch): void => {
        const location = event.getUILocation();
        this.forwardScreenTarget(location.x, location.y);
    };

    private readonly handlePointerRelease = (): void => {
        this.actions.pointerReleased();
    };

    private forwardScreenTarget(screenX: number, screenY: number): void {
        const transform = this.root.getComponent(UITransform);
        if (!transform) {
            return;
        }

        this.screenPoint.set(screenX, screenY, 0);
        const localPoint = transform.convertToNodeSpaceAR(this.screenPoint);
        this.actions.humanTargetChanged(localPoint.x, localPoint.y);
    }

    private createGraphics(name: string, viewport: ViewportSnapshot): Graphics {
        return createUiNode(
            this.root,
            name,
            viewport.width,
            viewport.height,
        ).addComponent(Graphics);
    }

    private clearGraphicsReferences(): void {
        this.statsLabel = null;
        this.starsGraphics = null;
        this.hitExplosionsGraphics = null;
        this.enemiesGraphics = null;
        this.playerProjectilesGraphics = null;
        this.enemyProjectilesGraphics = null;
        this.effectsGraphics = null;
        this.playerTrailGraphics = null;
        this.escortsGraphics = null;
        this.playerGraphics = null;
    }

    private drawStars(bounds: Readonly<CursorSpaceBounds>): void {
        const graphics = this.starsGraphics;
        if (!graphics) {
            return;
        }

        graphics.clear();
        graphics.fillColor = this.starColor;
        const width = bounds.right - bounds.left;
        const height = bounds.top - bounds.bottom;
        const count = Math.max(16, Math.min(48, Math.round(width * height / 18_000)));

        for (let index = 0; index < count; index += 1) {
            const xHash = ((index * 73 + 19) % 101) / 100;
            const yHash = ((index * 47 + 31) % 97) / 96;
            graphics.circle(
                bounds.left + xHash * width,
                bounds.bottom + yHash * height,
                index % 7 === 0 ? 1.4 : 0.8,
            );
        }
        graphics.fill();
    }

    private drawHitExplosions(state: CursorSpaceViewState): void {
        const graphics = this.hitExplosionsGraphics;
        if (!graphics) {
            return;
        }

        graphics.clear();
        if (state.hitExplosions.length === 0) {
            return;
        }

        graphics.strokeColor = this.effectColor;
        graphics.lineWidth = 2.1;
        for (const explosion of state.hitExplosions) {
            const progress = 1 - explosion.life / ENEMY_HIT_EXPLOSION_DURATION;
            const outerRadius = 4 + progress * 15;
            const innerRadius = Math.max(1.5, outerRadius * 0.42);
            graphics.circle(explosion.x, explosion.y, outerRadius);
            graphics.circle(explosion.x, explosion.y, innerRadius);

            for (let ray = 0; ray < 6; ray += 1) {
                const angle = explosion.angle + ray * Math.PI / 3;
                const innerX = explosion.x + Math.cos(angle) * innerRadius;
                const innerY = explosion.y + Math.sin(angle) * innerRadius;
                const outerX = explosion.x + Math.cos(angle) * (outerRadius + 5);
                const outerY = explosion.y + Math.sin(angle) * (outerRadius + 5);
                graphics.moveTo(innerX, innerY);
                graphics.lineTo(outerX, outerY);
            }
        }
        graphics.stroke();
    }

    private drawEnemies(state: CursorSpaceViewState): void {
        const graphics = this.enemiesGraphics;
        if (!graphics) {
            return;
        }

        graphics.clear();
        graphics.fillColor = this.enemyColor;
        let visible = false;
        for (const enemy of state.enemies) {
            if (!enemy.active) {
                continue;
            }
            visible = true;
            this.appendPolygon(
                graphics,
                enemy.position.x,
                enemy.position.y,
                enemy.rotation,
                CURSOR_SPACE_ENEMY_POINTS,
                0.92 + (enemy.speedTier - 1) * 0.1,
            );
        }
        if (visible) {
            graphics.fill();
        }
    }

    private drawProjectiles(
        state: CursorSpaceViewState,
        owner: CursorSpaceProjectileOwner,
        graphics: Graphics | null,
        color: Readonly<Color>,
    ): void {
        if (!graphics) {
            return;
        }

        graphics.clear();
        graphics.strokeColor = color;
        graphics.lineWidth = owner === 'enemy' ? 2.6 : 1.8;
        let visible = false;
        for (const projectile of state.projectiles) {
            if (!projectile.active || projectile.owner !== owner) {
                continue;
            }
            const speed = Math.max(0.0001, Math.hypot(
                projectile.velocity.x,
                projectile.velocity.y,
            ));
            const length = owner === 'enemy' ? 9 : 7;
            graphics.moveTo(
                projectile.position.x - projectile.velocity.x / speed * length,
                projectile.position.y - projectile.velocity.y / speed * length,
            );
            graphics.lineTo(projectile.position.x, projectile.position.y);
            visible = true;
        }
        if (visible) {
            graphics.stroke();
        }
    }

    private drawEffects(state: CursorSpaceViewState): void {
        const graphics = this.effectsGraphics;
        if (!graphics) {
            return;
        }

        graphics.clear();
        graphics.strokeColor = this.effectColor;
        graphics.lineWidth = 1.5;
        let visible = false;
        for (const effect of state.effects) {
            if (!effect.active) {
                continue;
            }
            visible = true;
            if (effect.kind === 'ring') {
                graphics.circle(effect.position.x, effect.position.y, effect.radius);
                continue;
            }
            const speed = Math.max(0.0001, Math.hypot(
                effect.velocity.x,
                effect.velocity.y,
            ));
            const directionX = effect.velocity.x / speed;
            const directionY = effect.velocity.y / speed;
            graphics.moveTo(
                effect.position.x - directionX * effect.radius,
                effect.position.y - directionY * effect.radius,
            );
            graphics.lineTo(
                effect.position.x + directionX * effect.radius,
                effect.position.y + directionY * effect.radius,
            );
        }
        if (visible) {
            graphics.stroke();
        }
    }

    private drawPlayerTrail(state: CursorSpaceViewState): void {
        const graphics = this.playerTrailGraphics;
        const player = state.player;
        if (!graphics) {
            return;
        }

        graphics.clear();
        if (!player.alive) {
            return;
        }
        const speed = Math.hypot(player.velocity.x, player.velocity.y);
        if (speed <= 18) {
            return;
        }
        const directionX = player.velocity.x / speed;
        const directionY = player.velocity.y / speed;
        const length = Math.min(28, 8 + speed * 0.036);
        graphics.strokeColor = this.playerColor;
        graphics.lineWidth = 1.5;
        graphics.moveTo(
            player.position.x - directionX * 12,
            player.position.y - directionY * 12,
        );
        graphics.lineTo(
            player.position.x - directionX * length,
            player.position.y - directionY * length,
        );
        graphics.stroke();
    }

    private drawEscorts(state: CursorSpaceViewState): void {
        const graphics = this.escortsGraphics;
        const player = state.player;
        if (!graphics) {
            return;
        }

        graphics.clear();
        if (!player.alive || player.escortCount <= 0) {
            return;
        }
        graphics.fillColor = this.playerColor;
        for (let index = 0; index < player.escortCount; index += 1) {
            const position = cursorSpaceEscortWorldPosition(player, index);
            this.appendPolygon(
                graphics,
                position.x,
                position.y,
                player.rotation,
                CURSOR_SPACE_CURSOR_POINTS,
                0.48,
            );
        }
        graphics.fill();
    }

    private drawPlayer(state: CursorSpaceViewState): void {
        const graphics = this.playerGraphics;
        const player = state.player;
        if (!graphics) {
            return;
        }

        graphics.clear();
        if (!player.alive) {
            return;
        }
        if (
            player.invulnerableRemaining > 0
            && Math.floor(player.invulnerableRemaining * 12) % 2 === 0
        ) {
            return;
        }
        graphics.fillColor = this.playerColor;
        graphics.strokeColor = palette.primaryText;
        graphics.lineWidth = 1.25;
        this.appendPolygon(
            graphics,
            player.position.x,
            player.position.y,
            player.rotation,
            CURSOR_SPACE_CURSOR_POINTS,
        );
        graphics.fill();
        graphics.stroke();
    }

    private appendPolygon(
        graphics: Graphics,
        x: number,
        y: number,
        rotation: number,
        points: ReadonlyArray<readonly [number, number]>,
        scale = 1,
    ): void {
        const cosine = Math.cos(rotation);
        const sine = Math.sin(rotation);

        for (let index = 0; index < points.length; index += 1) {
            const [rawX, rawY] = points[index];
            const localX = rawX * scale;
            const localY = rawY * scale;
            const pointX = x + localX * cosine - localY * sine;
            const pointY = y + localX * sine + localY * cosine;
            if (index === 0) {
                graphics.moveTo(pointX, pointY);
            } else {
                graphics.lineTo(pointX, pointY);
            }
        }

        const [rawFirstX, rawFirstY] = points[0];
        const firstX = rawFirstX * scale;
        const firstY = rawFirstY * scale;
        graphics.lineTo(
            x + firstX * cosine - firstY * sine,
            y + firstX * sine + firstY * cosine,
        );
    }
}
