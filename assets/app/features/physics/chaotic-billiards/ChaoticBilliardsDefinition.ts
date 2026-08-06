import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { ChaoticBilliardsModule } from './ChaoticBilliardsModule';

export const chaoticBilliardsDefinition: VisibleModuleDefinition = {
    id: 'chaotic-billiards',
    title: 'Chaotic Billiards',
    description: 'Compare nearby point-particle trajectories under exact mirror-like reflections in a regular circular table and a chaotic stadium table.',
    category: 'physics',
    labId: 'physics',
    catalog: {
        subtitle: 'specular collisions · nearby trajectories · stadium chaos',
        cover: 'chaotic-billiards',
    },
    tags: ['mechanics', 'chaos', 'billiards', 'kinematics', 'sensitive-dependence'],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 40,
    create: () => new ChaoticBilliardsModule(),
};
