import type { LabManifest } from '../contracts/InteractiveModule';

export function defineLabManifest(manifest: LabManifest): LabManifest {
    const moduleIds = new Set<string>();
    const moduleOrders = new Map<number, string>();

    if (!manifest.definition.id.trim() || !manifest.definition.title.trim()) {
        throw new Error('Lab definition requires an id and title');
    }
    if (!manifest.definition.description.trim()) {
        throw new Error(`Lab ${manifest.definition.id} requires a description`);
    }
    if (!manifest.definition.cover.trim()) {
        throw new Error(`Lab ${manifest.definition.id} requires a catalog cover`);
    }
    if (!Number.isFinite(manifest.definition.order)) {
        throw new Error(`Lab ${manifest.definition.id} requires a finite order`);
    }

    for (const module of manifest.modules) {
        if (!module.id.trim() || !module.title.trim()) {
            throw new Error('Visible modules require an id and title');
        }
        if (!module.description.trim()) {
            throw new Error(`Module ${module.id} requires a description`);
        }
        if (moduleIds.has(module.id)) {
            throw new Error(`Duplicate module id: ${module.id}`);
        }
        moduleIds.add(module.id);

        if (module.labId !== manifest.definition.id) {
            throw new Error(
                `Module ${module.id} belongs to ${module.labId}, expected ${manifest.definition.id}`,
            );
        }
        const category = module.category as string;
        if (category === 'system') {
            throw new Error(`Visible module ${module.id} cannot use the system category`);
        }
        if (!module.catalog.subtitle.trim()) {
            throw new Error(`Module ${module.id} requires a catalog subtitle`);
        }
        if (module.catalog.cover !== undefined && !module.catalog.cover.trim()) {
            throw new Error(`Module ${module.id} has an empty catalog cover`);
        }
        const status = module.status as string | undefined;
        if (status !== undefined && status !== 'ready' && status !== 'prototype') {
            throw new Error(`Module ${module.id} has an invalid status`);
        }
        if (module.order !== undefined) {
            if (!Number.isFinite(module.order)) {
                throw new Error(`Module ${module.id} requires a finite order`);
            }
            const duplicate = moduleOrders.get(module.order);
            if (duplicate) {
                throw new Error(
                    `Modules ${duplicate} and ${module.id} share order ${module.order}`,
                );
            }
            moduleOrders.set(module.order, module.id);
        }

        const capabilities = new Set(module.capabilities ?? []);
        if (capabilities.size !== (module.capabilities?.length ?? 0)) {
            throw new Error(`Module ${module.id} has duplicate capabilities`);
        }
    }

    return manifest;
}
