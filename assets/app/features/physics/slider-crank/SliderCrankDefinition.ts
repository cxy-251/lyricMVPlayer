import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { SliderCrankModule } from './SliderCrankModule';

export const sliderCrankDefinition: VisibleModuleDefinition = {
    id: 'slider-crank',
    title: 'Slider–Crank Mechanism',
    description: 'Inspect how a rotating crank and connecting rod generate reciprocating piston motion, including exact displacement, velocity, acceleration and dead-center geometry.',
    category: 'physics',
    labId: 'physics',
    catalog: {
        subtitle: 'crank · connecting rod · piston kinematics',
        cover: 'slider-crank',
    },
    tags: ['mechanics', 'mechanism', 'kinematics', 'slider-crank', 'piston'],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 50,
    create: () => new SliderCrankModule(),
};
