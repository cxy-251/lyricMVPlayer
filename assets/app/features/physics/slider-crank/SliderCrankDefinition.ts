import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { SliderCrankModule } from './SliderCrankModule';

export const sliderCrankDefinition: VisibleModuleDefinition = {
    id: 'slider-crank',
    title: 'Mechanical Linkages',
    description: 'Compare three practical planar mechanisms: slider–crank reciprocation, four-bar crank–rocker motion, and Geneva intermittent indexing, with exact constraints and synchronized output kinematics.',
    category: 'physics',
    labId: 'physics',
    catalog: {
        subtitle: 'slider–crank · four-bar linkage · Geneva indexing',
        cover: 'slider-crank',
    },
    tags: [
        'mechanics',
        'mechanism',
        'kinematics',
        'slider-crank',
        'four-bar',
        'geneva-drive',
    ],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 50,
    create: () => new SliderCrankModule(),
};
