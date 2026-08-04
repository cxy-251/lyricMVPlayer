import {
    EventKeyboard,
    EventMouse,
    EventTouch,
    KeyCode,
    Node,
    UITransform,
    Vec3,
} from 'cc';
import { inputRouter } from '../../../services/InputRouter';
import type { BrickBreakerPlayfieldLayout } from './BrickBreakerTypes';

export interface BrickBreakerInputActions {
    humanAxisChanged(axis: number): void;
    humanTargetChanged(normalizedX: number): void;
    humanPointerReleased(): void;
    launch(): void;
    restart(): void;
}

export class BrickBreakerInputController {
    private readonly screenPoint = new Vec3();
    private readonly unbindKeyboard: () => void;
    private playfield: BrickBreakerPlayfieldLayout | null = null;
    private leftDown = false;
    private rightDown = false;

    constructor(
        private readonly root: Node,
        private readonly actions: BrickBreakerInputActions,
    ) {
        this.unbindKeyboard = inputRouter.bind({
            priority: 100,
            onKeyDown: this.handleKeyDown,
            onKeyUp: this.handleKeyUp,
        });
        this.bindPointer();
    }

    setPlayfield(layout: BrickBreakerPlayfieldLayout): void {
        this.playfield = layout;
    }

    destroy(): void {
        this.root.off(Node.EventType.MOUSE_MOVE, this.handleMouseMove, this);
        this.root.off(Node.EventType.MOUSE_DOWN, this.handleMouseDown, this);
        this.root.off(Node.EventType.MOUSE_LEAVE, this.handlePointerRelease, this);
        this.root.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.root.off(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this);
        this.root.off(Node.EventType.TOUCH_END, this.handlePointerRelease, this);
        this.root.off(Node.EventType.TOUCH_CANCEL, this.handlePointerRelease, this);
        this.unbindKeyboard();
    }

    private bindPointer(): void {
        this.root.on(Node.EventType.MOUSE_MOVE, this.handleMouseMove, this);
        this.root.on(Node.EventType.MOUSE_DOWN, this.handleMouseDown, this);
        this.root.on(Node.EventType.MOUSE_LEAVE, this.handlePointerRelease, this);
        this.root.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.root.on(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this);
        this.root.on(Node.EventType.TOUCH_END, this.handlePointerRelease, this);
        this.root.on(Node.EventType.TOUCH_CANCEL, this.handlePointerRelease, this);
    }

    private readonly handleMouseMove = (event: EventMouse): void => {
        const location = event.getUILocation();
        const normalized = this.screenToNormalizedX(location.x, location.y);
        if (normalized !== null) {
            this.actions.humanTargetChanged(normalized);
        }
    };

    private readonly handleMouseDown = (event: EventMouse): void => {
        if (event.getButton() === EventMouse.BUTTON_RIGHT) {
            return;
        }
        const location = event.getUILocation();
        const normalized = this.screenToNormalizedX(location.x, location.y);
        if (normalized !== null) {
            this.actions.humanTargetChanged(normalized);
            this.actions.launch();
        }
    };

    private readonly handleTouchStart = (event: EventTouch): void => {
        const normalized = this.normalizedFromTouch(event);
        if (normalized !== null) {
            this.actions.humanTargetChanged(normalized);
            this.actions.launch();
        }
    };

    private readonly handleTouchMove = (event: EventTouch): void => {
        const normalized = this.normalizedFromTouch(event);
        if (normalized !== null) {
            this.actions.humanTargetChanged(normalized);
        }
    };

    private readonly handlePointerRelease = (): void => {
        this.actions.humanPointerReleased();
    };

    private readonly handleKeyDown = (event: EventKeyboard): boolean => {
        switch (event.keyCode) {
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.leftDown = true;
                this.forwardKeyboardAxis();
                return true;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.rightDown = true;
                this.forwardKeyboardAxis();
                return true;
            case KeyCode.ENTER:
            case KeyCode.SPACE:
                this.actions.launch();
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
                this.leftDown = false;
                this.forwardKeyboardAxis();
                return true;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.rightDown = false;
                this.forwardKeyboardAxis();
                return true;
            default:
                return false;
        }
    };

    private normalizedFromTouch(event: EventTouch): number | null {
        const location = event.getUILocation();
        return this.screenToNormalizedX(location.x, location.y);
    }

    private forwardKeyboardAxis(): void {
        const axis = (this.rightDown ? 1 : 0) - (this.leftDown ? 1 : 0);
        this.actions.humanAxisChanged(axis);
    }

    private screenToNormalizedX(
        screenX: number,
        screenY: number,
    ): number | null {
        const playfield = this.playfield;
        const transform = this.root.getComponent(UITransform);
        if (!playfield || !transform) {
            return null;
        }
        this.screenPoint.set(screenX, screenY, 0);
        const local = transform.convertToNodeSpaceAR(this.screenPoint);
        if (
            local.x < playfield.left
            || local.x > playfield.left + playfield.width
            || local.y < playfield.bottom
            || local.y > playfield.bottom + playfield.height
        ) {
            return null;
        }
        return Math.max(
            -1,
            Math.min(
                1,
                ((local.x - playfield.left) / Math.max(1, playfield.width)) * 2 - 1,
            ),
        );
    }
}
