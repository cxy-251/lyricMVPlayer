import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { DrivenCavityFlowModule } from './DrivenCavityFlowModule';

export const drivenCavityFlowDefinition: VisibleModuleDefinition = {
    id: 'driven-cavity-flow',
    title: 'Driven Cavity Flow',
    description: 'Drive a viscous fluid inside a closed square container by moving its top wall, then inspect recirculation, vorticity, Reynolds number and mass conservation.',
    category: 'physics',
    labId: 'physics',
    catalog: {
        subtitle: 'closed-container flow · viscosity · recirculating vortex',
        cover: 'driven-cavity-flow',
    },
    tags: ['fluid-dynamics', 'lattice-boltzmann', 'viscosity', 'vorticity', 'reynolds-number'],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 50,
    create: () => new DrivenCavityFlowModule(),
};
