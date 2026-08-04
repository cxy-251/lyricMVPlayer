import {
    EventKeyboard,
    EventTouch,
    KeyCode,
    Node,
} from 'cc';
import { inputRouter } from '../../../services/InputRouter';
import type {
    Game2048Direction,
    Game2048ViewActions,
} from './Game2048Types';

const SWIPE_THRESHOLD = 24;

export class Game2048InputController {
    private readonly unbindKeyboard: () => void;
    private touchStartX = 0;
    private touchStartY = 0;

    constructor(
        private readonly root: Node,
        private readonly actions: Game2048ViewActions,
    ) {
        this.unbindKeyboard = inputRouter.bind({
            priority: 100,
            onKeyDown: this.handleKeyDown,
        });
        root.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    }

    destroy(): void {
        this.unbindKeyboard();
        this.root.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
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
            case KeyCode.KEY_R:
                this.actions.restart();
                return true;
            default:
                return false;
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
        const direction: Game2048Direction = Math.abs(deltaX) > Math.abs(deltaY)
            ? deltaX > 0 ? 'right' : 'left'
            : deltaY > 0 ? 'up' : 'down';
        this.actions.move(direction);
    };
}
