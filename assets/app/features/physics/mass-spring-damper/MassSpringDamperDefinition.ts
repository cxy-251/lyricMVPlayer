import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { MassSpringDamperModule } from './MassSpringDamperModule';

export const massSpringDamperDefinition: VisibleModuleDefinition = {
    id: 'mass-spring-damper',
    title: 'Mass–Spring–Damper',
    description: 'Inspect free, damped and harmonically forced 1D vibration with SI parameters and energy-balance diagnostics.',
    category: 'physics',
    labId: 'physics',
    catalog: {
        subtitle: 'linear vibration, damping and resonance',
    },
    tags: ['mechanics', 'vibration', 'damping', 'resonance', 'rk4'],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 20,
    create: () => new MassSpringDamperModule(),
};
