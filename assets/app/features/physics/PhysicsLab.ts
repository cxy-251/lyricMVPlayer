import type { LabManifest } from '../../contracts/InteractiveModule';
import { doublePendulumDefinition } from './double-pendulum';

export const physicsLab: LabManifest = {
    definition: {
        id: 'physics',
        title: 'Physics Laboratory',
        description: 'Dynamic simulations built from physical models and numerical methods.',
        order: 20,
        cover: 'physics',
    },
    modules: [
        doublePendulumDefinition,
    ],
};
