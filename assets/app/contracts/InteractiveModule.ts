import type { Node } from 'cc';
import type { AppState } from '../core/AppState';
import type { InputService } from '../services/InputService';
import type { StorageService } from '../services/StorageService';
import type { ViewportService } from '../services/ViewportService';

export type LabId = 'mathematics' | 'physics';

export interface LabDefinition {
    readonly id: LabId;
    readonly title: string;
    readonly description: string;
    readonly order: number;
}

export type ModuleCategory =
    | 'game'
    | 'simulation'
    | 'physics'
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

export type ModuleStatus = 'ready' | 'prototype';

export interface ModuleContext {
    readonly host: Node;
    readonly moduleId: string;
    readonly viewport: ViewportService;
    readonly storage: StorageService;
    readonly input: InputService;
    readonly appState: AppState;
    open(moduleId: string): Promise<void>;
    openLab(labId: LabId): Promise<void>;
    back(): Promise<void>;
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

interface ModuleDefinitionBase {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly tags?: readonly string[];
    readonly capabilities?: readonly ModuleCapability[];
    readonly status?: ModuleStatus;
    readonly order?: number;
    create(): InteractiveModule;
}

type VisibleModuleCategory = Exclude<ModuleCategory, 'system'>;

export type ModuleDefinition =
    | (ModuleDefinitionBase & {
        readonly category: VisibleModuleCategory;
        readonly labId: LabId;
        readonly hidden?: false;
    })
    | (ModuleDefinitionBase & {
        readonly category: ModuleCategory;
        readonly labId?: LabId;
        readonly hidden: true;
    })
    | (ModuleDefinitionBase & {
        readonly category: 'system';
        readonly labId?: never;
        readonly hidden?: true;
    });

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
