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
    MinesweeperInputController,
    type MinesweeperInputActions,
} from './MinesweeperInputController';
import type {
    MinesweeperBoardLayout,
    MinesweeperCellViewState,
    MinesweeperViewState,
} from './MinesweeperTypes';

export type MinesweeperViewActions = MinesweeperInputActions;

const NUMBER_COLORS: readonly Color[] = [
    palette.text,
    new Color(118, 158, 196, 255),
    new Color(113, 165, 126, 255),
    new Color(190, 112, 104, 255),
    new Color(144, 126, 190, 255),
    new Color(181, 130, 92, 255),
    new Color(95, 164, 164, 255),
    new Color(214, 218, 216, 255),
    new Color(142, 150, 146, 255),
];

export class MinesweeperView {
    private readonly inputController: MinesweeperInputController;
    private boardNode: Node | null = null;
    private boardGraphics: Graphics | null = null;
    private cellLabels: Label[] = [];
    private statusLabel: Label | null = null;
    private modeLabel: Label | null = null;
    private boardLayout: MinesweeperBoardLayout | null = null;
    private cellSize = 0;
    private compactLayout = false;

    constructor(
        private readonly root: Node,
        private readonly rows: number,
        private readonly columns: number,
        private readonly actions: MinesweeperViewActions,
    ) {
        this.inputController = new MinesweeperInputController(root, actions);
    }

    layout(viewport: ViewportSnapshot): void {
        clearNode(this.root);
        this.root.setPosition(0, 0, 0);
        fillNode(this.root, viewport.width, viewport.height, palette.background);
        this.boardNode = null;
        this.boardGraphics = null;
        this.cellLabels = [];
        this.statusLabel = null;
        this.modeLabel = null;

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
        const topBandHeight = compact ? 108 : 122;
        const bottomBandHeight = compact ? 38 : 46;
        const horizontalPadding = compact ? 18 : 34;
        const maximumBoard = compact ? 520 : 640;
        const availableBoard = Math.min(
            safeWidth - horizontalPadding,
            safeHeight - topBandHeight - bottomBandHeight,
            maximumBoard,
        );
        const cellSize = Math.max(
            12,
            Math.floor(Math.max(1, availableBoard) / Math.max(this.rows, this.columns)),
        );
        const boardWidth = cellSize * this.columns;
        const boardHeight = cellSize * this.rows;
        const boardCenterY = safeCenterY + (bottomBandHeight - topBandHeight) / 2;
        const boardLeft = centerX - boardWidth / 2;
        const boardBottom = boardCenterY - boardHeight / 2;
        const boardTop = boardBottom + boardHeight;
        this.cellSize = cellSize;
        this.boardLayout = {
            left: boardLeft,
            bottom: boardBottom,
            width: boardWidth,
            height: boardHeight,
            cellSize,
        };
        this.inputController.setBoardLayout(this.boardLayout, this.rows, this.columns);

        const statusY = boardTop + (compact ? 75 : 84);
        const statusNode = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 20, 650),
            compact ? 24 : 28,
            compact ? 13 : 15,
            palette.text,
            centerX,
            statusY,
            HorizontalTextAlignment.CENTER,
        );
        this.statusLabel = statusNode.getComponent(Label);
        if (this.statusLabel) {
            this.statusLabel.enableWrapText = false;
        }

        const controlsY = boardTop + (compact ? 38 : 44);
        const buttonWidth = compact ? 76 : 90;
        const buttonGap = compact ? 45 : 54;
        createButton(this.root, {
            name: 'MinesweeperNewButton',
            text: 'NEW',
            width: buttonWidth,
            height: compact ? 34 : 38,
            x: centerX - buttonGap,
            y: controlsY,
            fontSize: compact ? 12 : 13,
            variant: 'secondary',
            onPress: () => this.actions.restart(),
        });
        createButton(this.root, {
            name: 'MinesweeperFlagButton',
            text: 'FLAG',
            width: buttonWidth,
            height: compact ? 34 : 38,
            x: centerX + buttonGap,
            y: controlsY,
            fontSize: compact ? 12 : 13,
            variant: 'secondary',
            onPress: () => this.actions.toggleFlagMode(),
        });

        const modeNode = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 24, 560),
            compact ? 18 : 22,
            compact ? 10 : 11,
            palette.muted,
            centerX,
            boardBottom - (compact ? 22 : 26),
        );
        this.modeLabel = modeNode.getComponent(Label);
        if (this.modeLabel) {
            this.modeLabel.enableWrapText = false;
        }

        const board = createUiNode(
            this.root,
            'MinesweeperBoard',
            boardWidth,
            boardHeight,
            centerX,
            boardCenterY,
        );
        this.boardNode = board;
        this.boardGraphics = board.addComponent(Graphics);

        const fontSize = Math.max(10, Math.floor(cellSize * 0.5));
        for (let row = 0; row < this.rows; row += 1) {
            for (let column = 0; column < this.columns; column += 1) {
                const labelNode = createLabel(
                    board,
                    '',
                    cellSize,
                    cellSize,
                    fontSize,
                    palette.text,
                    -boardWidth / 2 + (column + 0.5) * cellSize,
                    boardHeight / 2 - (row + 0.5) * cellSize,
                );
                const label = labelNode.getComponent(Label);
                if (label) {
                    label.enableWrapText = false;
                    this.cellLabels.push(label);
                }
            }
        }
    }

    render(state: MinesweeperViewState): void {
        if (!this.boardGraphics || !this.boardNode || !this.boardLayout) {
            return;
        }
        this.drawBoard(state);
        if (this.statusLabel) {
            this.statusLabel.string = state.status;
            this.statusLabel.color = state.phase === 'lost'
                ? palette.danger
                : state.phase === 'won'
                    ? palette.accent
                    : palette.text;
        }
        if (this.modeLabel) {
            const controller = state.controller === 'autopilot'
                ? this.compactLayout
                    ? 'AI ACTIVE — TAP TO TAKE OVER'
                    : 'AI IS PLAYING — TOUCH OR PRESS A KEY TO TAKE OVER'
                : state.flagMode
                    ? this.compactLayout
                        ? 'FLAG MODE — TAP TO MARK'
                        : 'FLAG MODE — TAP A CELL TO MARK IT'
                    : this.compactLayout
                        ? 'TAP TO REVEAL — HOLD TO FLAG'
                        : 'REVEAL MODE — LONG PRESS OR RIGHT CLICK TO FLAG';
            this.modeLabel.string = controller;
            this.modeLabel.color = state.flagMode ? palette.warning : palette.muted;
        }
    }

    destroy(): void {
        this.inputController.destroy();
        this.boardNode = null;
        this.boardGraphics = null;
        this.cellLabels = [];
        this.statusLabel = null;
        this.modeLabel = null;
        this.boardLayout = null;
        clearNode(this.root);
    }

    private drawBoard(state: MinesweeperViewState): void {
        const graphics = this.boardGraphics;
        const layout = this.boardLayout;
        if (!graphics || !layout) {
            return;
        }
        const width = layout.width;
        const height = layout.height;
        const size = this.cellSize;
        graphics.clear();
        graphics.fillColor = palette.border;
        graphics.fillRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4);

        for (let index = 0; index < state.cells.length; index += 1) {
            const cell = state.cells[index];
            const x = -width / 2 + cell.column * size;
            const y = height / 2 - (cell.row + 1) * size;
            this.drawCell(graphics, cell, x, y, size);
            const label = this.cellLabels[index];
            if (label) {
                const showNumber = cell.state === 'revealed'
                    && !cell.mineVisible
                    && cell.adjacentMines > 0;
                label.string = showNumber ? `${cell.adjacentMines}` : '';
                label.color = NUMBER_COLORS[cell.adjacentMines] ?? palette.text;
            }
        }

        const focusX = -width / 2 + state.focusColumn * size;
        const focusY = height / 2 - (state.focusRow + 1) * size;
        graphics.strokeColor = state.controller === 'autopilot' ? palette.subtle : palette.accent;
        graphics.lineWidth = Math.max(2, size * 0.08);
        graphics.rect(
            focusX + 2,
            focusY + 2,
            Math.max(1, size - 4),
            Math.max(1, size - 4),
        );
        graphics.stroke();
    }

    private drawCell(
        graphics: Graphics,
        cell: MinesweeperCellViewState,
        x: number,
        y: number,
        size: number,
    ): void {
        const inset = Math.max(1, size * 0.045);
        if (cell.state === 'revealed' || cell.mineVisible) {
            graphics.fillColor = cell.exploded ? palette.danger : palette.surfaceSoft;
            graphics.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
            graphics.strokeColor = palette.border;
            graphics.lineWidth = Math.max(1, size * 0.035);
            graphics.rect(x + inset, y + inset, size - inset * 2, size - inset * 2);
            graphics.stroke();
        } else {
            graphics.fillColor = palette.surfaceStrong;
            graphics.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
            graphics.strokeColor = palette.borderStrong;
            graphics.lineWidth = Math.max(1, size * 0.055);
            graphics.moveTo(x + inset * 2, y + inset * 2);
            graphics.lineTo(x + inset * 2, y + size - inset * 2);
            graphics.lineTo(x + size - inset * 2, y + size - inset * 2);
            graphics.stroke();
            graphics.strokeColor = palette.backgroundRaised;
            graphics.moveTo(x + size - inset * 2, y + size - inset * 2);
            graphics.lineTo(x + size - inset * 2, y + inset * 2);
            graphics.lineTo(x + inset * 2, y + inset * 2);
            graphics.stroke();
        }

        if (cell.state === 'flagged' && !cell.mineVisible) {
            this.drawFlag(graphics, x, y, size, cell.wrongFlag);
        }
        if (cell.mineVisible) {
            this.drawMine(graphics, x, y, size, cell.exploded);
        }
        if (cell.wrongFlag) {
            graphics.strokeColor = palette.danger;
            graphics.lineWidth = Math.max(2, size * 0.08);
            graphics.moveTo(x + size * 0.24, y + size * 0.24);
            graphics.lineTo(x + size * 0.76, y + size * 0.76);
            graphics.moveTo(x + size * 0.76, y + size * 0.24);
            graphics.lineTo(x + size * 0.24, y + size * 0.76);
            graphics.stroke();
        }
    }

    private drawFlag(
        graphics: Graphics,
        x: number,
        y: number,
        size: number,
        wrong: boolean,
    ): void {
        const poleX = x + size * 0.43;
        graphics.strokeColor = wrong ? palette.danger : palette.primaryText;
        graphics.lineWidth = Math.max(2, size * 0.07);
        graphics.moveTo(poleX, y + size * 0.22);
        graphics.lineTo(poleX, y + size * 0.76);
        graphics.moveTo(x + size * 0.28, y + size * 0.22);
        graphics.lineTo(x + size * 0.65, y + size * 0.22);
        graphics.stroke();
        graphics.fillColor = wrong ? palette.danger : palette.warning;
        graphics.moveTo(poleX, y + size * 0.72);
        graphics.lineTo(x + size * 0.72, y + size * 0.59);
        graphics.lineTo(poleX, y + size * 0.48);
        graphics.close();
        graphics.fill();
    }

    private drawMine(
        graphics: Graphics,
        x: number,
        y: number,
        size: number,
        exploded: boolean,
    ): void {
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const radius = size * 0.18;
        graphics.fillColor = exploded ? palette.primaryText : palette.danger;
        graphics.circle(centerX, centerY, radius);
        graphics.fill();
        graphics.strokeColor = exploded ? palette.primaryText : palette.danger;
        graphics.lineWidth = Math.max(1.5, size * 0.055);
        for (let index = 0; index < 8; index += 1) {
            const angle = Math.PI * 2 * index / 8;
            graphics.moveTo(
                centerX + Math.cos(angle) * radius * 0.85,
                centerY + Math.sin(angle) * radius * 0.85,
            );
            graphics.lineTo(
                centerX + Math.cos(angle) * radius * 1.65,
                centerY + Math.sin(angle) * radius * 1.65,
            );
        }
        graphics.stroke();
    }
}
