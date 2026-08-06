import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { SliderCrankModule } from './SliderCrankModule';

export const sliderCrankDefinition: VisibleModuleDefinition = {
    id: 'slider-crank',
    title: 'Mechanical Linkages',
    description: 'Explore eight practical planar mechanisms in one tabbed laboratory: slider–crank, four-bar, Geneva, Scotch yoke, Whitworth quick return, ratchet, cam follower and conjugate elliptic gears.',
    category: 'physics',
    labId: 'physics',
    catalog: {
        subtitle: '8 mechanisms · tabbed kinematics · constrained motion',
        cover: 'slider-crank',
    },
    tags: [
        'mechanics',
        'mechanism',
        'kinematics',
        'slider-crank',
        'four-bar',
        'geneva-drive',
        'scotch-yoke',
        'quick-return',
        'ratchet',
        'cam',
        'elliptic-gears',
    ],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 50,
    create: () => new SliderCrankModule(),
};
