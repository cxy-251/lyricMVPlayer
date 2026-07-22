import type {
    ModuleCategory,
    ModuleDefinition,
} from '../contracts/InteractiveModule';

export class ModuleRegistry {
    private readonly definitions = new Map<string, ModuleDefinition>();

    register(definition: ModuleDefinition): void {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.id)) {
            throw new Error(`Invalid module id: ${definition.id}`);
        }

        if (this.definitions.has(definition.id)) {
            throw new Error(`Duplicate module id: ${definition.id}`);
        }

        this.definitions.set(definition.id, definition);
    }

    get(moduleId: string): ModuleDefinition {
        const definition = this.definitions.get(moduleId);

        if (!definition) {
            throw new Error(`Unknown module: ${moduleId}`);
        }

        return definition;
    }

    list(category?: ModuleCategory): readonly ModuleDefinition[] {
        return [...this.definitions.values()]
            .filter((definition) => !definition.hidden)
            .filter((definition) => !category || definition.category === category)
            .sort((left, right) => left.title.localeCompare(right.title));
    }
}
