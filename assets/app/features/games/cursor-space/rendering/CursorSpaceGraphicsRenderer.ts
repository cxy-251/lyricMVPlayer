import { Color, Graphics, Node } from 'cc';
import type { ViewportSnapshot } from '../../../../services/ViewportService';
import { createUiNode, palette } from '../../../../ui/UiFactory';
import type { CursorSpaceBounds } from '../CursorSpaceModel';
import type {
    CursorSpaceProjectileOwner,
    CursorSpaceViewState,
} from '../CursorSpaceViewTypes';
import {
    CURSOR_SPACE_CURSOR_POINTS,
    CURSOR_SPACE_ENEMY_POINTS,
} from './CursorSpaceInstancedRenderer';

const ENEMY_HIT_EXPLOSION_DURATION = 0.24;

export interface CursorSpaceGraphicsColors {
    readonly playerProjectile: Color;
    readonly enemyProjectile: Color;
    readonly enemy: Color;
    readonly player: Color;
    readonly effect: Color;
    readonly star: Color;
}

export class CursorSpaceGraphicsRenderer {
    private starsGraphics: Graphics | null = null;
    private hitExplosionsGraphics: Graphics | null = null;
    private enemiesGraphics: Graphics | null = null;
    private playerProjectilesGraphics: Graphics | null = null;
    private enemyProjectilesGraphics: Graphics | null = null;
    private effectsGraphics: Graphics | null = null;
    private playerTrailGraphics: Graphics | null = null;
    private escortsGraphics: Graphics | null = null;
    private playerGraphics: Graphics | null = null;
    private fallbackEnabled = false;

    constructor(
        private readonly root: Node,
        private readonly colors: CursorSpaceGraphicsColors,
    ) {}

    layout(
        viewport: ViewportSnapshot,
        bounds: Readonly<CursorSpaceBounds>,
        fallbackEnabled: boolean,
    ): void {
        this.clearReferences();
        this.fallbackEnabled = fallbackEnabled;
        this.starsGraphics = this.createGraphics('CursorSpaceStars', viewport);
        this.hitExplosionsGraphics = this.createGraphics('CursorSpaceHitExplosions', viewport);

        if (fallbackEnabled) {
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

        this.drawStars(bounds);
    }

    render(state: CursorSpaceViewState): void {
        if (this.fallbackEnabled) {
            this.drawEnemies(state);
            this.drawProjectiles(
                state,
                'player',
                this.playerProjectilesGraphics,
                this.colors.playerProjectile,
            );
            this.drawProjectiles(
                state,
                'enemy',
                this.enemyProjectilesGraphics,
                this.colors.enemyProjectile,
            );
            this.drawEffects(state);
            this.drawPlayerTrail(state);
            this.drawEscorts(state);
            this.drawPlayer(state);
        }
        this.drawHitExplosions(state);
    }

    dispose(): void {
        this.clearReferences();
        this.fallbackEnabled = false;
    }

    private createGraphics(name: string, viewport: ViewportSnapshot): Graphics {
        return createUiNode(
            this.root,
            name,
            viewport.width,
            viewport.height,
        ).addComponent(Graphics);
    }

    private clearReferences(): void {
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
        graphics.fillColor = this.colors.star;
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
        graphics.strokeColor = this.colors.effect;
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
        graphics.fillColor = this.colors.enemy;
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
        graphics.strokeColor = this.colors.effect;
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
        graphics.strokeColor = this.colors.player;
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
        if (!graphics) {
            return;
        }

        graphics.clear();
        graphics.fillColor = this.colors.player;
        let visible = false;
        for (const escort of state.escorts) {
            if (!escort.active) {
                continue;
            }
            visible = true;
            this.appendPolygon(
                graphics,
                escort.x,
                escort.y,
                escort.rotation,
                CURSOR_SPACE_CURSOR_POINTS,
                0.48,
            );
        }
        if (visible) {
            graphics.fill();
        }
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
        graphics.fillColor = this.colors.player;
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
