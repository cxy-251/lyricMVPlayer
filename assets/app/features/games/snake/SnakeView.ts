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
import { SnakeInputController } from './SnakeInputController';
import type { SnakeViewActions, SnakeViewState } from './SnakeTypes';

const BODY = new Color(106, 163, 130, 255);
const HEAD = new Color(139, 196, 158, 255);
const FOOD = new Color(197, 103, 96, 255);
const GRID = new Color(72, 84, 78, 145);

export class SnakeView {
    private readonly input: SnakeInputController;
    private graphics: Graphics | null = null;
    private statusLabel: Label | null = null;
    private scoreLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private boardWidth = 0;
    private boardHeight = 0;
    private cellSize = 0;

    constructor(
        private readonly root: Node,
        private readonly actions: SnakeViewActions,
    ) {
        this.input = new SnakeInputController(root, actions);
    }

    layout(viewport: ViewportSnapshot): void {
        clearNode(this.root);
        fillNode(this.root, viewport.width, viewport.height, palette.background);
        this.graphics = null;
        this.statusLabel = null;
        this.scoreLabel = null;
        this.hintLabel = null;

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = Math.max(
            2,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const safeTop = viewport.height / 2 - viewport.safeInsets.top;
        const safeBottom = -viewport.height / 2 + viewport.safeInsets.bottom;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const contentTop = safeTop - (compact ? 64 : 72);
        const hudHeight = compact ? 62 : 72;
        const controlsHeight = compact ? 116 : 130;
        const footerHeight = compact ? 40 : 46;
        const horizontalPadding = compact ? 16 : 34;
        const availableWidth = Math.max(1, safeWidth - horizontalPadding);
        const availableHeight = Math.max(
            1,
            contentTop - safeBottom - hudHeight - controlsHeight - footerHeight,
        );
        const cellSize = Math.max(1, Math.floor(Math.min(
            availableWidth / 20,
            availableHeight / 14,
        )));
        this.cellSize = cellSize;
        this.boardWidth = cellSize * 20;
        this.boardHeight = cellSize * 14;
        const boardTop = contentTop - hudHeight;
        const boardBottom = boardTop - this.boardHeight;
        const boardCenterY = (boardTop + boardBottom) / 2;

        const statusNode = createLabel(
            this.root,
            '',
            this.boardWidth,
            compact ? 22 : 26,
            compact ? 12 : 14,
            palette.text,
            centerX,
            contentTop - (compact ? 12 : 14),
            HorizontalTextAlignment.CENTER,
        );
        this.statusLabel = statusNode.getComponent(Label);

        const scoreNode = createLabel(
            this.root,
            '',
            this.boardWidth,
            compact ? 18 : 22,
            compact ? 10 : 11,
            palette.muted,
            centerX,
            contentTop - (compact ? 36 : 42),
        );
        this.scoreLabel = scoreNode.getComponent(Label);

        const board = createUiNode(
            this.root,
            'SnakeBoard',
            this.boardWidth,
            this.boardHeight,
            centerX,
            boardCenterY,
        );
        this.graphics = board.addComponent(Graphics);

        const controlsY = boardBottom - (compact ? 68 : 74);
        const size = Math.max(
            32,
            Math.min(compact ? 38 : 44, (safeWidth - 24) / 3),
        );
        const gap = compact ? 46 : 50;
        createButton(this.root, {
            name: 'SnakeUp', text: '↑', width: size, height: size,
            x: centerX, y: controlsY + gap, fontSize: compact ? 16 : 18,
            variant: 'secondary', onPress: () => this.actions.direction('up'),
        });
        createButton(this.root, {
            name: 'SnakeLeft', text: '←', width: size, height: size,
            x: centerX - gap, y: controlsY, fontSize: compact ? 16 : 18,
            variant: 'secondary', onPress: () => this.actions.direction('left'),
        });
        createButton(this.root, {
            name: 'SnakeDown', text: '↓', width: size, height: size,
            x: centerX, y: controlsY, fontSize: compact ? 16 : 18,
            variant: 'secondary', onPress: () => this.actions.direction('down'),
        });
        createButton(this.root, {
            name: 'SnakeRight', text: '→', width: size, height: size,
            x: centerX + gap, y: controlsY, fontSize: compact ? 16 : 18,
            variant: 'secondary', onPress: () => this.actions.direction('right'),
        });
        createButton(this.root, {
            name: 'SnakeRestart', text: 'NEW',
            width: Math.max(size, Math.min(compact ? 66 : 76, safeWidth - 24)),
            height: size,
            x: centerX,
            y: controlsY - gap,
            fontSize: compact ? 10 : 11,
            variant: 'secondary',
            onPress: () => this.actions.restart(),
        });

        const hintNode = createLabel(
            this.root,
            '',
            Math.max(1, Math.min(safeWidth - 20, 620)),
            compact ? 18 : 22,
            compact ? 9 : 10,
            palette.muted,
            centerX,
            safeBottom + (compact ? 13 : 16),
        );
        this.hintLabel = hintNode.getComponent(Label);
    }

    render(state: SnakeViewState): void {
        const graphics = this.graphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        graphics.fillColor = palette.backgroundRaised;
        graphics.fillRect(
            -this.boardWidth / 2,
            -this.boardHeight / 2,
            this.boardWidth,
            this.boardHeight,
        );
        graphics.strokeColor = GRID;
        graphics.lineWidth = 1;
        for (let x = 0; x <= state.width; x += 1) {
            const px = -this.boardWidth / 2 + x * this.cellSize;
            graphics.moveTo(px, -this.boardHeight / 2);
            graphics.lineTo(px, this.boardHeight / 2);
        }
        for (let y = 0; y <= state.height; y += 1) {
            const py = -this.boardHeight / 2 + y * this.cellSize;
            graphics.moveTo(-this.boardWidth / 2, py);
            graphics.lineTo(this.boardWidth / 2, py);
        }
        graphics.stroke();

        if (state.phase !== 'won') {
            this.drawCell(graphics, state.food.x, state.food.y, FOOD, 0.24);
        }
        for (let index = state.snake.length - 1; index >= 0; index -= 1) {
            const point = state.snake[index];
            this.drawCell(graphics, point.x, point.y, index === 0 ? HEAD : BODY, 0.1);
        }
        const head = state.snake[0];
        if (head) {
            const center = this.cellCenter(head.x, head.y);
            graphics.fillColor = palette.primaryText;
            graphics.circle(
                center.x + this.cellSize * 0.18,
                center.y + this.cellSize * 0.15,
                Math.max(1.2, this.cellSize * 0.055),
            );
            graphics.fill();
        }

        if (this.statusLabel) {
            this.statusLabel.string = state.status;
            this.statusLabel.color = state.phase === 'won'
                ? palette.accent
                : state.phase === 'lost'
                    ? palette.danger
                    : palette.text;
        }
        if (this.scoreLabel) {
            this.scoreLabel.string = `SCORE ${state.score}  BEST ${state.bestScore}`
                + `  SPEED ${state.speed.toFixed(1)}`;
        }
        if (this.hintLabel) {
            this.hintLabel.string = state.hint;
        }
    }

    destroy(): void {
        this.input.destroy();
        clearNode(this.root);
    }

    private drawCell(
        graphics: Graphics,
        x: number,
        y: number,
        color: Color,
        insetRatio: number,
    ): void {
        const inset = this.cellSize * insetRatio;
        const left = -this.boardWidth / 2 + x * this.cellSize + inset;
        const bottom = -this.boardHeight / 2 + y * this.cellSize + inset;
        graphics.fillColor = color;
        graphics.fillRect(
            left,
            bottom,
            this.cellSize - inset * 2,
            this.cellSize - inset * 2,
        );
    }

    private cellCenter(x: number, y: number): { x: number; y: number } {
        return {
            x: -this.boardWidth / 2 + (x + 0.5) * this.cellSize,
            y: -this.boardHeight / 2 + (y + 0.5) * this.cellSize,
        };
    }
}
