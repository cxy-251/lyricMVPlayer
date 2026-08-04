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

interface Point {
    readonly x: number;
    readonly y: number;
}

const BLOCK_COLORS: readonly Color[] = [
    new Color(112, 139, 126, 255),
    new Color(118, 158, 196, 255),
    new Color(144, 126, 190, 255),
    new Color(181, 149, 95, 255),
    new Color(95, 164, 164, 255),
];

export class BlockStackerView {
    private readonly inputController: BlockStackerInputController;
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
        const hudHeight = compact ? 96 : 108;
        const footerHeight = compact ? 26 : 32;
        const horizontalPadding = compact ? 16 : 30;
        const playHeight = Math.max(
            170,
            contentTop - contentBottom - hudHeight - footerHeight,
        );
        const scale = Math.max(
            0.42,
            Math.min(
                (safeWidth - horizontalPadding - 4) / 320,
                (playHeight - 20) / 176,
            ),
        );
        const playWidth = Math.min(
            safeWidth - horizontalPadding,
            320 * scale + 4,
        );
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

        createButton(this.root, {
            name: 'BlockStackerNewButton',
            text: 'NEW',
            width: compact ? 70 : 82,
            height: compact ? 32 : 36,
            x: centerX,
            y: contentTop - (compact ? 70 : 79),
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
            Math.min(playWidth, 620),
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
            'BlockStackerPlayfield',
            playWidth,
            playHeight,
            centerX,
            playCenterY,
        );
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
        const scale = (width - 4) / worldWidth;
        const originY = -height / 2 + 12 + state.blockHeight * scale / 2;
        graphics.clear();
        graphics.fillColor = palette.backgroundRaised;
        graphics.fillRect(-width / 2, -height / 2, width, height);
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 2;
        graphics.rect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2);
        graphics.stroke();

        const leftRail = -state.worldHalfWidth * scale;
        const rightRail = state.worldHalfWidth * scale;
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 1;
        graphics.moveTo(leftRail, -height / 2 + 2);
        graphics.lineTo(leftRail, height / 2 - 2);
        graphics.moveTo(rightRail, -height / 2 + 2);
        graphics.lineTo(rightRail, height / 2 - 2);
        graphics.stroke();

        for (const block of state.blocks) {
            const y = originY + (block.y - state.cameraY) * scale;
            this.drawBlock(graphics, block, y, scale, width, height);
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
                width,
                height,
            );
        }

        for (const fragment of state.fragments) {
            const y = originY + (fragment.y - state.cameraY) * scale;
            this.drawFragment(graphics, fragment, y, scale, width, height);
        }
    }

    private drawBlock(
        graphics: Graphics,
        block: BlockStackerBlockState,
        centerY: number,
        scale: number,
        playWidth: number,
        playHeight: number,
    ): void {
        const width = Math.max(1, block.width * scale);
        const height = Math.max(2, block.height * scale);
        this.drawClippedRect(
            graphics,
            block.x * scale - width / 2,
            centerY - height / 2,
            width,
            height,
            playWidth,
            playHeight,
            block.perfect
                ? palette.accent
                : BLOCK_COLORS[block.level % BLOCK_COLORS.length],
            block.perfect ? palette.primaryText : palette.borderStrong,
            Math.max(1, scale),
        );
    }

    private drawMovingBlock(
        graphics: Graphics,
        centerX: number,
        centerY: number,
        width: number,
        height: number,
        playWidth: number,
        playHeight: number,
    ): void {
        this.drawClippedRect(
            graphics,
            centerX - width / 2,
            centerY - height / 2,
            width,
            height,
            playWidth,
            playHeight,
            palette.warning,
            palette.primaryText,
            2,
        );
    }

    private drawClippedRect(
        graphics: Graphics,
        x: number,
        y: number,
        width: number,
        height: number,
        playWidth: number,
        playHeight: number,
        fill: Color,
        stroke: Color,
        lineWidth: number,
    ): void {
        const left = Math.max(x, -playWidth / 2 + 2);
        const right = Math.min(x + width, playWidth / 2 - 2);
        const bottom = Math.max(y, -playHeight / 2 + 2);
        const top = Math.min(y + height, playHeight / 2 - 2);
        if (right <= left || top <= bottom) {
            return;
        }
        graphics.fillColor = fill;
        graphics.fillRect(left, bottom, right - left, top - bottom);
        graphics.strokeColor = stroke;
        graphics.lineWidth = lineWidth;
        graphics.rect(left, bottom, right - left, top - bottom);
        graphics.stroke();
    }

    private drawFragment(
        graphics: Graphics,
        fragment: BlockStackerFragmentState,
        centerY: number,
        scale: number,
        playWidth: number,
        playHeight: number,
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
        const polygon = corners.map(([localX, localY]) => ({
            x: centerX + localX * cosine - localY * sine,
            y: centerY + localX * sine + localY * cosine,
        }));
        const clipped = this.clipPolygon(
            polygon,
            playWidth / 2 - 2,
            playHeight / 2 - 2,
        );
        if (clipped.length < 3) {
            return;
        }
        graphics.fillColor = palette.danger;
        for (let index = 0; index < clipped.length; index += 1) {
            const point = clipped[index];
            if (index === 0) {
                graphics.moveTo(point.x, point.y);
            } else {
                graphics.lineTo(point.x, point.y);
            }
        }
        graphics.close();
        graphics.fill();
    }

    private clipPolygon(
        points: readonly Point[],
        halfWidth: number,
        halfHeight: number,
    ): Point[] {
        let result = [...points];
        result = this.clipEdge(result, 'left', -halfWidth);
        result = this.clipEdge(result, 'right', halfWidth);
        result = this.clipEdge(result, 'bottom', -halfHeight);
        result = this.clipEdge(result, 'top', halfHeight);
        return result;
    }

    private clipEdge(
        points: readonly Point[],
        edge: 'left' | 'right' | 'bottom' | 'top',
        boundary: number,
    ): Point[] {
        if (points.length === 0) {
            return [];
        }
        const output: Point[] = [];
        for (let index = 0; index < points.length; index += 1) {
            const current = points[index];
            const previous = points[(index + points.length - 1) % points.length];
            const currentInside = this.insideEdge(current, edge, boundary);
            const previousInside = this.insideEdge(previous, edge, boundary);
            if (currentInside !== previousInside) {
                output.push(this.intersectEdge(previous, current, edge, boundary));
            }
            if (currentInside) {
                output.push(current);
            }
        }
        return output;
    }

    private insideEdge(
        point: Point,
        edge: 'left' | 'right' | 'bottom' | 'top',
        boundary: number,
    ): boolean {
        if (edge === 'left') {
            return point.x >= boundary;
        }
        if (edge === 'right') {
            return point.x <= boundary;
        }
        if (edge === 'bottom') {
            return point.y >= boundary;
        }
        return point.y <= boundary;
    }

    private intersectEdge(
        start: Point,
        end: Point,
        edge: 'left' | 'right' | 'bottom' | 'top',
        boundary: number,
    ): Point {
        if (edge === 'left' || edge === 'right') {
            const delta = end.x - start.x;
            const time = Math.abs(delta) < 0.000001
                ? 0
                : (boundary - start.x) / delta;
            return {
                x: boundary,
                y: start.y + (end.y - start.y) * time,
            };
        }
        const delta = end.y - start.y;
        const time = Math.abs(delta) < 0.000001
            ? 0
            : (boundary - start.y) / delta;
        return {
            x: start.x + (end.x - start.x) * time,
            y: boundary,
        };
    }
}
