import type { EventKeyboard } from 'cc';

export interface InputRoute {
    readonly priority?: number;
    readonly onKeyDown?: (event: EventKeyboard) => boolean;
    readonly onKeyUp?: (event: EventKeyboard) => boolean;
}

interface RegisteredRoute {
    readonly id: number;
    readonly priority: number;
    readonly route: InputRoute;
}

export class InputRouter {
    private readonly routes = new Map<number, RegisteredRoute>();
    private nextId = 1;

    bind(route: InputRoute): () => void {
        const id = this.nextId;
        this.nextId += 1;
        this.routes.set(id, {
            id,
            priority: route.priority ?? 0,
            route,
        });
        return () => {
            this.routes.delete(id);
        };
    }

    dispatchKeyDown(event: EventKeyboard): boolean {
        return this.dispatch(event, 'onKeyDown');
    }

    dispatchKeyUp(event: EventKeyboard): boolean {
        return this.dispatch(event, 'onKeyUp');
    }

    clear(): void {
        this.routes.clear();
    }

    private dispatch(
        event: EventKeyboard,
        phase: 'onKeyDown' | 'onKeyUp',
    ): boolean {
        const routes = [...this.routes.values()].sort(
            (left, right) => right.priority - left.priority || right.id - left.id,
        );
        for (const registered of routes) {
            const handler = registered.route[phase];
            if (handler?.(event)) {
                return true;
            }
        }
        return false;
    }
}

export const inputRouter = new InputRouter();
