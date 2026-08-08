import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { DoublePendulumModule } from './DoublePendulumModule';

export const doublePendulumDefinition: VisibleModuleDefinition = {
    id: 'double-pendulum',
    title: 'Double Pendulum',
    description: 'Compare nearly identical double pendulums as their trajectories separate into visible chaos.',
    category: 'physics',
    labId: 'physics',
    catalog: {
        subtitle: 'chaotic twins · RK4 energy check',
        cover: 'double-pendulum',
    },
    tags: ['mechanics', 'chaos', 'conservation', 'rk4', 'continuous-animation'],
    capabilities: ['pause', 'reset'],
    status: 'ready',
    order: 25,
    create: () => new DoublePendulumModule(),
};
