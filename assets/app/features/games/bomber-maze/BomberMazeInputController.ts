import {
    EventKeyboard,
    EventTouch,
    input,
    Input,
    KeyCode,
    Node,
} from 'cc';
import type {
    BomberMazeDirection,
    BomberMazeViewActions,
} from './BomberMazeTypes';

const SWIPE_THRESHOLD = 24;

export class BomberMazeInputController {
    private touchStartX = 0;
    private touchStartY = 0;

    constructor(
        private readonly root: Node,
        private readonly actions: BomberMazeViewActions,
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
        const direction = this.directionForKey(event.keyCode);
        if (direction) {
            this.actions.move(direction);
            return;
        }
        if (
            event.keyCode === KeyCode.KEY_F
            || event.keyCode === KeyCode.KEY_B
            || event.keyCode === KeyCode.ENTER
        ) {
            this.actions.placeBomb();
        }
    };

    private readonly handleTouchStart = (event: EventTouch): void => {
        const point = event.getUILocation();
        this.touchStartX = point.x;
        this.touchStartY = point.y;
    };

    private readonly handleTouchEnd = (event: EventTouch): void => {
        const point = event.getUILocation();
        const dx = point.x - this.touchStartX;
        const dy = point.y - this.touchStartY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) {
            return;
        }
        this.actions.move(
            Math.abs(dx) > Math.abs(dy)
                ? dx > 0 ? 'right' : 'left'
                : dy > 0 ? 'up' : 'down',
        );
    };

    private directionForKey(keyCode: KeyCode): BomberMazeDirection | null {
        switch (keyCode) {
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_W:
                return 'up';
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                return 'down';
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                return 'left';
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                return 'right';
            default:
                return null;
        }
    }
}
