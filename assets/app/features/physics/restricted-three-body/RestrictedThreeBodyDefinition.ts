import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { RestrictedThreeBodyModule } from './RestrictedThreeBodyModule';

export const restrictedThreeBodyDefinition: VisibleModuleDefinition = {
    id: 'restricted-three-body',
    title: 'Restricted Three-Body Problem',
    description: 'Launch a massless third body through the rotating gravity field of two orbiting primaries and observe capture, close flybys, collision and escape.',
    category: 'physics',
    labId: 'physics',
    catalog: {
        subtitle: 'gravity assists, Lagrange points and chaotic trajectories',
        cover: 'restricted-three-body',
    },
    tags: ['mechanics', 'gravity', 'orbital-dynamics', 'chaos', 'rk4'],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 30,
    create: () => new RestrictedThreeBodyModule(),
};
