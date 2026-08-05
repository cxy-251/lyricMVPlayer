import { PREVIEW } from 'cc/env';
import type { LabManifest } from '../../contracts/InteractiveModule';
import { defineLabManifest } from '../../core/ManifestValidator';
import { doublePendulumDefinition } from './double-pendulum';
import { massSpringDamperDefinition } from './mass-spring-damper';
import { runPhysicsModelContractChecks } from './PhysicsModelContractChecks';

if (PREVIEW) {
    runPhysicsModelContractChecks();
}

export const physicsLab: LabManifest = defineLabManifest({
    definition: {
        id: 'physics',
        title: 'Physics Laboratory',
        description: 'Interactive experiments with explicit physical models, SI parameters, numerical methods, assumptions and diagnostics.',
        order: 20,
        cover: 'physics',
    },
    modules: [
        doublePendulumDefinition,
        massSpringDamperDefinition,
    ],
});
