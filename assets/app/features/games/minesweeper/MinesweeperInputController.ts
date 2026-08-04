import {
    EventKeyboard,
    EventMouse,
    EventTouch,
    input,
    Input,
    KeyCode,
    Node,
    UITransform,
    Vec3,
} from 'cc';
import type { MinesweeperBoardLayout } from './MinesweeperTypes';

const LONG_PRESS_MILLISECONDS = 520;

export interface MinesweeperInputActions {
    primaryCell(row: number, column: number): void;
    secondaryCell(row: number, column: number): void;
    primaryFocused(): void;
    secondaryFocused(): void;
    moveFocus(rowOffset: number, columnOffset: number): void;
    restart(): void;
    toggleFlagMode(): void;
}

interface CellPoint {
    readonly row: number;
    readonly column: number;
}

export class MinesweeperInputController {
    private readonly screenPoint = new Vec3();
    private boardLayout: MinesweeperBoardLayout | null = null;
    private rows = 0;
    private columns = 0;
    private touchStartTime = 0;
    private touchStartCell: CellPoint | null = null;

    constructor(
        private readonly root: Node,
        private readonly actions: MinesweeperInputActions,
    ) {
        this.bind();
    }

    setBoardLayout(
        layout: MinesweeperBoardLayout,
        rows: number,
        columns: number,
    ): void {
        this.boardLayout = layout;
        this.rows = rows;
        this.columns = columns;
    }

    destroy(): void {
        this.root.off(Node.EventType.MOUSE_DOWN, this.handleMouseDown, this);
        this.root.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        this.root.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
        input.off(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
    }

    private bind(): void {
        this.root.on(Node.EventType.MOUSE_DOWN, this.handleMouseDown, this);
        this.root.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        this.root.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
        input.on(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
    }

    private readonly handleMouseDown = (event: EventMouse): void => {
        const location = event.getUILocation();
        const cell = this.screenToCell(location.x, location.y);
        if (!cell) {
            return;
        }
        if (event.getButton() === EventMouse.BUTTON_RIGHT) {
            this.actions.secondaryCell(cell.row, cell.column);
        } else {
            this.actions.primaryCell(cell.row, cell.column);
        }
    };

    private readonly handleTouchStart = (event: EventTouch): void => {
        const location = event.getUILocation();
        this.touchStartCell = this.screenToCell(location.x, location.y);
        this.touchStartTime = Date.now();
    };

    private readonly handleTouchEnd = (event: EventTouch): void => {
        const location = event.getUILocation();
        const endCell = this.screenToCell(location.x, location.y);
        const startCell = this.touchStartCell;
        const duration = Date.now() - this.touchStartTime;
        this.touchStartCell = null;
        if (
            !startCell
            || !endCell
            || startCell.row !== endCell.row
            || startCell.column !== endCell.column
        ) {
            return;
        }
        if (duration >= LONG_PRESS_MILLISECONDS) {
            this.actions.secondaryCell(endCell.row, endCell.column);
        } else {
            this.actions.primaryCell(endCell.row, endCell.column);
        }
    };

    private readonly handleTouchCancel = (): void => {
        this.touchStartCell = null;
    };

    private readonly handleKeyDown = (event: EventKeyboard): void => {
        switch (event.keyCode) {
            case KeyCode.ARROW_UP:
                this.actions.moveFocus(-1, 0);
                break;
            case KeyCode.ARROW_DOWN:
                this.actions.moveFocus(1, 0);
                break;
            case KeyCode.ARROW_LEFT:
                this.actions.moveFocus(0, -1);
                break;
            case KeyCode.ARROW_RIGHT:
                this.actions.moveFocus(0, 1);
                break;
            case KeyCode.ENTER:
            case KeyCode.SPACE:
                this.actions.primaryFocused();
                break;
            case KeyCode.KEY_F:
                this.actions.secondaryFocused();
                break;
            case KeyCode.KEY_R:
                this.actions.restart();
                break;
            case KeyCode.TAB:
                this.actions.toggleFlagMode();
                break;
            default:
                break;
        }
    };

    private screenToCell(screenX: number, screenY: number): CellPoint | null {
        const layout = this.boardLayout;
        const transform = this.root.getComponent(UITransform);
        if (!layout || !transform) {
            return null;
        }
        this.screenPoint.set(screenX, screenY, 0);
        const local = transform.convertToNodeSpaceAR(this.screenPoint);
        if (
            local.x < layout.left
            || local.x >= layout.left + layout.width
            || local.y < layout.bottom
            || local.y >= layout.bottom + layout.height
        ) {
            return null;
        }
        const column = Math.floor((local.x - layout.left) / layout.cellSize);
        const rowFromBottom = Math.floor((local.y - layout.bottom) / layout.cellSize);
        const row = this.rows - 1 - rowFromBottom;
        if (row < 0 || row >= this.rows || column < 0 || column >= this.columns) {
            return null;
        }
        return { row, column };
    }
}
