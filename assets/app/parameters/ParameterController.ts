import type { StorageService } from '../services/StorageService';
import {
    createDefaultValues,
    normalizeParameterValue,
    normalizeParameterValues,
} from './ParameterSchema';
import type {
    NumberParameter,
    ParameterDefinition,
    ParameterSchema,
    ParameterValues,
    SelectParameter,
} from './ParameterSchema';

const PERSIST_DELAY_MS = 160;

export class ParameterController {
    private values: ParameterValues;
    private persistTimer: ReturnType<typeof setTimeout> | null = null;
    private persistPending = false;

    constructor(
        private readonly storage: StorageService,
        private readonly storageKey: string,
        private readonly schema: ParameterSchema,
    ) {
        this.values = normalizeParameterValues(
            schema,
            storage.get<unknown>(storageKey, null),
        );
    }

    get snapshot(): Readonly<ParameterValues> {
        return { ...this.values };
    }

    getNumber(key: string): number {
        const value = this.values[key];

        if (typeof value !== 'number') {
            throw new Error(`Parameter ${key} is not numeric`);
        }

        return value;
    }

    getBoolean(key: string): boolean {
        const value = this.values[key];

        if (typeof value !== 'boolean') {
            throw new Error(`Parameter ${key} is not boolean`);
        }

        return value;
    }

    getString(key: string): string {
        const value = this.values[key];

        if (typeof value !== 'string') {
            throw new Error(`Parameter ${key} is not a string`);
        }

        return value;
    }

    set(key: string, value: unknown): boolean {
        const definition = this.find(key);
        const normalized = normalizeParameterValue(definition, value);

        if (this.values[key] === normalized) {
            return false;
        }

        this.values[key] = normalized;
        this.schedulePersist();
        return true;
    }

    adjust(key: string, direction: -1 | 1): boolean {
        const definition = this.find(key);

        if (definition.kind !== 'number') {
            throw new Error(`Parameter ${key} does not support numeric adjustment`);
        }

        return this.set(key, this.getNumber(key) + definition.step * direction);
    }

    toggle(key: string): boolean {
        const definition = this.find(key);

        if (definition.kind !== 'toggle') {
            throw new Error(`Parameter ${key} is not a toggle`);
        }

        return this.set(key, !this.getBoolean(key));
    }

    cycle(key: string, direction: -1 | 1): boolean {
        const definition = this.find(key);

        if (definition.kind !== 'select') {
            throw new Error(`Parameter ${key} is not a select control`);
        }

        const current = this.getString(key);
        const currentIndex = Math.max(
            0,
            definition.options.findIndex((option) => option.value === current),
        );
        const nextIndex = (
            currentIndex + direction + definition.options.length
        ) % definition.options.length;
        return this.set(definition.options[nextIndex].value, definition.options[nextIndex].value);
    }

    reset(): void {
        this.values = createDefaultValues(this.schema);
        this.schedulePersist();
    }

    flush(): void {
        if (this.persistTimer !== null) {
            clearTimeout(this.persistTimer);
            this.persistTimer = null;
        }

        if (!this.persistPending) {
            return;
        }

        this.persistPending = false;
        this.storage.set(this.storageKey, this.values);
    }

    dispose(): void {
        this.flush();
    }

    format(definition: ParameterDefinition): string {
        const value = this.values[definition.key];

        if (definition.kind === 'toggle') {
            return value
                ? definition.onLabel ?? 'ON'
                : definition.offLabel ?? 'OFF';
        }

        if (definition.kind === 'select') {
            return this.formatSelect(definition, String(value));
        }

        return this.formatNumber(definition, Number(value));
    }

    private find(key: string): ParameterDefinition {
        const definition = this.schema.find((candidate) => candidate.key === key);

        if (!definition) {
            throw new Error(`Unknown parameter: ${key}`);
        }

        return definition;
    }

    private formatNumber(definition: NumberParameter, value: number): string {
        const formatted = definition.formatValue
            ? definition.formatValue(value)
            : value.toFixed(definition.decimals ?? this.inferDecimals(definition.step));
        return `${formatted}${definition.unit ?? ''}`;
    }

    private formatSelect(definition: SelectParameter, value: string): string {
        return definition.options.find((option) => option.value === value)?.label ?? value;
    }

    private inferDecimals(step: number): number {
        const text = step.toString();
        const decimal = text.indexOf('.');
        return decimal < 0 ? 0 : Math.min(4, text.length - decimal - 1);
    }

    private schedulePersist(): void {
        this.persistPending = true;

        if (this.persistTimer !== null) {
            clearTimeout(this.persistTimer);
        }

        this.persistTimer = setTimeout(() => {
            this.persistTimer = null;
            this.flush();
        }, PERSIST_DELAY_MS);
    }
}
