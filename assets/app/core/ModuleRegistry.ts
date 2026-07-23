import type {
    LabDefinition,
    LabId,
    ModuleCategory,
    ModuleDefinition,
} from '../contracts/InteractiveModule';

const laboratories: Record<LabId, LabDefinition> = {
    mathematics: {
        id: 'mathematics',
        title: 'Mathematics Laboratory',
        description: 'Interactive curves, geometry and mathematical systems.',
        order: 10,
    },
    physics: {
        id: 'physics',
        title: 'Physics Laboratory',
        description: 'Dynamic simulations built from physical models and numerical methods.',
        order: 20,
    },
};

function inferLabId(category: ModuleCategory): LabId | undefined {
    if (category === 'mathematics') {
        return 'mathematics';
    }

    if (category === 'simulation') {
        return 'physics';
    }

    return undefined;
}

export class ModuleRegistry {
    private readonly definitions = new Map<string, ModuleDefinition>();

    register(definition: ModuleDefinition): void {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.id)) {
            throw new Error(`Invalid module id: ${definition.id}`);
        }

        if (this.definitions.has(definition.id)) {
            throw new Error(`Duplicate module id: ${definition.id}`);
        }

        const internal = definition.hidden || definition.category === 'system';
        const labId = definition.labId ?? inferLabId(definition.category);

        if (!internal && !labId) {
            throw new Error(`Visible module ${definition.id} must belong to a laboratory`);
        }

        if (labId && !laboratories[labId]) {
            throw new Error(`Unknown laboratory: ${labId}`);
        }

        this.definitions.set(definition.id, {
            ...definition,
            labId,
            hidden: internal,
        });
    }

    registerAll(definitions: readonly ModuleDefinition[]): void {
        for (const definition of definitions) {
            this.register(definition);
        }
    }

    get(moduleId: string): ModuleDefinition {
        const definition = this.definitions.get(moduleId);

        if (!definition) {
            throw new Error(`Unknown module: ${moduleId}`);
        }

        return definition;
    }

    getLab(labId: LabId): LabDefinition {
        const lab = laboratories[labId];

        if (this.listByLab(labId).length === 0) {
            throw new Error(`Laboratory ${labId} has no visible modules`);
        }

        return lab;
    }

    list(category?: ModuleCategory): readonly ModuleDefinition[] {
        return this.sortedVisibleDefinitions()
            .filter((definition) => !category || definition.category === category);
    }

    listByLab(labId: LabId): readonly ModuleDefinition[] {
        return this.sortedVisibleDefinitions()
            .filter((definition) => definition.labId === labId);
    }

    labs(): readonly LabDefinition[] {
        const activeLabIds = new Set(
            this.sortedVisibleDefinitions()
                .map((definition) => definition.labId)
                .filter((labId): labId is LabId => Boolean(labId)),
        );

        return [...activeLabIds]
            .map((labId) => laboratories[labId])
            .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
    }

    categories(): readonly ModuleCategory[] {
        return [...new Set(this.list().map((definition) => definition.category))];
    }

    private sortedVisibleDefinitions(): readonly ModuleDefinition[] {
        return [...this.definitions.values()]
            .filter((definition) => !definition.hidden)
            .sort((left, right) => {
                const orderDifference = (left.order ?? 1000) - (right.order ?? 1000);
                return orderDifference || left.title.localeCompare(right.title);
            });
    }
}
