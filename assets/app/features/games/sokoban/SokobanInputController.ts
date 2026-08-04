import {
    EventKeyboard,
    EventTouch,
    input,
    Input,
    KeyCode,
    Node,
    UITransform,
    Vec3,
} from 'cc';
import type {
    SokobanBoardLayout,
    SokobanDirection,
    SokobanViewActions,
} from './SokobanTypes';

const SWIPE_THRESHOLD = 18;

export class SokobanInputController {
    private readonly screenPoint = new Vec3();
    private boardLayout: SokobanBoardLayout | null = null;
    private touchStartX = 0;
    private touchStartY = 0;
    private touchStartedInside = false;

    constructor(
        private readonly root: Node,
        private readonly actions: SokobanViewActions,
    ) {
        input.on(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
        this.root.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        this.root.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
    }

    setBoardLayout(layout: SokobanBoardLayout): void {
        this.boardLayout = layout;
    }

    destroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
        this.root.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        this.root.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
        this.touchStartedInside = false;
    }

    private readonly handleKeyDown = (event: EventKeyboard): void => {
        switch (event.keyCode) {
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_W:
                this.actions.move('up');
                break;
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                this.actions.move('down');
                break;
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.actions.move('left');
                break;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.actions.move('right');
                break;
            case KeyCode.KEY_Z:
            case KeyCode.KEY_U:
                this.actions.undo();
                break;
            case KeyCode.KEY_R:
                this.actions.restart();
                break;
            case KeyCode.KEY_Q:
                this.actions.previousLevel();
                break;
            case KeyCode.KEY_E:
                this.actions.nextLevel();
                break;
            default:
                break;
        }
    };

    private readonly handleTouchStart = (event: EventTouch): void => {
        const location = event.getUILocation();
        const local = this.toLocal(location.x, location.y);
        this.touchStartX = local.x;
        this.touchStartY = local.y;
        this.touchStartedInside = this.isInsideBoard(local.x, local.y);
    };

    private readonly handleTouchEnd = (event: EventTouch): void => {
        if (!this.touchStartedInside) {
            return;
        }
        this.touchStartedInside = false;
        const location = event.getUILocation();
        const local = this.toLocal(location.x, location.y);
        const deltaX = local.x - this.touchStartX;
        const deltaY = local.y - this.touchStartY;
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD) {
            return;
        }
        const direction: SokobanDirection = Math.abs(deltaX) > Math.abs(deltaY)
            ? deltaX < 0 ? 'left' : 'right'
            : deltaY < 0 ? 'down' : 'up';
        this.actions.move(direction);
    };

    private readonly handleTouchCancel = (): void => {
        this.touchStartedInside = false;
    };

    private toLocal(screenX: number, screenY: number): Vec3 {
        const transform = this.root.getComponent(UITransform);
        this.screenPoint.set(screenX, screenY, 0);
        if (!transform) {
            return this.screenPoint;
        }
        return transform.convertToNodeSpaceAR(this.screenPoint);
    }

    private isInsideBoard(x: number, y: number): boolean {
        const layout = this.boardLayout;
        return !!layout
            && x >= layout.left
            && x <= layout.left + layout.width
            && y >= layout.bottom
            && y <= layout.bottom + layout.height;
    }
}
