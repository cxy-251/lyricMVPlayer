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
import type {
    Pausable,
    Resettable,
    Updatable,
    VisibleModuleDefinition,
} from '../../contracts/InteractiveModule';
import { FixedStepClock } from '../../animation/FixedStepClock';
import type { ViewportSnapshot } from '../../services/ViewportService';
import { ResponsiveModule } from '../../templates/ResponsiveModule';
import {
    clearNode,
    createLabel,
    createUiNode,
    fillNode,
    palette,
} from '../../ui/UiFactory';
import {
    CURSOR_SPACE_CURSOR_POINTS,
    CURSOR_SPACE_ENEMY_POINTS,
    CursorSpaceInstancedRenderer,
} from './CursorSpaceInstancedRenderer';
import { CursorSpaceModel } from './CursorSpaceModel';
import type {
    CursorSpaceBounds,
    CursorSpaceProjectileOwner,
} from './CursorSpaceTypes';

const RENDER_STEP = 1 / 30;

class CursorSpaceModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'CursorSpace';

    private readonly clock = new FixedStepClock(1 / 60, 6);
    private readonly model = new CursorSpaceModel();
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
        175,
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
    private enemiesGraphics: Graphics | null = null;
    private playerProjectilesGraphics: Graphics | null = null;
    private enemyProjectilesGraphics: Graphics | null = null;
    private effectsGraphics: Graphics | null = null;
    private playerTrailGraphics: Graphics | null = null;
    private playerGraphics: Graphics | null = null;
    private renderAccumulator = 0;
    private paused = false;

    protected onMount(): void {
        this.model.reset();
        this.clock.reset();
        this.renderAccumulator = 0;
        this.bindPointerInput();
    }

    protected onUnmount(): void {
        this.unbindPointerInput();
        this.model.clearTarget();
        this.clock.reset();
        this.renderAccumulator = 0;
        this.instancedRenderer?.dispose();
        this.instancedRenderer = null;
        this.clearGraphicsReferences();
    }

    update(dt: number): void {
        if (this.paused) {
            return;
        }

        const frameDelta = Math.max(0, Math.min(0.1, dt));
        const steps = this.clock.advance(frameDelta, 1, (step) => {
            this.model.step(step);
        });
        this.renderAccumulator += frameDelta;

        if (steps > 0 && this.renderAccumulator >= RENDER_STEP) {
            this.renderAccumulator %= RENDER_STEP;
            this.drawFrame();
        }
    }

    pause(): void {
        this.paused = true;
        this.model.clearTarget();
    }

    resume(): void {
        this.paused = false;
        this.renderAccumulator = RENDER_STEP;
    }

    reset(): void {
        this.model.reset();
        this.clock.reset();
        this.renderAccumulator = 0;
        this.drawFrame();
    }

    protected render(viewport: ViewportSnapshot): void {
        const root = this.requireRoot();
        this.instancedRenderer?.dispose();
        this.instancedRenderer = null;
        this.clearGraphicsReferences();
        clearNode(root);
        fillNode(root, viewport.width, viewport.height, palette.background);

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
        this.model.setBounds(bounds);

        try {
            this.instancedRenderer = new CursorSpaceInstancedRenderer({
                parent: root,
                viewport,
                bounds,
                enemyCapacity: this.model.enemies.length,
                projectileCapacity: this.model.projectiles.length,
                effectCapacity: this.model.effects.length,
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
            clearNode(root);
        }

        this.starsGraphics = this.createGraphics(root, 'CursorSpaceStars', viewport);
        if (!this.instancedRenderer) {
            this.enemiesGraphics = this.createGraphics(root, 'CursorSpaceEnemies', viewport);
            this.playerProjectilesGraphics = this.createGraphics(
                root,
                'CursorSpacePlayerProjectiles',
                viewport,
            );
            this.enemyProjectilesGraphics = this.createGraphics(
                root,
                'CursorSpaceEnemyProjectiles',
                viewport,
            );
            this.effectsGraphics = this.createGraphics(root, 'CursorSpaceEffects', viewport);
            this.playerTrailGraphics = this.createGraphics(root, 'CursorSpacePlayerTrail', viewport);
            this.playerGraphics = this.createGraphics(root, 'CursorSpacePlayer', viewport);
        }

        const statsY = bounds.top + Math.max(12, (navigationHeight - 12) * 0.45);
        const statsNode = createLabel(
            root,
            '',
            Math.min(playWidth, compact ? 390 : 560),
            compact ? 20 : 24,
            compact ? 11 : 13,
            palette.muted,
            centerX,
            statsY,
            HorizontalTextAlignment.CENTER,
        );
        this.statsLabel = statsNode.getComponent(Label);

        this.drawStars(bounds);
        this.drawFrame();
    }

    private createGraphics(parent: Node, name: string, viewport: ViewportSnapshot): Graphics {
        return createUiNode(
            parent,
            name,
            viewport.width,
            viewport.height,
        ).addComponent(Graphics);
    }

    private clearGraphicsReferences(): void {
        this.statsLabel = null;
        this.starsGraphics = null;
        this.enemiesGraphics = null;
        this.playerProjectilesGraphics = null;
        this.enemyProjectilesGraphics = null;
        this.effectsGraphics = null;
        this.playerTrailGraphics = null;
        this.playerGraphics = null;
    }

    private bindPointerInput(): void {
        const root = this.requireRoot();
        root.on(Node.EventType.MOUSE_MOVE, this.handleMouseMove, this);
        root.on(Node.EventType.MOUSE_LEAVE, this.handlePointerLeave, this);
        root.on(Node.EventType.TOUCH_START, this.handleTouch, this);
        root.on(Node.EventType.TOUCH_MOVE, this.handleTouch, this);
        root.on(Node.EventType.TOUCH_END, this.handlePointerLeave, this);
        root.on(Node.EventType.TOUCH_CANCEL, this.handlePointerLeave, this);
    }

    private unbindPointerInput(): void {
        const root = this.root;
        if (!root) {
            return;
        }

        root.off(Node.EventType.MOUSE_MOVE, this.handleMouseMove, this);
        root.off(Node.EventType.MOUSE_LEAVE, this.handlePointerLeave, this);
        root.off(Node.EventType.TOUCH_START, this.handleTouch, this);
        root.off(Node.EventType.TOUCH_MOVE, this.handleTouch, this);
        root.off(Node.EventType.TOUCH_END, this.handlePointerLeave, this);
        root.off(Node.EventType.TOUCH_CANCEL, this.handlePointerLeave, this);
    }

    private readonly handleMouseMove = (event: EventMouse): void => {
        if (this.paused) {
            return;
        }

        const location = event.getUILocation();
        this.updateTarget(location.x, location.y);
    };

    private readonly handleTouch = (event: EventTouch): void => {
        if (this.paused) {
            return;
        }

        const location = event.getUILocation();
        this.updateTarget(location.x, location.y);
    };

    private readonly handlePointerLeave = (): void => {
        this.model.clearTarget();
    };

    private updateTarget(screenX: number, screenY: number): void {
        const root = this.root;
        const transform = root?.getComponent(UITransform);
        if (!root || !transform) {
            return;
        }

        this.screenPoint.set(screenX, screenY, 0);
        const localPoint = transform.convertToNodeSpaceAR(this.screenPoint);
        this.model.setTarget(localPoint.x, localPoint.y);
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

    private drawFrame(): void {
        if (this.instancedRenderer) {
            this.instancedRenderer.sync(
                this.model.player,
                this.model.enemies,
                this.model.projectiles,
                this.model.effects,
            );
        } else {
            this.drawEnemies();
            this.drawProjectiles(
                'player',
                this.playerProjectilesGraphics,
                this.playerProjectileColor,
            );
            this.drawProjectiles(
                'enemy',
                this.enemyProjectilesGraphics,
                this.enemyProjectileColor,
            );
            this.drawEffects();
            this.drawPlayerTrail();
            this.drawPlayer();
        }

        this.updateStatsLabel();
    }

    private updateStatsLabel(): void {
        if (!this.statsLabel) {
            return;
        }

        const stats = this.model.stats;
        this.statsLabel.string = `LEVEL ${stats.level}   DESTROYED ${stats.enemiesDestroyed}`
            + `   PLAYER ${stats.enemiesDestroyedByPlayer}   DEATHS ${stats.playerDeaths}`;
    }

    private drawEnemies(): void {
        const graphics = this.enemiesGraphics;
        if (!graphics) {
            return;
        }

        graphics.clear();
        graphics.fillColor = this.enemyColor;
        let visible = false;

        for (const enemy of this.model.enemies) {
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
            );
        }

        if (visible) {
            graphics.fill();
        }
    }

    private drawProjectiles(
        owner: CursorSpaceProjectileOwner,
        graphics: Graphics | null,
        color: Readonly<Color>,
    ): void {
        if (!graphics) {
            return;
        }

        graphics.clear();
        graphics.strokeColor = color;
        graphics.lineWidth = owner === 'enemy' ? 2.6 : 2;
        let visible = false;

        for (const projectile of this.model.projectiles) {
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

    private drawEffects(): void {
        const graphics = this.effectsGraphics;
        if (!graphics) {
            return;
        }

        graphics.clear();
        graphics.strokeColor = this.effectColor;
        graphics.lineWidth = 1.5;
        let visible = false;

        for (const effect of this.model.effects) {
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

    private drawPlayerTrail(): void {
        const graphics = this.playerTrailGraphics;
        const player = this.model.player;
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
        const length = Math.min(25, 9 + speed * 0.032);
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

    private drawPlayer(): void {
        const graphics = this.playerGraphics;
        const player = this.model.player;
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
    ): void {
        const cosine = Math.cos(rotation);
        const sine = Math.sin(rotation);

        for (let index = 0; index < points.length; index += 1) {
            const [localX, localY] = points[index];
            const pointX = x + localX * cosine - localY * sine;
            const pointY = y + localX * sine + localY * cosine;

            if (index === 0) {
                graphics.moveTo(pointX, pointY);
            } else {
                graphics.lineTo(pointX, pointY);
            }
        }

        const [firstX, firstY] = points[0];
        graphics.lineTo(
            x + firstX * cosine - firstY * sine,
            y + firstX * sine + firstY * cosine,
        );
    }
}

export const cursorSpaceDefinition: VisibleModuleDefinition = {
    id: 'cursor-space',
    title: 'Cursor Space',
    description: 'Survive escalating combat stages where every aircraft and projectile can become a threat.',
    category: 'game',
    labId: 'games',
    tags: ['cursor', 'survival', 'combat'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 10,
    create: () => new CursorSpaceModule(),
};
