import {
    EventKeyboard,
    EventTouch,
    input,
    Input,
    KeyCode,
    Node,
} from 'cc';
import type { SnakeDirection, SnakeViewActions } from './SnakeTypes';

const SWIPE_THRESHOLD = 22;

export class SnakeInputController {
    private touchStartX = 0;
    private touchStartY = 0;

    constructor(
        private readonly root: Node,
        private readonly actions: SnakeViewActions,
    ) {
        input.on(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
        root.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    }

    destroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
        this.root.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    }

    private readonly handleKeyDown = (event: EventKeyboard): void => {
        switch (event.keyCode) {
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_W:
                this.actions.direction('up');
                break;
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                this.actions.direction('down');
                break;
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.actions.direction('left');
                break;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.actions.direction('right');
                break;
            case KeyCode.KEY_R:
            case KeyCode.SPACE:
                this.actions.restart();
                break;
            default:
                break;
        }
    };

    private readonly handleTouchStart = (event: EventTouch): void => {
        const location = event.getUILocation();
        this.touchStartX = location.x;
        this.touchStartY = location.y;
    };

    private readonly handleTouchEnd = (event: EventTouch): void => {
        const location = event.getUILocation();
        const deltaX = location.x - this.touchStartX;
        const deltaY = location.y - this.touchStartY;
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD) {
            return;
        }
        const direction: SnakeDirection = Math.abs(deltaX) > Math.abs(deltaY)
            ? deltaX > 0 ? 'right' : 'left'
            : deltaY > 0 ? 'up' : 'down';
        this.actions.direction(direction);
    };
}
