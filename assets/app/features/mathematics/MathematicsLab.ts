import type { LabManifest } from '../../contracts/InteractiveModule';
import { defineLabManifest } from '../../core/ManifestValidator';
import {
    circleMotionDefinition,
    motionCurvesDefinition,
    triangleMotionDefinition,
} from './geometry-motion';

export const mathematicsLab: LabManifest = defineLabManifest({
    definition: {
        id: 'mathematics',
        title: 'Mathematics Laboratory',
        description: 'Continuous 2D plane geometry: constructions move while their hidden relations remain visible.',
        order: 10,
        cover: 'mathematics',
    },
    modules: [
        triangleMotionDefinition,
        circleMotionDefinition,
        motionCurvesDefinition,
    ],
});
