import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { KineticMotionModule, type MechanicsFamilyId } from './KineticMotionModule';
import './KineticMotionCovers';

function defineMechanicsFamily(
    id: MechanicsFamilyId,
    title: string,
    description: string,
    subtitle: string,
    cover: string,
    order: number,
): VisibleModuleDefinition {
    return {
        id: `physics-${id}`,
        title,
        description,
        category: 'physics',
        labId: 'physics',
        catalog: { subtitle, cover },
        tags: ['mechanics', '2d', 'continuous-animation', 'pre-university'],
        capabilities: ['pause', 'reset'],
        status: 'ready',
        order,
        create: () => new KineticMotionModule(id),
    };
}

export const kineticTracksDefinition = defineMechanicsFamily(
    'kinetic-tracks',
    'Kinetic Tracks',
    'Continuous rails, loops, races and projectile return paths.',
    'rails · loops · projectile paths',
    'mechanics-kinetic-tracks',
    10,
);

export const oscillatorFieldsDefinition = defineMechanicsFamily(
    'oscillator-fields',
    'Oscillator Fields',
    'Pendulums, springs and driven systems that continuously exchange motion.',
    'pendulums · springs · resonance',
    'mechanics-oscillators',
    20,
);

export const collisionMachinesDefinition = defineMechanicsFamily(
    'collision-machines',
    'Collision Machines',
    'Repeating momentum exchange across cradles, lanes and moving chambers.',
    'momentum exchange · repeating impacts',
    'mechanics-collisions',
    30,
);
