import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { RestrictedThreeBodyModule } from './RestrictedThreeBodyModule';

export const restrictedThreeBodyDefinition: VisibleModuleDefinition = {
    id: 'restricted-three-body',
    title: 'Planar Three-Body Motion',
    description: 'Simulate three finite masses moving under their mutual Newtonian gravity in one inertial XY plane, with all three trajectories shown around the common barycenter.',
    category: 'physics',
    labId: 'physics',
    catalog: {
        subtitle: 'three dynamic masses · three trajectories · common barycenter',
        cover: 'restricted-three-body',
    },
    tags: ['mechanics', 'gravity', 'planar-dynamics', 'n-body', 'rk4'],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 30,
    create: () => new RestrictedThreeBodyModule(),
};
