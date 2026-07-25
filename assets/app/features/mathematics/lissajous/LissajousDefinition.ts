import type { VisibleModuleDefinition } from '../../../contracts/InteractiveModule';
import { LissajousModule } from './LissajousModule';

export const lissajousDefinition: VisibleModuleDefinition = {
    id: 'lissajous-curves',
    title: 'Lissajous Curves',
    description: 'Explore frequency ratios, traced motion, phase morphing and classic Lissajous presets.',
    category: 'mathematics',
    labId: 'mathematics',
    catalog: {
        subtitle: 'frequency ratios and phase motion',
        cover: 'parametric-curve',
    },
    tags: ['lissajous', 'curves', 'graphics', 'animation'],
    capabilities: ['pause', 'reset', 'settings', 'save-state'],
    status: 'ready',
    order: 10,
    create: () => new LissajousModule(),
};
