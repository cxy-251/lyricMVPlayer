import {
    Color,
    EventMouse,
    EventTouch,
    Graphics,
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
    createUiNode,
    fillNode,
    palette,
} from '../../ui/UiFactory';
import { CursorSpaceModel } from './CursorSpaceModel';
import type { CursorSpaceBounds } from './CursorSpaceTypes';

const CURSOR_POINTS: ReadonlyArray<readonly [number, number]> = [
    [16, 0],
    [-9, 10],
    [-5, 2],
    [-13, -3],
    [-11, -7],
    [-3, -2],
    [-3, -10],
];

const ENEMY_POINTS: ReadonlyArray<readonly [number, number]> = [
    [12, 0],
    [-8, 7],
    [-5, 0],
    [-8, -7],
];

class CursorSpaceModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'CursorSpace';

    private readonly clock = new FixedStepClock(1 / 120, 12);
    private readonly model = new CursorSpaceModel();
    private readonly screenPoint = new Vec3();
    private readonly localPoint = new Vec3();
    private readonly projectileColor = new Color(
        palette.primaryText.r,
        palette.primaryText.g,
        palette.primaryText.b,
        220,
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
        255,
    );
    private readonly starColor = new Color(
        palette.subtle.r,
        palette.subtle.g,
        palette.subtle.b,
        72,
    );

    private starsGraphics: Graphics | null = null;
    private enemiesGraphics: Graphics | null = null;
    private projectilesGraphics: Graphics | null = null;
    private effectsGraphics: Graphics | null = null;
    private playerGraphics: Graphics | null = null;
    private paused = false;

    protected onMount(): void {
        this.model.reset();
        this.clock.reset();
        this.bindPointerInput();
    }

    protected onUnmount(): void {
        this.unbindPointerInput();
        this.model.clearTarget();
        this.clock.reset();
        this.starsGraphics = null;
        this.enemiesGraphics = null;
        this.projectilesGraphics = null;
        this.effectsGraphics = null;
        this.playerGraphics = null;
    }

    update(dt: number): void {
        if (this.paused) {
            return;
        }

        const steps = this.clock.advance(dt, 1, (step) => {
            this.model.step(step);
        });

        if (steps > 0) {
            this.drawFrame();
        }
    }

    pause(): void {
        this.paused = true;
        this.model.clearTarget();
    }

    resume(): void {
        this.paused = false;
    }

    reset(): void {
        this.model.reset();
        this.clock.reset();
        this.drawFrame();
    }

    protected render(viewport: ViewportSnapshot): void {
        const root = this.requireRoot();
        clearNode(root);
        fillNode(root, viewport.width, viewport.height, palette.background);

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = Math.max(
            24,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const safeHeight = Math.max(
            24,
            viewport.height - viewport.safeInsets.top - viewport.safeInsets.bottom,
        );
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const safeCenterY = (viewport.safeInsets.bottom - viewport.safeInsets.top) / 2;
        const navigationHeight = compact ? 62 : 72;
        const playWidth = Math.max(24, safeWidth - (compact ? 20 : 32));
        const playHeight = Math.max(24, safeHeight - navigationHeight - 20);
        const playCenterY = safeCenterY - navigationHeight / 2 + 4;
        const bounds: CursorSpaceBounds = {
            left: centerX - playWidth / 2,
            right: centerX + playWidth / 2,
            bottom: playCenterY - playHeight / 2,
            top: playCenterY + playHeight / 2,
        };
        this.model.setBounds(bounds);

        this.starsGraphics = createUiNode(
            root,
            'CursorSpaceStars',
            viewport.width,
            viewport.height,
        ).addComponent(Graphics);
        this.enemiesGraphics = createUiNode(
            root,
            'CursorSpaceEnemies',
            viewport.width,
            viewport.height,
        ).addComponent(Graphics);
        this.projectilesGraphics = createUiNode(
            root,
            'CursorSpaceProjectiles',
            viewport.width,
            viewport.height,
        ).addComponent(Graphics);
        this.effectsGraphics = createUiNode(
            root,
            'CursorSpaceEffects',
            viewport.width,
            viewport.height,
        ).addComponent(Graphics);
        this.playerGraphics = createUiNode(
            root,
            'CursorSpacePlayer',
            viewport.width,
            viewport.height,
        ).addComponent(Graphics);

        this.drawStars(bounds);
        this.drawFrame();
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
        const location = event.getUILocation();
        this.updateTarget(location.x, location.y);
    };

    private readonly handleTouch = (event: EventTouch): void => {
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
        transform.convertToNodeSpaceAR(this.screenPoint, this.localPoint);
        this.model.setTarget(this.localPoint.x, this.localPoint.y);
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
        const count = Math.max(18, Math.min(64, Math.round(width * height / 16_000)));

        for (let index = 0; index < count; index += 1) {
            const xHash = ((index * 73 + 19) % 101) / 100;
            const yHash = ((index * 47 + 31) % 97) / 96;
            const radius = index % 7 === 0 ? 1.4 : 0.8;
            graphics.circle(
                bounds.left + xHash * width,
                bounds.bottom + yHash * height,
                radius,
            );
        }

        graphics.fill();
    }

    private drawFrame(): void {
        this.drawEnemies();
        this.drawProjectiles();
        this.drawEffects();
        this.drawPlayer();
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
                ENEMY_POINTS,
            );
        }

        if (visible) {
            graphics.fill();
        }
    }

    private drawProjectiles(): void {
        const graphics = this.projectilesGraphics;

        if (!graphics) {
            return;
        }

        graphics.clear();
        graphics.strokeColor = this.projectileColor;
        graphics.lineWidth = 2;
        let visible = false;

        for (const projectile of this.model.projectiles) {
            if (!projectile.active) {
                continue;
            }

            const speed = Math.max(0.0001, Math.sqrt(
                projectile.velocity.x * projectile.velocity.x
                + projectile.velocity.y * projectile.velocity.y,
            ));
            const tailX = projectile.position.x - projectile.velocity.x / speed * 7;
            const tailY = projectile.position.y - projectile.velocity.y / speed * 7;
            graphics.moveTo(tailX, tailY);
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
        graphics.lineWidth = 1.5;

        for (const effect of this.model.effects) {
            if (!effect.active) {
                continue;
            }

            const progress = Math.max(0, effect.life / Math.max(0.0001, effect.initialLife));
            this.effectColor.a = Math.round(220 * progress);
            graphics.strokeColor = this.effectColor;

            if (effect.kind === 'ring') {
                graphics.circle(effect.position.x, effect.position.y, effect.radius);
                graphics.stroke();
                continue;
            }

            const speed = Math.max(0.0001, Math.sqrt(
                effect.velocity.x * effect.velocity.x
                + effect.velocity.y * effect.velocity.y,
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
            graphics.stroke();
        }
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

        const speed = Math.sqrt(
            player.velocity.x * player.velocity.x
            + player.velocity.y * player.velocity.y,
        );

        if (speed > 16) {
            const directionX = player.velocity.x / speed;
            const directionY = player.velocity.y / speed;
            graphics.strokeColor = this.playerColor;
            graphics.lineWidth = 1.5;
            graphics.moveTo(
                player.position.x - directionX * 11,
                player.position.y - directionY * 11,
            );
            graphics.lineTo(
                player.position.x - directionX * Math.min(26, 11 + speed * 0.035),
                player.position.y - directionY * Math.min(26, 11 + speed * 0.035),
            );
            graphics.stroke();
        }

        graphics.fillColor = this.playerColor;
        graphics.strokeColor = palette.primaryText;
        graphics.lineWidth = 1.25;
        this.appendPolygon(
            graphics,
            player.position.x,
            player.position.y,
            player.rotation,
            CURSOR_POINTS,
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
    description: 'Guide a cursor-shaped ship through an endless field of geometric pursuers.',
    category: 'game',
    labId: 'games',
    tags: ['cursor', 'survival', 'minimal'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 10,
    create: () => new CursorSpaceModule(),
};
