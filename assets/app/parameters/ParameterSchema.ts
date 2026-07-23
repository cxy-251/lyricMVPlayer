export type ParameterValue = number | boolean | string;
export type ParameterValues = Record<string, ParameterValue>;

interface ParameterBase {
    readonly key: string;
    readonly label: string;
    readonly description?: string;
}

export interface NumberParameter extends ParameterBase {
    readonly kind: 'number';
    readonly defaultValue: number;
    readonly minimum: number;
    readonly maximum: number;
    readonly step: number;
    readonly decimals?: number;
    readonly unit?: string;
}

export interface ToggleParameter extends ParameterBase {
    readonly kind: 'toggle';
    readonly defaultValue: boolean;
    readonly onLabel?: string;
    readonly offLabel?: string;
}

export interface SelectOption {
    readonly value: string;
    readonly label: string;
}

export interface SelectParameter extends ParameterBase {
    readonly kind: 'select';
    readonly defaultValue: string;
    readonly options: readonly SelectOption[];
}

export type ParameterDefinition =
    | NumberParameter
    | ToggleParameter
    | SelectParameter;

export type ParameterSchema = readonly ParameterDefinition[];

export function createDefaultValues(schema: ParameterSchema): ParameterValues {
    const values: ParameterValues = {};

    for (const definition of schema) {
        values[definition.key] = definition.defaultValue;
    }

    return values;
}

export function normalizeParameterValues(
    schema: ParameterSchema,
    source: unknown,
): ParameterValues {
    const candidate = typeof source === 'object' && source !== null
        ? source as Record<string, unknown>
        : {};
    const values: ParameterValues = {};

    for (const definition of schema) {
        values[definition.key] = normalizeParameterValue(
            definition,
            candidate[definition.key],
        );
    }

    return values;
}

export function normalizeParameterValue(
    definition: ParameterDefinition,
    value: unknown,
): ParameterValue {
    if (definition.kind === 'toggle') {
        return typeof value === 'boolean' ? value : definition.defaultValue;
    }

    if (definition.kind === 'select') {
        if (
            typeof value === 'string'
            && definition.options.some((option) => option.value === value)
        ) {
            return value;
        }

        return definition.defaultValue;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return definition.defaultValue;
    }

    const clamped = Math.max(definition.minimum, Math.min(definition.maximum, value));
    const maximumStepIndex = Math.max(
        0,
        Math.floor((definition.maximum - definition.minimum) / definition.step + 1e-9),
    );
    const requestedStepIndex = Math.round(
        (clamped - definition.minimum) / definition.step,
    );
    const stepIndex = Math.max(0, Math.min(maximumStepIndex, requestedStepIndex));
    const snapped = definition.minimum + stepIndex * definition.step;
    const bounded = Math.max(definition.minimum, Math.min(definition.maximum, snapped));
    return Number(bounded.toFixed(definition.decimals ?? 6));
}
