import type { Node } from 'cc';

export type ModuleCategory =
    | 'game'
    | 'simulation'
    | 'mathematics'
    | 'generative'
    | 'shader'
    | 'music'
    | 'tool'
    | 'system';

export interface ModuleContext {
    readonly host: Node;
    readonly moduleId: string;
    open(moduleId: string): Promise<void>;
    home(): Promise<void>;
}

export interface InteractiveModule {
    mount(context: ModuleContext): void | Promise<void>;
    unmount(): void | Promise<void>;
}

export interface Pausable {
    pause(): void;
    resume(): void;
}

export interface Resettable {
    reset(): void;
}

export interface ModuleDefinition {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly category: ModuleCategory;
    readonly hidden?: boolean;
    create(): InteractiveModule;
}
