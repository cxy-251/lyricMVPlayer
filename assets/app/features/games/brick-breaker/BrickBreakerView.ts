import {
    Color,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Node,
} from 'cc';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import {
    clearNode,
    createButton,
    createLabel,
    createUiNode,
    fillNode,
    palette,
} from '../../../ui/UiFactory';
import {
    BrickBreakerInputController,
    type BrickBreakerInputActions,
} from './BrickBreakerInputController';
import type {
    BrickBreakerBrickState,
    BrickBreakerPlayfieldLayout,
    BrickBreakerPowerupKind,
    BrickBreakerViewState,
} from './BrickBreakerTypes';

export type BrickBreakerViewActions = BrickBreakerInputActions;

const BRICK_COLORS: readonly Color[] = [
    new Color(112, 139, 126, 255),
    new Color(118, 158, 196, 255),
    new Color(144, 126, 190, 255),
    new Color(181, 149, 95, 255),
    new Color(95, 164, 164, 255),
];

export class BrickBreakerView {
    private readonly inputController: BrickBreakerInputController;
    private graphics: Graphics | null = null;
    private statusLabel: Label | null = null;
    private scoreLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private resultLabel: Label | null = null;
    private playfieldLayout: BrickBreakerPlayfieldLayout | null = null;
    private compactLayout = false;

    constructor(
        private readonly root: Node,
        private readonly actions: BrickBreakerViewActions,
    ) {
        this.inputController = new BrickBreakerInputController(root, actions);
    }

    layout(viewport: ViewportSnapshot): void {
        clearNode(this.root);
        this.root.setPosition(0, 0, 0);
        fillNode(this.root, viewport.width, viewport.height, palette.background);
        this.graphics = null;
        this.statusLabel = null;
        this.scoreLabel = null;
        this.hintLabel = null;
        this.resultLabel = null;

        const compact = viewport.breakpoint === 'compact';
        this.compactLayout = compact;
        const safeWidth = Math.max(
            2,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const safeTop = viewport.height / 2 - viewport.safeInsets.top;
        const safeBottom = -viewport.height / 2 + viewport.safeInsets.bottom;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const navigationReserve = compact ? 64 : 72;
        const contentTop = safeTop - navigationReserve;
        const contentBottom = safeBottom + (compact ? 12 : 18);
        const hudHeight = compact ? 98 : 110;
        const footerHeight = compact ? 26 : 32;
        const horizontalPadding = compact ? 18 : 34;
        const worldAspect = 360 / 560;
        const availableHeight = Math.max(
            160,
            contentTop - contentBottom - hudHeight - footerHeight,
        );
        const playHeight = Math.max(
            160,
            Math.min(
                availableHeight,
                (safeWidth - horizontalPadding) / worldAspect,
                compact ? 560 : 650,
            ),
        );
        const playWidth = playHeight * worldAspect;
        const playTop = contentTop - hudHeight;
        const playBottom = playTop - playHeight;
        const playCenterY = (playTop + playBottom) / 2;
        this.playfieldLayout = {
            left: centerX - playWidth / 2,
            bottom: playBottom,
            width: playWidth,
            height: playHeight,
        };
        this.inputController.setPlayfield(this.playfieldLayout);

        const statusNode = createLabel(
            this.root,
            '',
            playWidth,
            compact ? 20 : 24,
            compact ? 12 : 14,
            palette.text,
            centerX,
            contentTop - (compact ? 11 : 13),
            HorizontalTextAlignment.CENTER,
        );
        this.statusLabel = statusNode.getComponent(Label);
        if (this.statusLabel) {
            this.statusLabel.enableWrapText = false;
        }

        const buttonY = contentTop - (compact ? 73 : 82);
        createButton(this.root, {
            name: 'BrickBreakerLaunchButton',
            text: 'LAUNCH',
            width: compact ? 78 : 90,
            height: compact ? 32 : 36,
            x: centerX - (compact ? 43 : 49),
            y: buttonY,
            fontSize: compact ? 11 : 12,
            variant: 'primary',
            onPress: () => this.actions.launch(),
        });
        createButton(this.root, {
            name: 'BrickBreakerNewButton',
            text: 'NEW',
            width: compact ? 68 : 78,
            height: compact ? 32 : 36,
            x: centerX + (compact ? 43 : 49),
            y: buttonY,
            fontSize: compact ? 11 : 12,
            variant: 'secondary',
            onPress: () => this.actions.restart(),
        });

        const scoreNode = createLabel(
            this.root,
            '',
            playWidth,
            compact ? 18 : 22,
            compact ? 9 : 11,
            palette.muted,
            centerX,
            contentTop - (compact ? 37 : 43),
        );
        this.scoreLabel = scoreNode.getComponent(Label);
        if (this.scoreLabel) {
            this.scoreLabel.enableWrapText = false;
        }

        const hintNode = createLabel(
            this.root,
            '',
            Math.min(playWidth, 560),
            compact ? 18 : 22,
            compact ? 9 : 10,
            palette.muted,
            centerX,
            playBottom - (compact ? 17 : 20),
        );
        this.hintLabel = hintNode.getComponent(Label);
        if (this.hintLabel) {
            this.hintLabel.enableWrapText = false;
        }

        const playfield = createUiNode(
            this.root,
            'BrickBreakerPlayfield',
            playWidth,
            playHeight,
            centerX,
            playCenterY,
        );
        this.graphics = playfield.addComponent(Graphics);

        const resultNode = createLabel(
            playfield,
            '',
            Math.min(playWidth - 24, 320),
            58,
            compact ? 18 : 22,
            palette.primaryText,
            0,
            -playHeight * 0.04,
        );
        this.resultLabel = resultNode.getComponent(Label);
        if (this.resultLabel) {
            this.resultLabel.enableWrapText = false;
        }
    }

    render(state: BrickBreakerViewState): void {
        if (!this.graphics || !this.playfieldLayout) {
            return;
        }
        this.drawPlayfield(state);
        if (this.statusLabel) {
            this.statusLabel.string = state.status;
            this.statusLabel.color = state.phase === 'lost'
                ? palette.danger
                : state.phase === 'won'
                    ? palette.accent
                    : palette.text;
        }
        if (this.scoreLabel) {
            this.scoreLabel.string = state.scoreText;
        }
        if (this.hintLabel) {
            this.hintLabel.string = this.compactLayout
                ? state.phase === 'lost'
                    ? 'TAP OR SPACE TO RESTART'
                    : state.controller === 'autopilot'
                        ? 'AI ACTIVE — TOUCH TO TAKE OVER'
                        : state.phase === 'ready'
                            ? 'MOVE, THEN TAP TO LAUNCH'
                            : 'DRAG OR USE LEFT / RIGHT'
                : state.hint;
        }
        if (this.resultLabel) {
            this.resultLabel.string = state.phase === 'lost'
                ? 'GAME OVER'
                : state.phase === 'won'
                    ? 'LEVEL CLEAR'
                    : state.phase === 'paused'
                        ? 'PAUSED'
                        : '';
            this.resultLabel.color = state.phase === 'lost'
                ? palette.danger
                : palette.primaryText;
        }
    }

    destroy(): void {
        this.inputController.destroy();
        this.graphics = null;
        this.statusLabel = null;
        this.scoreLabel = null;
        this.hintLabel = null;
        this.resultLabel = null;
        this.playfieldLayout = null;
        clearNode(this.root);
    }

    private drawPlayfield(state: BrickBreakerViewState): void {
        const graphics = this.graphics;
        const layout = this.playfieldLayout;
        if (!graphics || !layout) {
            return;
        }
        const width = layout.width;
        const height = layout.height;
        const scale = width / (state.worldHalfWidth * 2);
        graphics.clear();
        graphics.fillColor = palette.backgroundRaised;
        graphics.fillRect(-width / 2, -height / 2, width, height);
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = Math.max(1.5, scale * 1.2);
        graphics.rect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2);
        graphics.stroke();

        this.drawGuide(graphics, state, scale);
        for (const brick of state.bricks) {
            if (brick.active) {
                this.drawBrick(graphics, brick, scale);
            }
        }
        for (const powerup of state.powerups) {
            if (powerup.active) {
                this.drawPowerup(
                    graphics,
                    powerup.kind,
                    powerup.x * scale,
                    powerup.y * scale,
                    scale,
                );
            }
        }
        this.drawPaddle(graphics, state, scale);
        for (const ball of state.balls) {
            if (!ball.active) {
                continue;
            }
            graphics.fillColor = state.pierceRemaining > 0
                ? palette.warning
                : palette.primaryText;
            graphics.circle(
                ball.x * scale,
                ball.y * scale,
                Math.max(2.5, ball.radius * scale),
            );
            graphics.fill();
        }
    }

    private drawGuide(
        graphics: Graphics,
        state: BrickBreakerViewState,
        scale: number,
    ): void {
        const y = state.paddle.y * scale - state.paddle.height * scale * 1.5;
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1;
        graphics.moveTo(-state.worldHalfWidth * scale + 8, y);
        graphics.lineTo(state.worldHalfWidth * scale - 8, y);
        graphics.stroke();
    }

    private drawBrick(
        graphics: Graphics,
        brick: BrickBreakerBrickState,
        scale: number,
    ): void {
        const width = brick.width * scale;
        const height = brick.height * scale;
        const left = brick.x * scale - width / 2;
        const bottom = brick.y * scale - height / 2;
        graphics.fillColor = brick.kind === 'solid'
            ? palette.surfaceStrong
            : BRICK_COLORS[brick.id % BRICK_COLORS.length];
        graphics.fillRect(left, bottom, width, height);
        graphics.strokeColor = brick.kind === 'solid'
            ? palette.primaryText
            : palette.borderStrong;
        graphics.lineWidth = Math.max(1, scale * 0.75);
        graphics.rect(left, bottom, width, height);
        graphics.stroke();

        if (brick.kind === 'strong' && brick.hitPoints === brick.maximumHitPoints) {
            graphics.strokeColor = palette.primaryText;
            graphics.lineWidth = Math.max(1, scale * 0.65);
            graphics.moveTo(left + width * 0.16, bottom + height * 0.5);
            graphics.lineTo(left + width * 0.84, bottom + height * 0.5);
            graphics.stroke();
        }
        if (brick.kind === 'solid') {
            graphics.strokeColor = palette.subtle;
            graphics.lineWidth = Math.max(1, scale * 0.45);
            graphics.moveTo(left + width * 0.18, bottom + height * 0.2);
            graphics.lineTo(left + width * 0.82, bottom + height * 0.8);
            graphics.moveTo(left + width * 0.18, bottom + height * 0.8);
            graphics.lineTo(left + width * 0.82, bottom + height * 0.2);
            graphics.stroke();
        }
    }

    private drawPaddle(
        graphics: Graphics,
        state: BrickBreakerViewState,
        scale: number,
    ): void {
        const width = state.paddle.width * scale;
        const height = state.paddle.height * scale;
        const left = state.paddle.x * scale - width / 2;
        const bottom = state.paddle.y * scale - height / 2;
        graphics.fillColor = state.expandRemaining > 0
            ? palette.accent
            : palette.primary;
        graphics.roundRect(left, bottom, width, height, Math.max(2, height * 0.45));
        graphics.fill();
        graphics.strokeColor = palette.primaryText;
        graphics.lineWidth = Math.max(1, scale);
        graphics.roundRect(left, bottom, width, height, Math.max(2, height * 0.45));
        graphics.stroke();
    }

    private drawPowerup(
        graphics: Graphics,
        kind: BrickBreakerPowerupKind,
        x: number,
        y: number,
        scale: number,
    ): void {
        const radius = Math.max(5, 8.5 * scale);
        graphics.fillColor = kind === 'expand'
            ? palette.accent
            : kind === 'multiball'
                ? new Color(118, 158, 196, 255)
                : palette.warning;
        graphics.circle(x, y, radius);
        graphics.fill();
        graphics.strokeColor = palette.primaryText;
        graphics.lineWidth = Math.max(1, scale * 0.75);

        if (kind === 'expand') {
            graphics.moveTo(x - radius * 0.58, y);
            graphics.lineTo(x + radius * 0.58, y);
            graphics.moveTo(x - radius * 0.58, y);
            graphics.lineTo(x - radius * 0.3, y + radius * 0.25);
            graphics.moveTo(x - radius * 0.58, y);
            graphics.lineTo(x - radius * 0.3, y - radius * 0.25);
            graphics.moveTo(x + radius * 0.58, y);
            graphics.lineTo(x + radius * 0.3, y + radius * 0.25);
            graphics.moveTo(x + radius * 0.58, y);
            graphics.lineTo(x + radius * 0.3, y - radius * 0.25);
        } else if (kind === 'multiball') {
            graphics.circle(x - radius * 0.32, y, radius * 0.17);
            graphics.circle(x + radius * 0.32, y, radius * 0.17);
            graphics.circle(x, y + radius * 0.3, radius * 0.17);
        } else {
            graphics.moveTo(x - radius * 0.45, y - radius * 0.52);
            graphics.lineTo(x + radius * 0.5, y);
            graphics.lineTo(x - radius * 0.45, y + radius * 0.52);
        }
        graphics.stroke();
    }
}
