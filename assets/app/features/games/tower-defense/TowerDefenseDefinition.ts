import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { TowerDefenseModule } from './TowerDefenseModule';

export const towerDefenseDefinition: VisibleModuleDefinition = {
    id: 'tower-defense',
    title: 'Tower Defense',
    description: 'A code-drawn lane defense with build slots, upgrades, mixed towers and economy-planning AI.',
    category: 'game',
    labId: 'games',
    catalog: {
        subtitle: 'wave defense and build-planning AI',
        cover: 'tower-defense',
    },
    tags: ['strategy', 'simulation', 'hybrid-control', 'procedural'],
    capabilities: ['pause', 'reset'],
    status: 'prototype',
    order: 150,
    create: () => new TowerDefenseModule(),
};
