import {
    EventMouse,
    EventTouch,
    Node,
    UITransform,
    Vec3,
} from 'cc';
import type { CursorSpaceBounds } from '../CursorSpaceModel';

export interface CursorSpaceViewActions {
    boundsChanged(bounds: CursorSpaceBounds): void;
    humanTargetChanged(x: number, y: number): void;
    pointerReleased(): void;
}

export class CursorSpaceInputController {
    private readonly screenPoint = new Vec3();

    constructor(
        private readonly root: Node,
        private readonly actions: CursorSpaceViewActions,
    ) {
        this.bind();
    }

    destroy(): void {
        this.root.off(Node.EventType.MOUSE_MOVE, this.handleMouseMove, this);
        this.root.off(Node.EventType.MOUSE_LEAVE, this.handlePointerRelease, this);
        this.root.off(Node.EventType.TOUCH_START, this.handleTouch, this);
        this.root.off(Node.EventType.TOUCH_MOVE, this.handleTouch, this);
        this.root.off(Node.EventType.TOUCH_END, this.handlePointerRelease, this);
        this.root.off(Node.EventType.TOUCH_CANCEL, this.handlePointerRelease, this);
    }

    private bind(): void {
        this.root.on(Node.EventType.MOUSE_MOVE, this.handleMouseMove, this);
        this.root.on(Node.EventType.MOUSE_LEAVE, this.handlePointerRelease, this);
        this.root.on(Node.EventType.TOUCH_START, this.handleTouch, this);
        this.root.on(Node.EventType.TOUCH_MOVE, this.handleTouch, this);
        this.root.on(Node.EventType.TOUCH_END, this.handlePointerRelease, this);
        this.root.on(Node.EventType.TOUCH_CANCEL, this.handlePointerRelease, this);
    }

    private readonly handleMouseMove = (event: EventMouse): void => {
        const location = event.getUILocation();
        this.forwardScreenTarget(location.x, location.y);
    };

    private readonly handleTouch = (event: EventTouch): void => {
        const location = event.getUILocation();
        this.forwardScreenTarget(location.x, location.y);
    };

    private readonly handlePointerRelease = (): void => {
        this.actions.pointerReleased();
    };

    private forwardScreenTarget(screenX: number, screenY: number): void {
        const transform = this.root.getComponent(UITransform);
        if (!transform) {
            return;
        }
        this.screenPoint.set(screenX, screenY, 0);
        const localPoint = transform.convertToNodeSpaceAR(this.screenPoint);
        this.actions.humanTargetChanged(localPoint.x, localPoint.y);
    }
}
