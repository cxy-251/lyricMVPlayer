import {
    Color,
    EventKeyboard,
    EventMouse,
    EventTouch,
    Graphics,
    HorizontalTextAlignment,
    KeyCode,
    Label,
    Node,
    UITransform,
    Vec3,
} from 'cc';
import { inputRouter } from '../../../services/InputRouter';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import {
    clearNode,
    createButton,
    createLabel,
    createUiNode,
    fillNode,
} from '../../../ui/primitives';
import { palette } from '../../../ui/theme';
import type {
    ConnectFourBoardLayout,
    ConnectFourViewActions,
    ConnectFourViewState,
} from './ConnectFourTypes';

const RED = new Color(190, 104, 104, 255);
const YELLOW = new Color(202, 169, 91, 255);

export class ConnectFourView {
    private readonly unbindKeyboard: () => void;
    private graphics: Graphics | null = null;
    private statusLabel: Label | null = null;
    private statsLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private boardLayout: ConnectFourBoardLayout | null = null;
    private readonly screenPoint = new Vec3();

    constructor(
        private readonly root: Node,
        private readonly actions: ConnectFourViewActions,
    ) {
        this.unbindKeyboard = inputRouter.bind({
            priority: 100,
            onKeyDown: this.handleKeyDown,
        });
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
        const cellSize = Math.max(12, Math.floor(Math.min(
            (safeWidth - (compact ? 22 : 42)) / 7,
            boardAreaHeight / 6,
        )));
        const boardWidth = cellSize * 7;
        const boardHeight = cellSize * 6;
        const boardTop = contentTop - hudHeight;
        const boardBottom = boardTop - boardHeight;
        const boardCenterY = (boardTop + boardBottom) / 2;
        this.boardLayout = {
            left: centerX - boardWidth / 2,
            bottom: boardBottom,
            width: boardWidth,
            height: boardHeight,
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
            name: 'ConnectFourNewButton',
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
            'ConnectFourBoard',
            boardWidth,
            boardHeight,
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

    render(state: ConnectFourViewState): void {
        const graphics = this.graphics;
        const layout = this.boardLayout;
        if (!graphics || !layout) {
            return;
        }
        graphics.clear();
        graphics.fillColor = palette.primaryMuted;
        graphics.fillRect(
            -layout.width / 2,
            -layout.height / 2,
            layout.width,
            layout.height,
        );
        const winning = new Set(
            state.winningCells.map((cell) => `${cell.row}:${cell.column}`),
        );
        const radius = layout.cellSize * 0.37;
        for (let row = 0; row < 6; row += 1) {
            for (let column = 0; column < 7; column += 1) {
                const x = -layout.width / 2 + (column + 0.5) * layout.cellSize;
                const y = -layout.height / 2 + (row + 0.5) * layout.cellSize;
                const value = state.board[row][column];
                graphics.fillColor = value === 1
                    ? RED
                    : value === 2
                        ? YELLOW
                        : palette.backgroundRaised;
                graphics.circle(x, y, radius);
                graphics.fill();
                graphics.strokeColor = winning.has(`${row}:${column}`)
                    ? palette.primaryText
                    : palette.borderStrong;
                graphics.lineWidth = winning.has(`${row}:${column}`) ? 3 : 1.25;
                graphics.circle(x, y, radius);
                graphics.stroke();
            }
        }
        const focusX = -layout.width / 2 + state.focusColumn * layout.cellSize;
        graphics.strokeColor = state.controller === 'human'
            ? palette.accent
            : palette.subtle;
        graphics.lineWidth = 2;
        graphics.rect(
            focusX + 2,
            -layout.height / 2 + 2,
            layout.cellSize - 4,
            layout.height - 4,
        );
        graphics.stroke();

        if (this.statusLabel) {
            this.statusLabel.string = state.status;
            this.statusLabel.color = state.winner === 1
                ? RED
                : state.winner === 2
                    ? YELLOW
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
        this.unbindKeyboard();
        this.root.off(Node.EventType.MOUSE_DOWN, this.handleMouseDown, this);
        this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        clearNode(this.root);
    }

    private readonly handleKeyDown = (event: EventKeyboard): boolean => {
        switch (event.keyCode) {
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.actions.moveFocus(-1);
                return true;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.actions.moveFocus(1);
                return true;
            case KeyCode.ENTER:
            case KeyCode.SPACE:
                this.actions.dropFocused();
                return true;
            case KeyCode.KEY_R:
                this.actions.restart();
                return true;
            default:
                return false;
        }
    };

    private readonly handleMouseDown = (event: EventMouse): void => {
        if (event.getButton() === EventMouse.BUTTON_RIGHT) {
            return;
        }
        const location = event.getUILocation();
        this.dropAt(location.x, location.y);
    };

    private readonly handleTouchEnd = (event: EventTouch): void => {
        const location = event.getUILocation();
        this.dropAt(location.x, location.y);
    };

    private dropAt(screenX: number, screenY: number): void {
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
            Math.min(6, Math.floor((local.x - layout.left) / layout.cellSize)),
        );
        this.actions.drop(column);
    }
}
