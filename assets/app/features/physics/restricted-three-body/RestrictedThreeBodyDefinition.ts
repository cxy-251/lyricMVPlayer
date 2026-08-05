import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { RestrictedThreeBodyModule } from './RestrictedThreeBodyModule';

export const restrictedThreeBodyDefinition: VisibleModuleDefinition = {
    id: 'restricted-three-body',
    title: 'Planar Restricted Three-Body',
    description: 'Follow a massless third body constrained to the z = 0 plane while two primaries move on prescribed circular orbits around their barycenter.',
    category: 'physics',
    labId: 'physics',
    catalog: {
        subtitle: 'circular primaries · massless third body · z = 0',
        cover: 'restricted-three-body',
    },
    tags: ['mechanics', 'gravity', 'planar-dynamics', 'orbital-dynamics', 'rk4'],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 30,
    create: () => new RestrictedThreeBodyModule(),
};
