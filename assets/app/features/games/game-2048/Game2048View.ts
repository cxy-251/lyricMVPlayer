import {
    Color,
    Graphics,
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
import { Game2048InputController } from './Game2048InputController';
import type {
    Game2048ViewActions,
    Game2048ViewState,
} from './Game2048Types';

const TILE_COLORS: readonly Color[] = [
    new Color(67, 75, 71, 255),
    new Color(105, 124, 114, 255),
    new Color(114, 139, 126, 255),
    new Color(124, 148, 174, 255),
    new Color(143, 128, 177, 255),
    new Color(177, 147, 94, 255),
    new Color(184, 119, 91, 255),
    new Color(188, 96, 91, 255),
    new Color(166, 91, 122, 255),
    new Color(120, 104, 178, 255),
    new Color(86, 138, 161, 255),
    new Color(80, 156, 135, 255),
];

export class Game2048View {
    private readonly input: Game2048InputController;
    private graphics: Graphics | null = null;
    private tileLabels: Label[] = [];
    private statusLabel: Label | null = null;
    private scoreLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private boardSize = 0;
    private cellSize = 0;

    constructor(
        private readonly root: Node,
        private readonly actions: Game2048ViewActions,
    ) {
        this.input = new Game2048InputController(root, actions);
    }

    layout(viewport: ViewportSnapshot): void {
        clearNode(this.root);
        fillNode(this.root, viewport.width, viewport.height, palette.background);
        this.graphics = null;
        this.tileLabels = [];
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
        const hudHeight = compact ? 66 : 78;
        const controlsHeight = compact ? 116 : 130;
        const footerHeight = compact ? 40 : 46;
        const available = Math.max(1, Math.min(
            safeWidth - (compact ? 22 : 48),
            contentTop - safeBottom - hudHeight - controlsHeight - footerHeight,
            compact ? 450 : 560,
        ));
        this.cellSize = Math.max(1, Math.floor(available / 4));
        this.boardSize = this.cellSize * 4;
        const boardTop = contentTop - hudHeight;
        const boardBottom = boardTop - this.boardSize;
        const boardCenterY = (boardTop + boardBottom) / 2;

        const statusNode = createLabel(
            this.root, '', this.boardSize, compact ? 22 : 26,
            compact ? 12 : 14, palette.text, centerX,
            contentTop - (compact ? 12 : 14),
        );
        this.statusLabel = statusNode.getComponent(Label);
        const scoreNode = createLabel(
            this.root, '', this.boardSize, compact ? 20 : 24,
            compact ? 10 : 11, palette.muted, centerX,
            contentTop - (compact ? 38 : 45),
        );
        this.scoreLabel = scoreNode.getComponent(Label);

        const board = createUiNode(
            this.root,
            'Game2048Board',
            this.boardSize,
            this.boardSize,
            centerX,
            boardCenterY,
        );
        this.graphics = board.addComponent(Graphics);
        const labelFont = Math.max(8, Math.floor(this.cellSize * 0.25));
        for (let row = 0; row < 4; row += 1) {
            for (let column = 0; column < 4; column += 1) {
                const labelNode = createLabel(
                    board,
                    '',
                    this.cellSize,
                    this.cellSize,
                    labelFont,
                    palette.primaryText,
                    -this.boardSize / 2 + (column + 0.5) * this.cellSize,
                    this.boardSize / 2 - (row + 0.5) * this.cellSize,
                );
                const label = labelNode.getComponent(Label);
                if (label) {
                    label.enableWrapText = false;
                    this.tileLabels.push(label);
                }
            }
        }

        const controlsY = boardBottom - (compact ? 68 : 74);
        const size = Math.max(
            32,
            Math.min(compact ? 38 : 44, (safeWidth - 24) / 3),
        );
        const gap = compact ? 46 : 50;
        this.createDirectionButtons(centerX, controlsY, size, gap, compact);
        createButton(this.root, {
            name: 'Game2048Restart', text: 'NEW',
            width: Math.max(size, Math.min(compact ? 66 : 76, safeWidth - 24)),
            height: size,
            x: centerX,
            y: controlsY - gap,
            fontSize: compact ? 10 : 11,
            variant: 'secondary',
            onPress: () => this.actions.restart(),
        });

        const hintNode = createLabel(
            this.root, '', Math.max(1, Math.min(safeWidth - 20, 620)),
            compact ? 18 : 22, compact ? 9 : 10,
            palette.muted, centerX, safeBottom + (compact ? 13 : 16),
        );
        this.hintLabel = hintNode.getComponent(Label);
    }

    render(state: Game2048ViewState): void {
        const graphics = this.graphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        graphics.fillColor = palette.borderStrong;
        graphics.fillRect(
            -this.boardSize / 2,
            -this.boardSize / 2,
            this.boardSize,
            this.boardSize,
        );
        const inset = Math.max(1, this.cellSize * 0.045);
        for (let row = 0; row < 4; row += 1) {
            for (let column = 0; column < 4; column += 1) {
                const value = state.board[row][column];
                const exponent = value > 0 ? Math.log2(value) : 0;
                const colorIndex = Math.max(0, Math.min(TILE_COLORS.length - 1, exponent));
                const x = -this.boardSize / 2 + column * this.cellSize + inset;
                const y = this.boardSize / 2 - (row + 1) * this.cellSize + inset;
                graphics.fillColor = TILE_COLORS[colorIndex];
                graphics.fillRect(
                    x,
                    y,
                    Math.max(0, this.cellSize - inset * 2),
                    Math.max(0, this.cellSize - inset * 2),
                );
                const label = this.tileLabels[row * 4 + column];
                if (label) {
                    label.string = value > 0 ? `${value}` : '';
                    label.fontSize = Math.max(
                        8,
                        Math.floor(this.cellSize * (value >= 1024 ? 0.2 : 0.25)),
                    );
                }
            }
        }
        if (this.statusLabel) {
            this.statusLabel.string = state.status;
            this.statusLabel.color = state.phase === 'lost' ? palette.danger : palette.text;
        }
        if (this.scoreLabel) {
            this.scoreLabel.string = `S ${state.score}  BEST ${state.bestScore}`
                + `  MAX ${state.maximumTile}  C${state.chain}  T${state.targetTile}`;
        }
        if (this.hintLabel) {
            this.hintLabel.string = state.hint;
        }
    }

    destroy(): void {
        this.input.destroy();
        clearNode(this.root);
    }

    private createDirectionButtons(
        centerX: number,
        controlsY: number,
        size: number,
        gap: number,
        compact: boolean,
    ): void {
        const create = (
            name: string,
            text: string,
            x: number,
            y: number,
            direction: Game2048Direction,
        ): void => {
            createButton(this.root, {
                name, text, width: size, height: size, x, y,
                fontSize: compact ? 16 : 18,
                variant: 'secondary',
                onPress: () => this.actions.move(direction),
            });
        };
        create('Game2048Up', '↑', centerX, controlsY + gap, 'up');
        create('Game2048Left', '←', centerX - gap, controlsY, 'left');
        create('Game2048Down', '↓', centerX, controlsY, 'down');
        create('Game2048Right', '→', centerX + gap, controlsY, 'right');
    }
}
