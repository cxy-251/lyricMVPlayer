import type { Node } from 'cc';
import type { AppState } from '../core/AppState';
import type { InputService } from '../services/InputService';
import type { StorageService } from '../services/StorageService';
import type { ViewportService } from '../services/ViewportService';

export type ModuleCategory =
    | 'game'
    | 'simulation'
    | 'mathematics'
    | 'generative'
    | 'shader'
    | 'music'
    | 'tool'
    | 'system';

export type ModuleCapability =
    | 'pause'
    | 'reset'
    | 'settings'
    | 'fullscreen'
    | 'save-state';

export type ModuleStatus = 'ready' | 'prototype' | 'planned';

export interface ModuleContext {
    readonly host: Node;
    readonly moduleId: string;
    readonly viewport: ViewportService;
    readonly storage: StorageService;
    readonly input: InputService;
    readonly appState: AppState;
    open(moduleId: string): Promise<void>;
    home(): Promise<void>;
}

export interface InteractiveModule {
    mount(context: ModuleContext): void | Promise<void>;
    unmount(): void | Promise<void>;
}

export interface Updatable {
    update(dt: number): void;
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
    readonly tags?: readonly string[];
    readonly capabilities?: readonly ModuleCapability[];
    readonly status?: ModuleStatus;
    readonly order?: number;
    readonly hidden?: boolean;
    create(): InteractiveModule;
}

export function isUpdatable(module: InteractiveModule): module is InteractiveModule & Updatable {
    return typeof (module as Partial<Updatable>).update === 'function';
}

export function isPausable(module: InteractiveModule): module is InteractiveModule & Pausable {
    const candidate = module as Partial<Pausable>;
    return typeof candidate.pause === 'function' && typeof candidate.resume === 'function';
}

export function isResettable(module: InteractiveModule): module is InteractiveModule & Resettable {
    return typeof (module as Partial<Resettable>).reset === 'function';
}
