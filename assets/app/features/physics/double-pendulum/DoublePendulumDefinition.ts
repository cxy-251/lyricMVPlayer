import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { DoublePendulumModule } from './DoublePendulumModule';

export const doublePendulumDefinition: VisibleModuleDefinition = {
    id: 'double-pendulum-lab',
    title: 'Double Pendulum',
    description: 'Explore chaotic initial conditions with a fixed-step RK4 model and energy diagnostics.',
    category: 'physics',
    labId: 'physics',
    tags: ['mechanics', 'chaos', 'conservation', 'rk4'],
    capabilities: ['pause', 'reset', 'settings'],
    status: 'ready',
    order: 10,
    create: () => new DoublePendulumModule(),
};
