import type { LabManifest } from '../../contracts/InteractiveModule';
import { lissajousDefinition } from './lissajous';

export const mathematicsLab: LabManifest = {
    definition: {
        id: 'mathematics',
        title: 'Mathematics Laboratory',
        description: 'Interactive curves, geometry and mathematical systems.',
        order: 10,
        cover: 'mathematics',
    },
    modules: [
        lissajousDefinition,
    ],
};
