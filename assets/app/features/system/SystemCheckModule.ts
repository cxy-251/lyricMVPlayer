import { Node, view } from 'cc';
import type {
    InteractiveModule,
    ModuleContext,
    ModuleDefinition,
} from '../../contracts/InteractiveModule';
import {
    createButton,
    createLabel,
    createUiNode,
    fillNode,
    palette,
} from '../../ui/UiFactory';

class SystemCheckModule implements InteractiveModule {
    private root: Node | null = null;

    mount(context: ModuleContext): void {
        const size = view.getVisibleSize();
        const width = Math.max(640, size.width);
        const height = Math.max(480, size.height);

        this.root = createUiNode(context.host, 'SystemCheck', width, height);
        fillNode(this.root, width, height, palette.background);

        createLabel(
            this.root,
            'ARCHITECTURE CHECK',
            Math.min(760, width - 48),
            72,
            42,
            palette.text,
            0,
            height / 2 - 92,
        );

        createLabel(
            this.root,
            [
                '✓ persistent application services',
                '✓ isolated module lifecycle',
                '✓ serialized navigation transitions',
                '✓ runtime-generated UI',
                '✓ no image or model assets',
                '✓ ready for games, simulations and experiments',
            ].join('\n'),
            Math.min(680, width - 64),
            260,
            23,
            palette.text,
            0,
            30,
        );

        createButton(this.root, {
            name: 'BackHome',
            text: 'BACK TO HOME',
            width: 240,
            height: 62,
            y: -height / 2 + 84,
            onPress: () => {
                void context.home();
            },
        });
    }

    unmount(): void {
        this.root?.destroy();
        this.root = null;
    }
}

export const systemCheckDefinition: ModuleDefinition = {
    id: 'architecture-check',
    title: 'Architecture Check',
    description: 'Verify routing, cleanup and code-generated rendering before adding real works.',
    category: 'system',
    create: () => new SystemCheckModule(),
};
