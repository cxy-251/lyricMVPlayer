import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { RollingBodyRaceModule } from './RollingBodyRaceModule';

export const rollingBodyRaceDefinition: VisibleModuleDefinition = {
    id: 'rolling-body-race',
    title: 'Rolling Body Race',
    description: 'Compare four equal-mass, equal-radius rigid bodies rolling down the same incline while their different moments of inertia divide energy between translation and rotation.',
    category: 'physics',
    labId: 'physics',
    catalog: {
        subtitle: 'same slope · different inertia · translation versus rotation',
        cover: 'rolling-body-race',
    },
    tags: ['mechanics', 'rigid-body', 'rotation', 'energy', 'kinematics'],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 40,
    create: () => new RollingBodyRaceModule(),
};
