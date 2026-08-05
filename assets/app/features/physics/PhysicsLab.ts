import { PREVIEW } from 'cc/env';
import type { LabManifest } from '../../contracts/InteractiveModule';
import { defineLabManifest } from '../../core/ManifestValidator';
import { doublePendulumDefinition } from './double-pendulum';
import { lorenzAttractorDefinition } from './lorenz-attractor';
import './PhysicsCatalogCovers';
import { runPhysicsModelContractChecks } from './PhysicsModelContractChecks';
import { restrictedThreeBodyDefinition } from './restricted-three-body';
import { rollingBodyRaceDefinition } from './rolling-body-race';
import './rolling-body-race/RollingBodyRaceCover';
import { runRollingBodyRaceContractChecks } from './rolling-body-race/RollingBodyRaceContractChecks';

if (PREVIEW) {
    runPhysicsModelContractChecks();
    runRollingBodyRaceContractChecks();
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
        rollingBodyRaceDefinition,
    ],
});
