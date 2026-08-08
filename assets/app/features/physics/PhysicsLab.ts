import type { LabManifest } from '../../contracts/InteractiveModule';
import { defineLabManifest } from '../../core/ManifestValidator';
import {
    collisionMachinesDefinition,
    kineticTracksDefinition,
    oscillatorFieldsDefinition,
} from './kinetic-motion';

export const physicsLab: LabManifest = defineLabManifest({
    definition: {
        id: 'physics',
        title: 'Physics Laboratory',
        description: 'Continuous 2D mechanics for pre-university motion: tracks, oscillators and collisions that never go idle.',
        order: 20,
        cover: 'physics',
    },
    modules: [
        kineticTracksDefinition,
        oscillatorFieldsDefinition,
        collisionMachinesDefinition,
    ],
});
