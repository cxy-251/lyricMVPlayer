import type {
    LabDefinition,
    LabId,
    LabManifest,
    ModuleCategory,
    ModuleDefinition,
} from '../contracts/InteractiveModule';

export class ModuleRegistry {
    private readonly labDefinitions = new Map<LabId, LabDefinition>();
    private readonly definitions = new Map<string, ModuleDefinition>();

    registerLab(manifest: LabManifest): void {
        const { definition, modules } = manifest;
        if (this.labDefinitions.has(definition.id)) {
            throw new Error(`Duplicate laboratory id: ${definition.id}`);
        }
        if (modules.length === 0) {
            throw new Error(`Laboratory ${definition.id} must register at least one visible module`);
        }

        const manifestModuleIds = new Set<string>();
        for (const module of modules) {
            if (module.labId !== definition.id) {
                throw new Error(
                    `Module ${module.id} belongs to ${module.labId}, not ${definition.id}`,
                );
            }
            if (manifestModuleIds.has(module.id) || this.definitions.has(module.id)) {
                throw new Error(`Duplicate module id: ${module.id}`);
            }
            this.validateModuleId(module.id);
            manifestModuleIds.add(module.id);
        }

        this.labDefinitions.set(definition.id, { ...definition });
        for (const module of modules) {
            this.register(module);
        }
    }

    registerLabs(manifests: readonly LabManifest[]): void {
        for (const manifest of manifests) {
            this.registerLab(manifest);
        }
    }

    register(definition: ModuleDefinition): void {
        this.validateModuleId(definition.id);
        if (this.definitions.has(definition.id)) {
            throw new Error(`Duplicate module id: ${definition.id}`);
        }

        const internal = definition.hidden === true || definition.category === 'system';
        const labId = definition.labId;

        if (!internal && !labId) {
            throw new Error(`Visible module ${definition.id} must belong to a laboratory`);
        }
        if (!internal && !definition.catalog) {
            throw new Error(`Visible module ${definition.id} must define catalog metadata`);
        }
        if (labId && !this.labDefinitions.has(labId)) {
            throw new Error(`Unknown laboratory: ${labId}`);
        }

        this.definitions.set(definition.id, {
            ...definition,
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
        const lab = this.labDefinitions.get(labId);
        if (!lab) {
            throw new Error(`Unknown laboratory: ${labId}`);
        }
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
        return [...this.labDefinitions.values()]
            .filter((lab) => this.listByLab(lab.id).length > 0)
            .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
    }

    categories(): readonly ModuleCategory[] {
        return [...new Set(this.list().map((definition) => definition.category))];
    }

    private validateModuleId(moduleId: string): void {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(moduleId)) {
            throw new Error(`Invalid module id: ${moduleId}`);
        }
    }

    private sortedVisibleDefinitions(): readonly ModuleDefinition[] {
        return [...this.definitions.values()]
            .filter((definition) => !definition.hidden)
            .sort((left, right) => {
                const labDifference = (left.labId ?? '').localeCompare(right.labId ?? '');
                if (labDifference !== 0) {
                    return labDifference;
                }
                const orderDifference = (left.order ?? 1000) - (right.order ?? 1000);
                return orderDifference || left.title.localeCompare(right.title);
            });
    }
}
