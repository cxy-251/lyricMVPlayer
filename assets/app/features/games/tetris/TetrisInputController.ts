import {
    EventKeyboard,
    input,
    Input,
    KeyCode,
} from 'cc';
import type { TetrisViewActions } from './TetrisTypes';

export class TetrisInputController {
    private horizontal: -1 | 0 | 1 = 0;
    private softDrop = false;

    constructor(private readonly actions: TetrisViewActions) {
        input.on(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.handleKeyUp, this);
    }

    destroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.handleKeyUp, this);
        this.horizontal = 0;
        this.softDrop = false;
    }

    private readonly handleKeyDown = (event: EventKeyboard): void => {
        switch (event.keyCode) {
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.setHorizontal(-1);
                break;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.setHorizontal(1);
                break;
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                this.setSoftDrop(true);
                break;
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_X:
                this.actions.rotateClockwise();
                break;
            case KeyCode.KEY_Z:
                this.actions.rotateCounterClockwise();
                break;
            case KeyCode.SPACE:
                this.actions.hardDrop();
                break;
            case KeyCode.KEY_C:
                this.actions.hold();
                break;
            case KeyCode.KEY_R:
                this.actions.restart();
                break;
            default:
                break;
        }
    };

    private readonly handleKeyUp = (event: EventKeyboard): void => {
        switch (event.keyCode) {
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                if (this.horizontal === -1) {
                    this.setHorizontal(0);
                }
                break;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                if (this.horizontal === 1) {
                    this.setHorizontal(0);
                }
                break;
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                this.setSoftDrop(false);
                break;
            default:
                break;
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
