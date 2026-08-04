import {
    EventKeyboard,
    EventTouch,
    KeyCode,
    Node,
    UITransform,
    Vec3,
} from 'cc';
import { inputRouter } from '../../../services/InputRouter';
import type {
    SokobanBoardLayout,
    SokobanDirection,
    SokobanViewActions,
} from './SokobanTypes';

const SWIPE_THRESHOLD = 18;

export class SokobanInputController {
    private readonly screenPoint = new Vec3();
    private readonly unbindKeyboard: () => void;
    private boardLayout: SokobanBoardLayout | null = null;
    private touchStartX = 0;
    private touchStartY = 0;
    private touchStartedInside = false;

    constructor(
        private readonly root: Node,
        private readonly actions: SokobanViewActions,
    ) {
        this.unbindKeyboard = inputRouter.bind({
            priority: 100,
            onKeyDown: this.handleKeyDown,
        });
        this.root.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        this.root.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
    }

    setBoardLayout(layout: SokobanBoardLayout): void {
        this.boardLayout = layout;
    }

    destroy(): void {
        this.unbindKeyboard();
        this.root.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        this.root.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
        this.touchStartedInside = false;
    }

    private readonly handleKeyDown = (event: EventKeyboard): boolean => {
        switch (event.keyCode) {
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_W:
                this.actions.move('up');
                return true;
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                this.actions.move('down');
                return true;
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.actions.move('left');
                return true;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.actions.move('right');
                return true;
            case KeyCode.KEY_Z:
            case KeyCode.KEY_U:
                this.actions.undo();
                return true;
            case KeyCode.KEY_R:
                this.actions.restart();
                return true;
            case KeyCode.KEY_Q:
                this.actions.previousLevel();
                return true;
            case KeyCode.KEY_E:
                this.actions.nextLevel();
                return true;
            default:
                return false;
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
