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
import { SokobanInputController } from './SokobanInputController';
import type {
    SokobanBoardLayout,
    SokobanCellViewState,
    SokobanDirection,
    SokobanViewActions,
    SokobanViewState,
} from './SokobanTypes';

const FLOOR_A = new Color(31, 36, 33, 255);
const FLOOR_B = new Color(35, 41, 37, 255);
const WALL_FACE = new Color(69, 79, 73, 255);
const WALL_LIGHT = new Color(91, 103, 96, 255);
const WALL_DARK = new Color(38, 45, 41, 255);
const BOX_FACE = new Color(181, 149, 95, 255);
const BOX_GOAL = new Color(112, 158, 132, 255);
const PLAYER_FACE = new Color(118, 158, 196, 255);

export class SokobanView {
    private readonly inputController: SokobanInputController;
    private graphics: Graphics | null = null;
    private levelLabel: Label | null = null;
    private statusLabel: Label | null = null;
    private statsLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private resultLabel: Label | null = null;
    private boardLayout: SokobanBoardLayout | null = null;
    private compactLayout = false;
    private viewport: ViewportSnapshot | null = null;
    private layoutWidth = 0;
    private layoutHeight = 0;

    constructor(
        private readonly root: Node,
        private readonly actions: SokobanViewActions,
    ) {
        this.inputController = new SokobanInputController(root, actions);
    }

    layout(viewport: ViewportSnapshot, width: number, height: number): void {
        this.viewport = viewport;
        this.layoutWidth = width;
        this.layoutHeight = height;
        clearNode(this.root);
        this.root.setPosition(0, 0, 0);
        fillNode(this.root, viewport.width, viewport.height, palette.background);
        this.graphics = null;
        this.levelLabel = null;
        this.statusLabel = null;
        this.statsLabel = null;
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
        const contentBottom = safeBottom + (compact ? 8 : 14);
        const hudHeight = compact ? 64 : 72;
        const controlsHeight = compact ? 148 : 160;
        const boardAreaTop = contentTop - hudHeight;
        const boardAreaBottom = contentBottom + controlsHeight;
        const horizontalPadding = compact ? 16 : 30;
        const availableBoardWidth = Math.max(1, safeWidth - horizontalPadding);
        const availableBoardHeight = Math.max(1, boardAreaTop - boardAreaBottom);
        const cellSize = Math.max(
            10,
            Math.min(
                compact ? 54 : 64,
                Math.floor(Math.min(
                    availableBoardWidth / Math.max(1, width),
                    availableBoardHeight / Math.max(1, height),
                )),
            ),
        );
        const boardWidth = cellSize * width;
        const boardHeight = cellSize * height;
        const boardCenterY = (boardAreaTop + boardAreaBottom) / 2;
        const boardBottom = boardCenterY - boardHeight / 2;
        this.boardLayout = {
            left: centerX - boardWidth / 2,
            bottom: boardBottom,
            width: boardWidth,
            height: boardHeight,
            cellSize,
        };
        this.inputController.setBoardLayout(this.boardLayout);

        const levelNode = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 24, 560),
            compact ? 20 : 24,
            compact ? 12 : 14,
            palette.text,
            centerX,
            contentTop - (compact ? 10 : 12),
            HorizontalTextAlignment.CENTER,
        );
        this.levelLabel = levelNode.getComponent(Label);
        const statusNode = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 24, 560),
            compact ? 18 : 21,
            compact ? 10 : 12,
            palette.accent,
            centerX,
            contentTop - (compact ? 30 : 35),
        );
        this.statusLabel = statusNode.getComponent(Label);
        const statsNode = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 24, 560),
            compact ? 17 : 20,
            compact ? 9 : 10,
            palette.muted,
            centerX,
            contentTop - (compact ? 49 : 57),
        );
        this.statsLabel = statsNode.getComponent(Label);
        for (const label of [this.levelLabel, this.statusLabel, this.statsLabel]) {
            if (label) {
                label.enableWrapText = false;
            }
        }

        const board = createUiNode(
            this.root,
            'SokobanBoard',
            boardWidth,
            boardHeight,
            centerX,
            boardCenterY,
        );
        this.graphics = board.addComponent(Graphics);
        const resultNode = createLabel(
            board,
            '',
            Math.min(boardWidth - 16, 320),
            56,
            compact ? 18 : 22,
            palette.primaryText,
            0,
            0,
        );
        this.resultLabel = resultNode.getComponent(Label);
        if (this.resultLabel) {
            this.resultLabel.enableWrapText = false;
        }

        const hintNode = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 20, 620),
            compact ? 18 : 21,
            compact ? 9 : 10,
            palette.muted,
            centerX,
            contentBottom + (compact ? 136 : 147),
        );
        this.hintLabel = hintNode.getComponent(Label);
        if (this.hintLabel) {
            this.hintLabel.enableWrapText = false;
        }

        this.createDirectionButton(
            'SokobanUp',
            'UP',
            centerX,
            contentBottom + (compact ? 111 : 120),
            'up',
            compact,
        );
        this.createDirectionButton(
            'SokobanDown',
            'DOWN',
            centerX,
            contentBottom + (compact ? 51 : 56),
            'down',
            compact,
        );
        this.createDirectionButton(
            'SokobanLeft',
            'LEFT',
            centerX - (compact ? 52 : 58),
            contentBottom + (compact ? 81 : 88),
            'left',
            compact,
        );
        this.createDirectionButton(
            'SokobanRight',
            'RIGHT',
            centerX + (compact ? 52 : 58),
            contentBottom + (compact ? 81 : 88),
            'right',
            compact,
        );

        const utilityY = contentBottom + (compact ? 17 : 19);
        const utilityGap = Math.min(
            compact ? 73 : 86,
            Math.max(54, (safeWidth - 20) / 4),
        );
        const utilityWidth = Math.max(
            48,
            Math.min(compact ? 66 : 78, utilityGap - 6),
        );
        const utilityFont = compact ? 9 : 10;
        const utilities = [
            { name: 'SokobanPrevious', text: 'PREV', press: () => this.actions.previousLevel() },
            { name: 'SokobanUndo', text: 'UNDO', press: () => this.actions.undo() },
            { name: 'SokobanRestart', text: 'NEW', press: () => this.actions.restart() },
            { name: 'SokobanNext', text: 'NEXT', press: () => this.actions.nextLevel() },
        ];
        for (let index = 0; index < utilities.length; index += 1) {
            const item = utilities[index];
            createButton(this.root, {
                name: item.name,
                text: item.text,
                width: utilityWidth,
                height: compact ? 30 : 34,
                x: centerX + (index - 1.5) * utilityGap,
                y: utilityY,
                fontSize: utilityFont,
                variant: 'secondary',
                onPress: item.press,
            });
        }
    }

    render(state: SokobanViewState): void {
        if (
            this.viewport
            && (state.width !== this.layoutWidth || state.height !== this.layoutHeight)
        ) {
            this.layout(this.viewport, state.width, state.height);
        }
        if (!this.graphics || !this.boardLayout) {
            return;
        }
        this.drawBoard(state);
        if (this.levelLabel) {
            this.levelLabel.string = `${state.levelName}`;
        }
        if (this.statusLabel) {
            this.statusLabel.string = state.status;
            this.statusLabel.color = state.deadlocked
                ? palette.danger
                : state.phase === 'won'
                    ? palette.accent
                    : state.controller === 'autopilot'
                        ? palette.warning
                        : palette.accent;
        }
        if (this.statsLabel) {
            this.statsLabel.string = state.stats;
        }
        if (this.hintLabel) {
            this.hintLabel.string = this.compactLayout
                ? state.phase === 'won'
                    ? 'NEXT OR WAIT FOR AI'
                    : state.planning
                        ? 'AI PLANNING — MOVE TO TAKE OVER'
                        : state.controller === 'autopilot'
                            ? 'AI ACTIVE — MOVE TO TAKE OVER'
                            : 'SWIPE OR USE THE D-PAD'
                : state.hint;
        }
        if (this.resultLabel) {
            this.resultLabel.string = state.phase === 'won' ? 'CLEARED' : '';
        }
    }

    destroy(): void {
        this.inputController.destroy();
        this.graphics = null;
        this.levelLabel = null;
        this.statusLabel = null;
        this.statsLabel = null;
        this.hintLabel = null;
        this.resultLabel = null;
        this.boardLayout = null;
        this.viewport = null;
        this.layoutWidth = 0;
        this.layoutHeight = 0;
        clearNode(this.root);
    }

    private createDirectionButton(
        name: string,
        text: string,
        x: number,
        y: number,
        direction: SokobanDirection,
        compact: boolean,
    ): void {
        createButton(this.root, {
            name,
            text,
            width: compact ? 54 : 62,
            height: compact ? 32 : 36,
            x,
            y,
            fontSize: compact ? 9 : 10,
            variant: 'secondary',
            onPress: () => this.actions.move(direction),
        });
    }

    private drawBoard(state: SokobanViewState): void {
        const graphics = this.graphics;
        const layout = this.boardLayout;
        if (!graphics || !layout) {
            return;
        }
        const size = layout.cellSize;
        const width = layout.width;
        const height = layout.height;
        graphics.clear();
        graphics.fillColor = palette.border;
        graphics.fillRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4);

        for (const cell of state.cells) {
            const x = -width / 2 + cell.column * size;
            const y = height / 2 - (cell.row + 1) * size;
            this.drawCell(graphics, cell, x, y, size, state.deadlocked);
        }
    }

    private drawCell(
        graphics: Graphics,
        cell: SokobanCellViewState,
        x: number,
        y: number,
        size: number,
        deadlocked: boolean,
    ): void {
        const inset = Math.max(1, size * 0.035);
        if (cell.wall) {
            graphics.fillColor = WALL_FACE;
            graphics.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
            graphics.strokeColor = WALL_LIGHT;
            graphics.lineWidth = Math.max(1, size * 0.045);
            graphics.moveTo(x + inset * 2, y + inset * 2);
            graphics.lineTo(x + inset * 2, y + size - inset * 2);
            graphics.lineTo(x + size - inset * 2, y + size - inset * 2);
            graphics.stroke();
            graphics.strokeColor = WALL_DARK;
            graphics.moveTo(x + size - inset * 2, y + size - inset * 2);
            graphics.lineTo(x + size - inset * 2, y + inset * 2);
            graphics.lineTo(x + inset * 2, y + inset * 2);
            graphics.stroke();
            return;
        }

        graphics.fillColor = (cell.row + cell.column) % 2 === 0 ? FLOOR_A : FLOOR_B;
        graphics.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);

        const centerX = x + size / 2;
        const centerY = y + size / 2;
        if (cell.goal) {
            graphics.strokeColor = palette.accent;
            graphics.lineWidth = Math.max(1.5, size * 0.055);
            graphics.circle(centerX, centerY, size * 0.21);
            graphics.stroke();
            graphics.fillColor = palette.accentSoft;
            graphics.circle(centerX, centerY, size * 0.08);
            graphics.fill();
        }

        if (cell.box) {
            const boxInset = size * 0.14;
            const boxSize = size - boxInset * 2;
            graphics.fillColor = cell.goal ? BOX_GOAL : BOX_FACE;
            graphics.fillRect(x + boxInset, y + boxInset, boxSize, boxSize);
            graphics.strokeColor = cell.goal ? palette.primaryText : palette.borderStrong;
            graphics.lineWidth = Math.max(1.5, size * 0.055);
            graphics.rect(x + boxInset, y + boxInset, boxSize, boxSize);
            graphics.moveTo(x + boxInset * 1.35, y + boxInset * 1.35);
            graphics.lineTo(x + size - boxInset * 1.35, y + size - boxInset * 1.35);
            graphics.moveTo(x + size - boxInset * 1.35, y + boxInset * 1.35);
            graphics.lineTo(x + boxInset * 1.35, y + size - boxInset * 1.35);
            graphics.stroke();
            if (deadlocked && !cell.goal) {
                graphics.strokeColor = palette.danger;
                graphics.lineWidth = Math.max(2, size * 0.085);
                graphics.rect(
                    x + boxInset * 0.75,
                    y + boxInset * 0.75,
                    size - boxInset * 1.5,
                    size - boxInset * 1.5,
                );
                graphics.stroke();
            }
        }

        if (cell.player) {
            graphics.fillColor = PLAYER_FACE;
            graphics.circle(centerX, centerY, size * 0.22);
            graphics.fill();
            graphics.strokeColor = palette.primaryText;
            graphics.lineWidth = Math.max(1.5, size * 0.045);
            graphics.circle(centerX, centerY, size * 0.22);
            graphics.stroke();
            graphics.fillColor = palette.primaryText;
            graphics.circle(centerX - size * 0.075, centerY + size * 0.04, size * 0.025);
            graphics.circle(centerX + size * 0.075, centerY + size * 0.04, size * 0.025);
            graphics.fill();
            graphics.strokeColor = palette.primaryText;
            graphics.lineWidth = Math.max(1, size * 0.03);
            graphics.moveTo(centerX - size * 0.08, centerY - size * 0.07);
            graphics.lineTo(centerX + size * 0.08, centerY - size * 0.07);
            graphics.stroke();
        }
    }
}
