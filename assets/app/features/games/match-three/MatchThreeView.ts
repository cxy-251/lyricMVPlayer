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
    MatchThreeBoardLayout,
    MatchThreeCell,
    MatchThreeDirection,
    MatchThreeTileState,
    MatchThreeViewActions,
    MatchThreeViewState,
} from './MatchThreeTypes';

const TILE_COLORS = [
    new Color(190, 104, 104, 255),
    new Color(202, 169, 91, 255),
    new Color(112, 151, 184, 255),
    new Color(126, 158, 143, 255),
    new Color(155, 126, 177, 255),
    new Color(202, 133, 100, 255),
] as const;
const SWIPE_THRESHOLD = 22;

export class MatchThreeView {
    private readonly unbindKeyboard: () => void;
    private graphics: Graphics | null = null;
    private statusLabel: Label | null = null;
    private statsLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private boardLayout: MatchThreeBoardLayout | null = null;
    private touchStartCell: MatchThreeCell | null = null;
    private touchStartX = 0;
    private touchStartY = 0;
    private readonly screenPoint = new Vec3();

    constructor(
        private readonly root: Node,
        private readonly actions: MatchThreeViewActions,
    ) {
        this.unbindKeyboard = inputRouter.bind({
            priority: 100,
            onKeyDown: this.handleKeyDown,
        });
        root.on(Node.EventType.MOUSE_DOWN, this.handleMouseDown, this);
        root.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        root.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
    }

    layout(viewport: ViewportSnapshot): void {
        clearNode(this.root);
        fillNode(this.root, viewport.width, viewport.height, palette.background);
        this.graphics = null;
        this.statusLabel = null;
        this.statsLabel = null;
        this.hintLabel = null;
        this.boardLayout = null;

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = viewport.width
            - viewport.safeInsets.left
            - viewport.safeInsets.right;
        const safeTop = viewport.height / 2 - viewport.safeInsets.top;
        const safeBottom = -viewport.height / 2 + viewport.safeInsets.bottom;
        const centerX = (
            viewport.safeInsets.left - viewport.safeInsets.right
        ) / 2;
        const contentTop = safeTop - (compact ? 66 : 74);
        const contentBottom = safeBottom + (compact ? 12 : 18);
        const hudHeight = compact ? 92 : 104;
        const footerHeight = compact ? 28 : 34;
        const boardAreaHeight = Math.max(
            96,
            contentTop - contentBottom - hudHeight - footerHeight,
        );
        const boardSize = Math.max(96, Math.floor(Math.min(
            safeWidth - (compact ? 20 : 42),
            boardAreaHeight,
            compact ? 540 : 620,
        )));
        const cellSize = boardSize / 8;
        const boardTop = contentTop - hudHeight;
        const boardBottom = boardTop - boardSize;
        const boardCenterY = (boardTop + boardBottom) / 2;

        this.boardLayout = {
            left: centerX - boardSize / 2,
            bottom: boardBottom,
            size: boardSize,
            cellSize,
        };

        this.statusLabel = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 24, 560),
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
            Math.min(safeWidth - 24, 640),
            compact ? 18 : 20,
            compact ? 9 : 11,
            palette.muted,
            centerX,
            contentTop - (compact ? 39 : 45),
        ).getComponent(Label);
        createButton(this.root, {
            name: 'MatchThreeNewButton',
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
            'MatchThreeBoard',
            boardSize,
            boardSize,
            centerX,
            boardCenterY,
        );
        this.graphics = boardNode.addComponent(Graphics);
        this.hintLabel = createLabel(
            this.root,
            '',
            Math.min(safeWidth - 24, 700),
            compact ? 20 : 24,
            compact ? 8 : 10,
            palette.muted,
            centerX,
            boardBottom - (compact ? 17 : 21),
        ).getComponent(Label);
    }

    render(state: MatchThreeViewState): void {
        const graphics = this.graphics;
        const layout = this.boardLayout;
        if (!graphics || !layout) {
            return;
        }

        graphics.clear();
        graphics.fillColor = palette.backgroundRaised;
        graphics.fillRect(
            -layout.size / 2,
            -layout.size / 2,
            layout.size,
            layout.size,
        );

        for (let row = 0; row < state.size; row += 1) {
            for (let column = 0; column < state.size; column += 1) {
                const tile = state.board[row][column];
                const x = -layout.size / 2 + column * layout.cellSize;
                const y = -layout.size / 2 + row * layout.cellSize;
                this.drawTile(graphics, tile, x, y, layout.cellSize);
            }
        }

        if (state.selected) {
            this.drawCellOutline(
                graphics,
                state.selected,
                layout,
                palette.primaryText,
                3,
            );
        }
        this.drawCellOutline(
            graphics,
            state.focus,
            layout,
            state.controller === 'human' ? palette.accent : palette.subtle,
            state.selected ? 1.5 : 2,
        );

        if (this.statusLabel) {
            this.statusLabel.string = state.status;
            this.statusLabel.color = state.phase === 'won'
                ? palette.accent
                : state.phase === 'lost'
                    ? palette.danger
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
        this.root.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        this.root.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
        this.graphics = null;
        this.boardLayout = null;
        clearNode(this.root);
    }

    private drawTile(
        graphics: Graphics,
        tile: MatchThreeTileState,
        x: number,
        y: number,
        cellSize: number,
    ): void {
        const inset = Math.max(1.5, cellSize * 0.065);
        const left = x + inset;
        const bottom = y + inset;
        const size = cellSize - inset * 2;
        const radius = Math.max(3, cellSize * 0.16);

        graphics.fillColor = palette.surfaceStrong;
        graphics.roundRect(left, bottom, size, size, radius);
        graphics.fill();

        if (tile.special === 'prism') {
            const centerX = x + cellSize / 2;
            const centerY = y + cellSize / 2;
            const half = cellSize * 0.3;
            graphics.fillColor = palette.primaryText;
            graphics.moveTo(centerX, centerY + half);
            graphics.lineTo(centerX + half, centerY);
            graphics.lineTo(centerX, centerY - half);
            graphics.lineTo(centerX - half, centerY);
            graphics.close();
            graphics.fill();
            for (let index = 0; index < TILE_COLORS.length; index += 1) {
                const angle = index / TILE_COLORS.length * Math.PI * 2;
                graphics.fillColor = TILE_COLORS[index];
                graphics.circle(
                    centerX + Math.cos(angle) * cellSize * 0.18,
                    centerY + Math.sin(angle) * cellSize * 0.18,
                    Math.max(1.5, cellSize * 0.045),
                );
                graphics.fill();
            }
            return;
        }

        const color = TILE_COLORS[Math.max(0, tile.color)] ?? palette.accent;
        graphics.fillColor = color;
        graphics.roundRect(
            left + inset,
            bottom + inset,
            size - inset * 2,
            size - inset * 2,
            Math.max(2, radius * 0.72),
        );
        graphics.fill();

        const centerX = x + cellSize / 2;
        const centerY = y + cellSize / 2;
        if (tile.special === 'row') {
            graphics.strokeColor = palette.primaryText;
            graphics.lineWidth = Math.max(2, cellSize * 0.08);
            graphics.moveTo(x + cellSize * 0.2, centerY);
            graphics.lineTo(x + cellSize * 0.8, centerY);
            graphics.stroke();
        } else if (tile.special === 'column') {
            graphics.strokeColor = palette.primaryText;
            graphics.lineWidth = Math.max(2, cellSize * 0.08);
            graphics.moveTo(centerX, y + cellSize * 0.2);
            graphics.lineTo(centerX, y + cellSize * 0.8);
            graphics.stroke();
        } else {
            graphics.fillColor = new Color(255, 255, 255, 72);
            graphics.circle(
                x + cellSize * 0.37,
                y + cellSize * 0.65,
                Math.max(1.5, cellSize * 0.07),
            );
            graphics.fill();
        }
    }

    private drawCellOutline(
        graphics: Graphics,
        cell: MatchThreeCell,
        layout: MatchThreeBoardLayout,
        color: Color,
        lineWidth: number,
    ): void {
        const x = -layout.size / 2 + cell.column * layout.cellSize;
        const y = -layout.size / 2 + cell.row * layout.cellSize;
        const inset = Math.max(2, layout.cellSize * 0.045);
        graphics.strokeColor = color;
        graphics.lineWidth = lineWidth;
        graphics.roundRect(
            x + inset,
            y + inset,
            layout.cellSize - inset * 2,
            layout.cellSize - inset * 2,
            Math.max(3, layout.cellSize * 0.14),
        );
        graphics.stroke();
    }

    private readonly handleKeyDown = (event: EventKeyboard): boolean => {
        switch (event.keyCode) {
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_W:
                this.actions.moveFocus(1, 0);
                return true;
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                this.actions.moveFocus(-1, 0);
                return true;
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.actions.moveFocus(0, -1);
                return true;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.actions.moveFocus(0, 1);
                return true;
            case KeyCode.ENTER:
            case KeyCode.SPACE:
                this.actions.activateFocused();
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
        const cell = this.cellAt(location.x, location.y);
        if (cell) {
            this.actions.selectCell(cell.row, cell.column);
        }
    };

    private readonly handleTouchStart = (event: EventTouch): void => {
        const location = event.getUILocation();
        this.touchStartX = location.x;
        this.touchStartY = location.y;
        this.touchStartCell = this.cellAt(location.x, location.y);
    };

    private readonly handleTouchEnd = (event: EventTouch): void => {
        const start = this.touchStartCell;
        this.touchStartCell = null;
        if (!start) {
            return;
        }
        const location = event.getUILocation();
        const deltaX = location.x - this.touchStartX;
        const deltaY = location.y - this.touchStartY;
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= SWIPE_THRESHOLD) {
            const direction: MatchThreeDirection =
                Math.abs(deltaX) > Math.abs(deltaY)
                    ? deltaX > 0 ? 'right' : 'left'
                    : deltaY > 0 ? 'up' : 'down';
            this.actions.swapCell(start.row, start.column, direction);
            return;
        }
        const end = this.cellAt(location.x, location.y) ?? start;
        this.actions.selectCell(end.row, end.column);
    };

    private readonly handleTouchCancel = (): void => {
        this.touchStartCell = null;
    };

    private cellAt(screenX: number, screenY: number): MatchThreeCell | null {
        const layout = this.boardLayout;
        const transform = this.root.getComponent(UITransform);
        if (!layout || !transform) {
            return null;
        }
        this.screenPoint.set(screenX, screenY, 0);
        const local = transform.convertToNodeSpaceAR(this.screenPoint);
        if (
            local.x < layout.left
            || local.x >= layout.left + layout.size
            || local.y < layout.bottom
            || local.y >= layout.bottom + layout.size
        ) {
            return null;
        }
        return {
            row: Math.max(
                0,
                Math.min(7, Math.floor(
                    (local.y - layout.bottom) / layout.cellSize,
                )),
            ),
            column: Math.max(
                0,
                Math.min(7, Math.floor(
                    (local.x - layout.left) / layout.cellSize,
                )),
            ),
        };
    }
}
