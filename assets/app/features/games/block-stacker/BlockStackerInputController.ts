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
import type { BlockStackerPlayfieldLayout } from './BlockStackerTypes';

export interface BlockStackerInputActions {
    drop(): void;
    restart(): void;
}

export class BlockStackerInputController {
    private readonly screenPoint = new Vec3();
    private playfield: BlockStackerPlayfieldLayout | null = null;

    constructor(
        private readonly root: Node,
        private readonly actions: BlockStackerInputActions,
    ) {
        this.bind();
    }

    setPlayfield(layout: BlockStackerPlayfieldLayout): void {
        this.playfield = layout;
    }

    destroy(): void {
        this.root.off(Node.EventType.MOUSE_DOWN, this.handleMouseDown, this);
        this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        input.off(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
    }

    private bind(): void {
        this.root.on(Node.EventType.MOUSE_DOWN, this.handleMouseDown, this);
        this.root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        input.on(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
    }

    private readonly handleMouseDown = (event: EventMouse): void => {
        if (event.getButton() === EventMouse.BUTTON_RIGHT) {
            return;
        }
        const location = event.getUILocation();
        if (this.isInsidePlayfield(location.x, location.y)) {
            this.actions.drop();
        }
    };

    private readonly handleTouchEnd = (event: EventTouch): void => {
        const location = event.getUILocation();
        if (this.isInsidePlayfield(location.x, location.y)) {
            this.actions.drop();
        }
    };

    private readonly handleKeyDown = (event: EventKeyboard): void => {
        switch (event.keyCode) {
            case KeyCode.ENTER:
            case KeyCode.SPACE:
                this.actions.drop();
                break;
            case KeyCode.KEY_R:
                this.actions.restart();
                break;
            default:
                break;
        }
    };

    private isInsidePlayfield(screenX: number, screenY: number): boolean {
        const playfield = this.playfield;
        const transform = this.root.getComponent(UITransform);
        if (!playfield || !transform) {
            return false;
        }
        this.screenPoint.set(screenX, screenY, 0);
        const local = transform.convertToNodeSpaceAR(this.screenPoint);
        return local.x >= playfield.left
            && local.x <= playfield.left + playfield.width
            && local.y >= playfield.bottom
            && local.y <= playfield.bottom + playfield.height;
    }
}
