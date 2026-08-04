import {
    Color,
    EventKeyboard,
    EventMouse,
    EventTouch,
    Graphics,
    HorizontalTextAlignment,
    input,
    Input,
    KeyCode,
    Label,
    Node,
    UITransform,
    Vec3,
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
import type {
    ReversiBoardLayout,
    ReversiViewActions,
    ReversiViewState,
} from './ReversiTypes';

const BOARD_A = new Color(55, 86, 69, 255);
const BOARD_B = new Color(48, 78, 62, 255);
const BLACK_DISC = new Color(19, 22, 21, 255);
const WHITE_DISC = new Color(224, 230, 226, 255);

export class ReversiView {
    private graphics: Graphics | null = null;
    private statusLabel: Label | null = null;
    private statsLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private boardLayout: ReversiBoardLayout | null = null;
    private readonly screenPoint = new Vec3();

    constructor(
        private readonly root: Node,
        private readonly actions: ReversiViewActions,
    ) {
        input.on(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
        root.on(Node.EventType.MOUSE_DOWN, this.handleMouseDown, this);
        root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    }

    layout(viewport: ViewportSnapshot): void {
        clearNode(this.root);
        fillNode(this.root, viewport.width, viewport.height, palette.background);
        this.graphics = null;
        this.statusLabel = null;
        this.statsLabel = null;
        this.hintLabel = null;

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const safeTop = viewport.height / 2 - viewport.safeInsets.top;
        const safeBottom = -viewport.height / 2 + viewport.safeInsets.bottom;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const contentTop = safeTop - (compact ? 66 : 74);
        const contentBottom = safeBottom + (compact ? 14 : 20);
        const hudHeight = compact ? 88 : 100;
        const footerHeight = compact ? 24 : 30;
        const boardAreaHeight = Math.max(120, contentTop - contentBottom - hudHeight - footerHeight);
        const cellSize = Math.max(10, Math.floor(Math.min(
            (safeWidth - (compact ? 22 : 42)) / 8,
            boardAreaHeight / 8,
        )));
        const boardSize = cellSize * 8;
        const boardTop = contentTop - hudHeight;
        const boardBottom = boardTop - boardSize;
        const boardCenterY = (boardTop + boardBottom) / 2;
        this.boardLayout = {
            left: centerX - boardSize / 2,
            bottom: boardBottom,
            width: boardSize,
            height: boardSize,
            cellSize,
        };

        this.statusLabel = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 24, 520),
            compact ? 22 : 26,
            compact ? 13 : 15,
            palette.text,
            centerX,
            contentTop - (compact ? 13 : 15),
            HorizontalTextAlignment.CENTER,
        ).getComponent(Label);
        this.statsLabel = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 24, 520),
            compact ? 18 : 20,
            compact ? 9 : 11,
            palette.muted,
            centerX,
            contentTop - (compact ? 39 : 45),
        ).getComponent(Label);
        createButton(this.root, {
            name: 'ReversiNewButton',
            text: 'NEW',
            width: compact ? 72 : 84,
            height: compact ? 32 : 36,
            x: centerX,
            y: contentTop - (compact ? 70 : 80),
            fontSize: compact ? 11 : 12,
            variant: 'secondary',
            onPress: () => this.actions.restart(),
        });

        const boardNode = createUiNode(
            this.root,
            'ReversiBoard',
            boardSize,
            boardSize,
            centerX,
            boardCenterY,
        );
        this.graphics = boardNode.addComponent(Graphics);
        this.hintLabel = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 24, 620),
            compact ? 18 : 22,
            compact ? 9 : 10,
            palette.muted,
            centerX,
            boardBottom - (compact ? 17 : 21),
        ).getComponent(Label);
    }

    render(state: ReversiViewState): void {
        const graphics = this.graphics;
        const layout = this.boardLayout;
        if (!graphics || !layout) {
            return;
        }
        graphics.clear();
        const legal = new Set(
            state.legalMoves.map((cell) => `${cell.row}:${cell.column}`),
        );
        for (let row = 0; row < 8; row += 1) {
            for (let column = 0; column < 8; column += 1) {
                const x = -layout.width / 2 + column * layout.cellSize;
                const y = layout.height / 2 - (row + 1) * layout.cellSize;
                graphics.fillColor = (row + column) % 2 === 0 ? BOARD_A : BOARD_B;
                graphics.fillRect(x, y, layout.cellSize, layout.cellSize);
                graphics.strokeColor = palette.borderStrong;
                graphics.lineWidth = 1;
                graphics.rect(x, y, layout.cellSize, layout.cellSize);
                graphics.stroke();

                const value = state.board[row][column];
                const centerX = x + layout.cellSize / 2;
                const centerY = y + layout.cellSize / 2;
                if (value !== 0) {
                    graphics.fillColor = value === 1 ? BLACK_DISC : WHITE_DISC;
                    graphics.circle(centerX, centerY, layout.cellSize * 0.36);
                    graphics.fill();
                    graphics.strokeColor = value === 1
                        ? palette.borderStrong
                        : palette.background;
                    graphics.lineWidth = 1.5;
                    graphics.circle(centerX, centerY, layout.cellSize * 0.36);
                    graphics.stroke();
                } else if (legal.has(`${row}:${column}`)) {
                    graphics.fillColor = state.currentPlayer === 1
                        ? new Color(20, 24, 22, 120)
                        : new Color(230, 235, 232, 150);
                    graphics.circle(centerX, centerY, layout.cellSize * 0.105);
                    graphics.fill();
                }
            }
        }
        const focusX = -layout.width / 2 + state.focusColumn * layout.cellSize;
        const focusY = layout.height / 2 - (state.focusRow + 1) * layout.cellSize;
        graphics.strokeColor = state.controller === 'human'
            ? palette.accent
            : palette.subtle;
        graphics.lineWidth = 2;
        graphics.rect(
            focusX + 2,
            focusY + 2,
            layout.cellSize - 4,
            layout.cellSize - 4,
        );
        graphics.stroke();

        if (this.statusLabel) {
            this.statusLabel.string = state.status;
            this.statusLabel.color = state.winner === 2
                ? WHITE_DISC
                : palette.text;
        }
        if (this.statsLabel) {
            this.statsLabel.string = state.stats;
        }
        if (this.hintLabel) {
            this.hintLabel.string = state.hint;
        }
    }

    destroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
        this.root.off(Node.EventType.MOUSE_DOWN, this.handleMouseDown, this);
        this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        clearNode(this.root);
    }

    private readonly handleKeyDown = (event: EventKeyboard): void => {
        switch (event.keyCode) {
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_W:
                this.actions.moveFocus(-1, 0);
                break;
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                this.actions.moveFocus(1, 0);
                break;
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.actions.moveFocus(0, -1);
                break;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.actions.moveFocus(0, 1);
                break;
            case KeyCode.ENTER:
            case KeyCode.SPACE:
                this.actions.placeFocused();
                break;
            case KeyCode.KEY_R:
                this.actions.restart();
                break;
            default:
                break;
        }
    };

    private readonly handleMouseDown = (event: EventMouse): void => {
        if (event.getButton() === EventMouse.BUTTON_RIGHT) {
            return;
        }
        const location = event.getUILocation();
        this.placeAt(location.x, location.y);
    };

    private readonly handleTouchEnd = (event: EventTouch): void => {
        const location = event.getUILocation();
        this.placeAt(location.x, location.y);
    };

    private placeAt(screenX: number, screenY: number): void {
        const layout = this.boardLayout;
        const transform = this.root.getComponent(UITransform);
        if (!layout || !transform) {
            return;
        }
        this.screenPoint.set(screenX, screenY, 0);
        const local = transform.convertToNodeSpaceAR(this.screenPoint);
        if (
            local.x < layout.left
            || local.x > layout.left + layout.width
            || local.y < layout.bottom
            || local.y > layout.bottom + layout.height
        ) {
            return;
        }
        const column = Math.max(
            0,
            Math.min(7, Math.floor((local.x - layout.left) / layout.cellSize)),
        );
        const row = Math.max(
            0,
            Math.min(7, Math.floor((layout.bottom + layout.height - local.y) / layout.cellSize)),
        );
        this.actions.place(row, column);
    }
}
