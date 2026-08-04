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
import { TetrisInputController } from './TetrisInputController';
import { tetrisPieceCells } from './TetrisPieces';
import {
    TETRIS_BOARD_WIDTH,
    TETRIS_VISIBLE_HEIGHT,
    type TetrisPieceType,
    type TetrisViewActions,
    type TetrisViewState,
} from './TetrisTypes';

const PIECE_COLORS: Readonly<Record<TetrisPieceType, Color>> = {
    I: new Color(82, 168, 181, 255),
    O: new Color(190, 158, 78, 255),
    T: new Color(145, 116, 184, 255),
    J: new Color(91, 124, 184, 255),
    L: new Color(190, 126, 75, 255),
    S: new Color(104, 165, 112, 255),
    Z: new Color(188, 92, 92, 255),
};

interface MiniPanel {
    readonly centerX: number;
    readonly centerY: number;
    readonly width: number;
    readonly height: number;
}

export class TetrisView {
    private readonly inputController: TetrisInputController;
    private boardGraphics: Graphics | null = null;
    private miniGraphics: Graphics | null = null;
    private statusLabel: Label | null = null;
    private scoreLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private resultLabel: Label | null = null;
    private boardWidth = 0;
    private boardHeight = 0;
    private cellSize = 0;
    private compactLayout = false;
    private holdPanel: MiniPanel | null = null;
    private nextPanels: MiniPanel[] = [];

    constructor(
        private readonly root: Node,
        private readonly actions: TetrisViewActions,
    ) {
        this.inputController = new TetrisInputController(actions);
    }

    layout(viewport: ViewportSnapshot): void {
        clearNode(this.root);
        this.root.setPosition(0, 0, 0);
        fillNode(this.root, viewport.width, viewport.height, palette.background);
        this.boardGraphics = null;
        this.miniGraphics = null;
        this.statusLabel = null;
        this.scoreLabel = null;
        this.hintLabel = null;
        this.resultLabel = null;
        this.holdPanel = null;
        this.nextPanels = [];

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
        const contentBottom = safeBottom + (compact ? 10 : 16);
        const hudHeight = compact ? 58 : 62;
        const controlsHeight = compact ? 94 : 54;
        const sideReserve = compact ? 100 : 190;
        const boardAvailableHeight = Math.max(
            200,
            contentTop - contentBottom - hudHeight - controlsHeight,
        );
        const cellSize = Math.max(
            8,
            Math.floor(Math.min(
                (safeWidth - sideReserve) / TETRIS_BOARD_WIDTH,
                boardAvailableHeight / TETRIS_VISIBLE_HEIGHT,
                compact ? 27 : 30,
            )),
        );
        const boardWidth = cellSize * TETRIS_BOARD_WIDTH;
        const boardHeight = cellSize * TETRIS_VISIBLE_HEIGHT;
        const boardTop = contentTop - hudHeight;
        const boardBottom = boardTop - boardHeight;
        const boardCenterY = (boardTop + boardBottom) / 2;
        const boardCenterX = compact
            ? centerX - Math.min(26, safeWidth * 0.055)
            : centerX - Math.min(54, safeWidth * 0.07);
        this.boardWidth = boardWidth;
        this.boardHeight = boardHeight;
        this.cellSize = cellSize;

        const statusNode = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 24, 520),
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

        const scoreNode = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 24, 620),
            compact ? 18 : 22,
            compact ? 9 : 11,
            palette.muted,
            centerX,
            contentTop - (compact ? 33 : 38),
            HorizontalTextAlignment.CENTER,
        );
        this.scoreLabel = scoreNode.getComponent(Label);
        if (this.scoreLabel) {
            this.scoreLabel.enableWrapText = false;
        }

        const boardNode = createUiNode(
            this.root,
            'TetrisBoard',
            boardWidth,
            boardHeight,
            boardCenterX,
            boardCenterY,
        );
        this.boardGraphics = boardNode.addComponent(Graphics);

        const miniNode = createUiNode(
            this.root,
            'TetrisMiniPanels',
            viewport.width,
            viewport.height,
            0,
            0,
        );
        this.miniGraphics = miniNode.addComponent(Graphics);
        this.layoutMiniPanels(
            boardCenterX,
            boardTop,
            boardBottom,
            boardWidth,
            cellSize,
            compact,
        );
        if (this.holdPanel) {
            createLabel(
                this.root,
                'HOLD',
                this.holdPanel.width,
                14,
                compact ? 7 : 9,
                palette.muted,
                this.holdPanel.centerX,
                this.holdPanel.centerY + this.holdPanel.height / 2 - 8,
            );
        }
        if (this.nextPanels[0]) {
            createLabel(
                this.root,
                'NEXT',
                this.nextPanels[0].width,
                14,
                compact ? 7 : 9,
                palette.muted,
                this.nextPanels[0].centerX,
                this.nextPanels[0].centerY + this.nextPanels[0].height / 2 - 8,
            );
        }

        const controlsTop = Math.min(boardBottom - 8, contentBottom + controlsHeight);
        this.createControls(
            centerX,
            contentBottom,
            controlsTop,
            safeWidth,
            compact,
        );

        const hintNode = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 24, 700),
            compact ? 17 : 20,
            compact ? 8 : 10,
            palette.muted,
            centerX,
            contentBottom + (compact ? 7 : 9),
        );
        this.hintLabel = hintNode.getComponent(Label);
        if (this.hintLabel) {
            this.hintLabel.enableWrapText = false;
        }

        const resultNode = createLabel(
            boardNode,
            '',
            Math.max(1, boardWidth - 20),
            64,
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

    render(state: TetrisViewState): void {
        this.drawBoard(state);
        this.drawMiniPanels(state);
        if (this.statusLabel) {
            this.statusLabel.string = state.status;
            this.statusLabel.color = state.phase === 'lost'
                ? palette.danger
                : palette.text;
        }
        if (this.scoreLabel) {
            this.scoreLabel.string = state.scoreText;
        }
        if (this.hintLabel) {
            this.hintLabel.string = this.compactLayout
                ? state.phase === 'lost'
                    ? 'NEW, DROP OR R TO RESTART'
                    : state.controller === 'autopilot'
                        ? 'AI ACTIVE — USE A CONTROL TO TAKE OVER'
                        : 'MOVE  ROTATE  DROP  HOLD'
                : state.hint;
        }
        if (this.resultLabel) {
            this.resultLabel.string = state.phase === 'lost' ? 'GAME OVER' : '';
        }
    }

    destroy(): void {
        this.inputController.destroy();
        this.boardGraphics = null;
        this.miniGraphics = null;
        this.statusLabel = null;
        this.scoreLabel = null;
        this.hintLabel = null;
        this.resultLabel = null;
        this.holdPanel = null;
        this.nextPanels = [];
        clearNode(this.root);
    }

    private createControls(
        centerX: number,
        contentBottom: number,
        controlsTop: number,
        safeWidth: number,
        compact: boolean,
    ): void {
        const buttonHeight = compact ? 32 : 36;
        if (compact) {
            const width = Math.max(44, Math.min(60, (safeWidth - 40) / 4));
            const gap = width + 6;
            const firstY = controlsTop - buttonHeight / 2;
            const secondY = firstY - buttonHeight - 7;
            this.addControl('TetrisLeft', '<', width, buttonHeight, centerX - gap * 1.5, firstY, () => {
                this.actions.moveOnce(-1);
            });
            this.addControl('TetrisRight', '>', width, buttonHeight, centerX - gap * 0.5, firstY, () => {
                this.actions.moveOnce(1);
            });
            this.addControl('TetrisRotate', 'ROT', width, buttonHeight, centerX + gap * 0.5, firstY, () => {
                this.actions.rotateClockwise();
            });
            this.addControl('TetrisDown', 'DOWN', width, buttonHeight, centerX + gap * 1.5, firstY, () => {
                this.actions.softDropOnce();
            });
            this.addControl('TetrisHold', 'HOLD', width, buttonHeight, centerX - gap, secondY, () => {
                this.actions.hold();
            });
            this.addControl('TetrisDrop', 'DROP', width, buttonHeight, centerX, secondY, () => {
                this.actions.hardDrop();
            });
            this.addControl('TetrisNew', 'NEW', width, buttonHeight, centerX + gap, secondY, () => {
                this.actions.restart();
            });
            return;
        }

        const labels = ['<', '>', 'ROT', 'DOWN', 'HOLD', 'DROP', 'NEW'] as const;
        const callbacks = [
            () => this.actions.moveOnce(-1),
            () => this.actions.moveOnce(1),
            () => this.actions.rotateClockwise(),
            () => this.actions.softDropOnce(),
            () => this.actions.hold(),
            () => this.actions.hardDrop(),
            () => this.actions.restart(),
        ] as const;
        const width = Math.max(44, Math.min(72, (safeWidth - 64) / labels.length));
        const gap = width + 8;
        const y = controlsTop - buttonHeight / 2;
        for (let index = 0; index < labels.length; index += 1) {
            this.addControl(
                `TetrisControl:${labels[index]}`,
                labels[index],
                width,
                buttonHeight,
                centerX + (index - (labels.length - 1) / 2) * gap,
                y,
                callbacks[index],
            );
        }
    }

    private addControl(
        name: string,
        text: string,
        width: number,
        height: number,
        x: number,
        y: number,
        onPress: () => void,
    ): void {
        createButton(this.root, {
            name,
            text,
            width,
            height,
            x,
            y,
            fontSize: 11,
            variant: 'secondary',
            onPress,
        });
    }

    private layoutMiniPanels(
        boardCenterX: number,
        boardTop: number,
        boardBottom: number,
        boardWidth: number,
        cellSize: number,
        compact: boolean,
    ): void {
        if (compact) {
            const panelWidth = Math.max(44, cellSize * 2.35);
            const panelHeight = Math.max(48, cellSize * 2.7);
            const sideX = boardCenterX + boardWidth / 2 + panelWidth / 2 + 6;
            this.holdPanel = {
                centerX: sideX,
                centerY: boardTop - panelHeight / 2,
                width: panelWidth,
                height: panelHeight,
            };
            this.nextPanels = [{
                centerX: sideX,
                centerY: boardTop - panelHeight * 1.62,
                width: panelWidth,
                height: panelHeight,
            }];
            return;
        }

        const panelWidth = Math.max(78, cellSize * 4.4);
        const panelHeight = Math.max(68, cellSize * 3.5);
        const sideX = boardCenterX + boardWidth / 2 + panelWidth / 2 + 20;
        this.holdPanel = {
            centerX: sideX,
            centerY: boardTop - panelHeight / 2,
            width: panelWidth,
            height: panelHeight,
        };
        this.nextPanels = [0, 1, 2].map((index) => ({
            centerX: sideX,
            centerY: boardTop - panelHeight * (1.7 + index * 1.08),
            width: panelWidth,
            height: panelHeight,
        }));

        if (this.nextPanels[this.nextPanels.length - 1].centerY - panelHeight / 2 < boardBottom) {
            this.nextPanels = this.nextPanels.slice(0, 2);
        }
    }

    private drawBoard(state: TetrisViewState): void {
        const graphics = this.boardGraphics;
        if (!graphics) {
            return;
        }
        const width = this.boardWidth;
        const height = this.boardHeight;
        const size = this.cellSize;
        graphics.clear();
        graphics.fillColor = palette.backgroundRaised;
        graphics.fillRect(-width / 2, -height / 2, width, height);
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 2;
        graphics.rect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2);
        graphics.stroke();

        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1;
        for (let x = 1; x < TETRIS_BOARD_WIDTH; x += 1) {
            const lineX = -width / 2 + x * size;
            graphics.moveTo(lineX, -height / 2);
            graphics.lineTo(lineX, height / 2);
        }
        for (let y = 1; y < TETRIS_VISIBLE_HEIGHT; y += 1) {
            const lineY = -height / 2 + y * size;
            graphics.moveTo(-width / 2, lineY);
            graphics.lineTo(width / 2, lineY);
        }
        graphics.stroke();

        for (let y = 0; y < state.board.length; y += 1) {
            for (let x = 0; x < state.board[y].length; x += 1) {
                const type = state.board[y][x];
                if (type) {
                    this.drawCell(graphics, x, y, type, 255, false);
                }
            }
        }
        for (const cell of state.ghostCells) {
            this.drawCell(graphics, cell.x, cell.y, cell.type, 72, true);
        }
        for (const cell of state.activeCells) {
            this.drawCell(graphics, cell.x, cell.y, cell.type, 255, false);
        }
    }

    private drawCell(
        graphics: Graphics,
        x: number,
        y: number,
        type: TetrisPieceType,
        alpha: number,
        outlineOnly: boolean,
    ): void {
        const size = this.cellSize;
        const left = -this.boardWidth / 2 + x * size + 1.5;
        const bottom = -this.boardHeight / 2 + y * size + 1.5;
        const extent = Math.max(1, size - 3);
        const base = PIECE_COLORS[type];
        const color = new Color(base.r, base.g, base.b, alpha);
        if (!outlineOnly) {
            graphics.fillColor = color;
            graphics.fillRect(left, bottom, extent, extent);
        }
        graphics.strokeColor = color;
        graphics.lineWidth = outlineOnly ? 1.5 : 1;
        graphics.rect(left, bottom, extent, extent);
        graphics.stroke();
        if (!outlineOnly && size >= 14) {
            graphics.strokeColor = new Color(255, 255, 255, 48);
            graphics.moveTo(left + 2, bottom + extent - 2);
            graphics.lineTo(left + extent - 2, bottom + extent - 2);
            graphics.lineTo(left + extent - 2, bottom + extent - 5);
            graphics.stroke();
        }
    }

    private drawMiniPanels(state: TetrisViewState): void {
        const graphics = this.miniGraphics;
        if (!graphics) {
            return;
        }
        graphics.clear();
        if (this.holdPanel) {
            this.drawPanel(graphics, this.holdPanel, 'HOLD', state.hold);
        }
        for (let index = 0; index < this.nextPanels.length; index += 1) {
            this.drawPanel(
                graphics,
                this.nextPanels[index],
                index === 0 ? 'NEXT' : '',
                state.next[index] ?? null,
            );
        }
    }

    private drawPanel(
        graphics: Graphics,
        panel: MiniPanel,
        label: string,
        type: TetrisPieceType | null,
    ): void {
        const { centerX, centerY, width, height } = panel;
        graphics.fillColor = palette.surface;
        graphics.fillRect(
            centerX - width / 2,
            centerY - height / 2,
            width,
            height,
        );
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 1;
        graphics.rect(
            centerX - width / 2,
            centerY - height / 2,
            width,
            height,
        );
        graphics.stroke();

        if (label) {
            graphics.strokeColor = palette.muted;
            graphics.lineWidth = 1;
            graphics.moveTo(centerX - width * 0.34, centerY + height * 0.29);
            graphics.lineTo(centerX + width * 0.34, centerY + height * 0.29);
            graphics.stroke();
        }
        if (!type) {
            return;
        }
        const cells = tetrisPieceCells(type, 0);
        const minimumX = Math.min(...cells.map((cell) => cell.x));
        const maximumX = Math.max(...cells.map((cell) => cell.x));
        const minimumY = Math.min(...cells.map((cell) => cell.y));
        const maximumY = Math.max(...cells.map((cell) => cell.y));
        const miniSize = Math.max(
            4,
            Math.min(
                width / (maximumX - minimumX + 2.4),
                height / (maximumY - minimumY + 2.8),
            ),
        );
        const pieceWidth = (maximumX - minimumX + 1) * miniSize;
        const pieceHeight = (maximumY - minimumY + 1) * miniSize;
        const baseX = centerX - pieceWidth / 2 - minimumX * miniSize;
        const baseY = centerY - pieceHeight / 2 - minimumY * miniSize - height * 0.04;
        const color = PIECE_COLORS[type];
        for (const cell of cells) {
            const x = baseX + cell.x * miniSize;
            const y = baseY + cell.y * miniSize;
            graphics.fillColor = color;
            graphics.fillRect(x + 1, y + 1, miniSize - 2, miniSize - 2);
        }
    }
}
