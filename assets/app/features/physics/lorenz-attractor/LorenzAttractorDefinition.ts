import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { LorenzAttractorModule } from './LorenzAttractorModule';

export const lorenzAttractorDefinition: VisibleModuleDefinition = {
    id: 'lorenz-attractor',
    title: 'Lorenz Attractor',
    description: 'Observe deterministic chaos, strange-attractor geometry and extreme sensitivity to nearby initial states.',
    category: 'physics',
    labId: 'physics',
    catalog: {
        subtitle: 'convection model and sensitive dependence',
    },
    tags: ['chaos', 'convection', 'nonlinear-dynamics', 'rk4'],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 20,
    create: () => new LorenzAttractorModule(),
};
