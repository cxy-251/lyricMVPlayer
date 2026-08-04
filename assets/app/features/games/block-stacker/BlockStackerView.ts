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
    BlockStackerInputController,
    type BlockStackerInputActions,
} from './BlockStackerInputController';
import type {
    BlockStackerBlockState,
    BlockStackerFragmentState,
    BlockStackerPlayfieldLayout,
    BlockStackerViewState,
} from './BlockStackerTypes';

export type BlockStackerViewActions = BlockStackerInputActions;

const BLOCK_COLORS: readonly Color[] = [
    new Color(112, 139, 126, 255),
    new Color(118, 158, 196, 255),
    new Color(144, 126, 190, 255),
    new Color(181, 149, 95, 255),
    new Color(95, 164, 164, 255),
];

export class BlockStackerView {
    private readonly inputController: BlockStackerInputController;
    private playfieldNode: Node | null = null;
    private graphics: Graphics | null = null;
    private statusLabel: Label | null = null;
    private scoreLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private resultLabel: Label | null = null;
    private playfieldLayout: BlockStackerPlayfieldLayout | null = null;
    private compactLayout = false;

    constructor(
        private readonly root: Node,
        private readonly actions: BlockStackerViewActions,
    ) {
        this.inputController = new BlockStackerInputController(root, actions);
    }

    layout(viewport: ViewportSnapshot): void {
        clearNode(this.root);
        this.root.setPosition(0, 0, 0);
        fillNode(this.root, viewport.width, viewport.height, palette.background);
        this.playfieldNode = null;
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
        const safeHeight = Math.max(
            2,
            viewport.height - viewport.safeInsets.top - viewport.safeInsets.bottom,
        );
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const safeCenterY = (viewport.safeInsets.bottom - viewport.safeInsets.top) / 2;
        const headerHeight = compact ? 88 : 100;
        const footerHeight = compact ? 36 : 44;
        const horizontalPadding = compact ? 16 : 30;
        const playWidth = Math.max(120, safeWidth - horizontalPadding);
        const playHeight = Math.max(160, safeHeight - headerHeight - footerHeight);
        const playCenterY = safeCenterY + (footerHeight - headerHeight) / 2;
        const playLeft = centerX - playWidth / 2;
        const playBottom = playCenterY - playHeight / 2;
        const playTop = playBottom + playHeight;
        this.playfieldLayout = {
            left: playLeft,
            bottom: playBottom,
            width: playWidth,
            height: playHeight,
        };
        this.inputController.setPlayfield(this.playfieldLayout);

        const statusNode = createLabel(
            this.root,
            '',
            playWidth * 0.48,
            compact ? 22 : 26,
            compact ? 13 : 15,
            palette.text,
            playLeft + playWidth * 0.24,
            playTop + (compact ? 61 : 70),
            HorizontalTextAlignment.LEFT,
        );
        this.statusLabel = statusNode.getComponent(Label);
        if (this.statusLabel) {
            this.statusLabel.enableWrapText = false;
        }

        createButton(this.root, {
            name: 'BlockStackerNewButton',
            text: 'NEW',
            width: compact ? 70 : 82,
            height: compact ? 34 : 38,
            x: playLeft + playWidth - (compact ? 38 : 45),
            y: playTop + (compact ? 61 : 70),
            fontSize: compact ? 12 : 13,
            variant: 'secondary',
            onPress: () => this.actions.restart(),
        });

        const scoreNode = createLabel(
            this.root,
            '',
            playWidth,
            compact ? 20 : 24,
            compact ? 10 : 12,
            palette.muted,
            centerX,
            playTop + (compact ? 26 : 31),
        );
        this.scoreLabel = scoreNode.getComponent(Label);
        if (this.scoreLabel) {
            this.scoreLabel.enableWrapText = false;
        }

        const hintNode = createLabel(
            this.root,
            '',
            Math.min(playWidth, 620),
            compact ? 18 : 22,
            compact ? 10 : 11,
            palette.muted,
            centerX,
            playBottom - (compact ? 21 : 26),
        );
        this.hintLabel = hintNode.getComponent(Label);
        if (this.hintLabel) {
            this.hintLabel.enableWrapText = false;
        }

        const playfield = createUiNode(
            this.root,
            'BlockStackerPlayfield',
            playWidth,
            playHeight,
            centerX,
            playCenterY,
        );
        this.playfieldNode = playfield;
        this.graphics = playfield.addComponent(Graphics);

        const resultNode = createLabel(
            playfield,
            '',
            Math.min(playWidth - 24, 360),
            60,
            compact ? 18 : 22,
            palette.primaryText,
            0,
            0,
        );
        this.resultLabel = resultNode.getComponent(Label);
        if (this.resultLabel) {
            this.resultLabel.enableWrapText = false;
        }
    }

    render(state: BlockStackerViewState): void {
        if (!this.graphics || !this.playfieldLayout) {
            return;
        }
        this.drawPlayfield(state);
        if (this.statusLabel) {
            this.statusLabel.string = state.status;
            this.statusLabel.color = state.phase === 'lost' ? palette.danger : palette.text;
        }
        if (this.scoreLabel) {
            this.scoreLabel.string = state.scoreText;
        }
        if (this.hintLabel) {
            this.hintLabel.string = this.compactLayout
                ? state.phase === 'lost'
                    ? 'TAP OR SPACE TO RESTART'
                    : state.controller === 'autopilot'
                        ? 'AI ACTIVE — TAP TO TAKE OVER'
                        : 'TAP OR SPACE TO DROP'
                : state.hint;
        }
        if (this.resultLabel) {
            this.resultLabel.string = state.phase === 'lost' ? 'TOWER LOST' : '';
        }
    }

    destroy(): void {
        this.inputController.destroy();
        this.playfieldNode = null;
        this.graphics = null;
        this.statusLabel = null;
        this.scoreLabel = null;
        this.hintLabel = null;
        this.resultLabel = null;
        this.playfieldLayout = null;
        clearNode(this.root);
    }

    private drawPlayfield(state: BlockStackerViewState): void {
        const graphics = this.graphics;
        const layout = this.playfieldLayout;
        if (!graphics || !layout) {
            return;
        }
        const width = layout.width;
        const height = layout.height;
        const worldWidth = state.worldHalfWidth * 2;
        const scale = Math.min(1.65, (width - 22) / worldWidth);
        const originY = -height / 2 + 30;
        graphics.clear();
        graphics.fillColor = palette.backgroundRaised;
        graphics.fillRect(-width / 2, -height / 2, width, height);
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 2;
        graphics.rect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2);
        graphics.stroke();

        const leftRail = -state.worldHalfWidth * scale;
        const rightRail = state.worldHalfWidth * scale;
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1;
        graphics.moveTo(leftRail, -height / 2 + 10);
        graphics.lineTo(leftRail, height / 2 - 10);
        graphics.moveTo(rightRail, -height / 2 + 10);
        graphics.lineTo(rightRail, height / 2 - 10);
        graphics.stroke();

        for (const block of state.blocks) {
            const y = originY + (block.y - state.cameraY) * scale;
            if (y < -height / 2 - state.blockHeight * scale || y > height / 2 + 20) {
                continue;
            }
            this.drawBlock(graphics, block, y, scale);
        }

        const moving = state.movingBlock;
        if (moving) {
            const y = originY + (moving.y - state.cameraY) * scale;
            this.drawMovingBlock(
                graphics,
                moving.x * scale,
                y,
                moving.width * scale,
                moving.height * scale,
            );
        }

        for (const fragment of state.fragments) {
            const y = originY + (fragment.y - state.cameraY) * scale;
            if (y < -height / 2 - 60 || y > height / 2 + 60) {
                continue;
            }
            this.drawFragment(graphics, fragment, y, scale);
        }
    }

    private drawBlock(
        graphics: Graphics,
        block: BlockStackerBlockState,
        y: number,
        scale: number,
    ): void {
        const width = Math.max(1, block.width * scale);
        const height = Math.max(2, block.height * scale);
        const x = block.x * scale - width / 2;
        graphics.fillColor = block.perfect
            ? palette.accent
            : BLOCK_COLORS[block.level % BLOCK_COLORS.length];
        graphics.fillRect(x, y - height / 2, width, height);
        graphics.strokeColor = block.perfect ? palette.primaryText : palette.borderStrong;
        graphics.lineWidth = Math.max(1, scale);
        graphics.rect(x, y - height / 2, width, height);
        graphics.stroke();
    }

    private drawMovingBlock(
        graphics: Graphics,
        centerX: number,
        centerY: number,
        width: number,
        height: number,
    ): void {
        graphics.fillColor = palette.warning;
        graphics.fillRect(centerX - width / 2, centerY - height / 2, width, height);
        graphics.strokeColor = palette.primaryText;
        graphics.lineWidth = 2;
        graphics.rect(centerX - width / 2, centerY - height / 2, width, height);
        graphics.stroke();
    }

    private drawFragment(
        graphics: Graphics,
        fragment: BlockStackerFragmentState,
        centerY: number,
        scale: number,
    ): void {
        const centerX = fragment.x * scale;
        const halfWidth = fragment.width * scale / 2;
        const halfHeight = fragment.height * scale / 2;
        const cosine = Math.cos(fragment.rotation);
        const sine = Math.sin(fragment.rotation);
        const corners = [
            [-halfWidth, -halfHeight],
            [halfWidth, -halfHeight],
            [halfWidth, halfHeight],
            [-halfWidth, halfHeight],
        ] as const;
        graphics.fillColor = palette.danger;
        for (let index = 0; index < corners.length; index += 1) {
            const [localX, localY] = corners[index];
            const x = centerX + localX * cosine - localY * sine;
            const y = centerY + localX * sine + localY * cosine;
            if (index === 0) {
                graphics.moveTo(x, y);
            } else {
                graphics.lineTo(x, y);
            }
        }
        graphics.close();
        graphics.fill();
    }
}
