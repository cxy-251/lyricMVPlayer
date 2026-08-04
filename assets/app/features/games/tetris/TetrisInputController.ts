import {
    EventKeyboard,
    KeyCode,
} from 'cc';
import { inputRouter } from '../../../services/InputRouter';
import type { TetrisViewActions } from './TetrisTypes';

export class TetrisInputController {
    private readonly unbindKeyboard: () => void;
    private horizontal: -1 | 0 | 1 = 0;
    private softDrop = false;

    constructor(private readonly actions: TetrisViewActions) {
        this.unbindKeyboard = inputRouter.bind({
            priority: 100,
            onKeyDown: this.handleKeyDown,
            onKeyUp: this.handleKeyUp,
        });
    }

    destroy(): void {
        this.unbindKeyboard();
        this.horizontal = 0;
        this.softDrop = false;
    }

    private readonly handleKeyDown = (event: EventKeyboard): boolean => {
        switch (event.keyCode) {
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.setHorizontal(-1);
                return true;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.setHorizontal(1);
                return true;
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                this.setSoftDrop(true);
                return true;
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_X:
                this.actions.rotateClockwise();
                return true;
            case KeyCode.KEY_Z:
                this.actions.rotateCounterClockwise();
                return true;
            case KeyCode.SPACE:
                this.actions.hardDrop();
                return true;
            case KeyCode.KEY_C:
                this.actions.hold();
                return true;
            case KeyCode.KEY_R:
                this.actions.restart();
                return true;
            default:
                return false;
        }
    };

    private readonly handleKeyUp = (event: EventKeyboard): boolean => {
        switch (event.keyCode) {
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                if (this.horizontal === -1) {
                    this.setHorizontal(0);
                }
                return true;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                if (this.horizontal === 1) {
                    this.setHorizontal(0);
                }
                return true;
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                this.setSoftDrop(false);
                return true;
            default:
                return false;
        }
    };

    private setHorizontal(direction: -1 | 0 | 1): void {
        if (direction === this.horizontal) {
            return;
        }
        this.horizontal = direction;
        this.actions.setHorizontal(direction);
    }

    private setSoftDrop(active: boolean): void {
        if (active === this.softDrop) {
            return;
        }
        this.softDrop = active;
        this.actions.setSoftDrop(active);
    }
}
