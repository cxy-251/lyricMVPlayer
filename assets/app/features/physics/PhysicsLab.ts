import { PREVIEW } from 'cc/env';
import type { LabManifest } from '../../contracts/InteractiveModule';
import { defineLabManifest } from '../../core/ManifestValidator';
import { chaoticBilliardsDefinition } from './chaotic-billiards';
import './chaotic-billiards/ChaoticBilliardsCover';
import { runChaoticBilliardsContractChecks } from './chaotic-billiards/ChaoticBilliardsContractChecks';
import { doublePendulumDefinition } from './double-pendulum';
import { lorenzAttractorDefinition } from './lorenz-attractor';
import './PhysicsCatalogCovers';
import { runPhysicsModelContractChecks } from './PhysicsModelContractChecks';
import { restrictedThreeBodyDefinition } from './restricted-three-body';

if (PREVIEW) {
    runPhysicsModelContractChecks();
    runChaoticBilliardsContractChecks();
}

export const physicsLab: LabManifest = defineLabManifest({
    definition: {
        id: 'physics',
        title: 'Physics Laboratory',
        description: 'Interactive experiments with explicit physical models, parameters, numerical methods, assumptions and diagnostics.',
        order: 20,
        cover: 'physics',
    },
    modules: [
        doublePendulumDefinition,
        lorenzAttractorDefinition,
        restrictedThreeBodyDefinition,
        chaoticBilliardsDefinition,
    ],
});
