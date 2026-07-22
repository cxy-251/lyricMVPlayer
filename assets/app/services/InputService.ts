import { EventKeyboard, input, Input, KeyCode } from 'cc';

export type AppAction = 'back' | 'toggle-pause' | 'reset';
type ActionHandler = () => void;

export class InputService {
    private readonly handlers = new Map<AppAction, Set<ActionHandler>>();
    private started = false;

    start(): void {
        if (this.started) {
            return;
        }

        this.started = true;
        input.on(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
    }

    stop(): void {
        if (!this.started) {
            return;
        }

        input.off(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
        this.handlers.clear();
        this.started = false;
    }

    bind(action: AppAction, handler: ActionHandler): () => void {
        let actionHandlers = this.handlers.get(action);

        if (!actionHandlers) {
            actionHandlers = new Set<ActionHandler>();
            this.handlers.set(action, actionHandlers);
        }

        actionHandlers.add(handler);

        return () => {
            actionHandlers?.delete(handler);
        };
    }

    emit(action: AppAction): void {
        const actionHandlers = this.handlers.get(action);

        if (!actionHandlers) {
            return;
        }

        for (const handler of [...actionHandlers]) {
            handler();
        }
    }

    private readonly handleKeyDown = (event: EventKeyboard): void => {
        switch (event.keyCode) {
            case KeyCode.ESCAPE:
                this.emit('back');
                break;
            case KeyCode.SPACE:
                this.emit('toggle-pause');
                break;
            case KeyCode.KEY_R:
                this.emit('reset');
                break;
            default:
                break;
        }
    };
}
