import { Color, Graphics, Node, view } from 'cc';
import type {
    InteractiveModule,
    ModuleContext,
} from '../../contracts/InteractiveModule';
import type { ModuleRegistry } from '../../core/ModuleRegistry';
import {
    createButton,
    createLabel,
    createUiNode,
    fillNode,
    palette,
} from '../../ui/UiFactory';

export class HomeModule implements InteractiveModule {
    private root: Node | null = null;

    constructor(private readonly registry: ModuleRegistry) {}

    mount(context: ModuleContext): void {
        const size = view.getVisibleSize();
        const width = Math.max(640, size.width);
        const height = Math.max(480, size.height);

        this.root = createUiNode(context.host, 'Home', width, height);
        fillNode(this.root, width, height, palette.background);
        this.drawDecoration(this.root, width, height);

        createLabel(
            this.root,
            'COCOS LAB',
            Math.min(760, width - 48),
            76,
            52,
            palette.text,
            0,
            height / 2 - 92,
        );

        createLabel(
            this.root,
            'Games · Simulations · Mathematics · Generative · Shaders · Music · Tools',
            Math.min(900, width - 48),
            48,
            18,
            palette.muted,
            0,
            height / 2 - 144,
        );

        const definitions = this.registry.list();
        const cardWidth = Math.min(620, width - 64);
        let y = 34;

        for (const definition of definitions) {
            const card = createUiNode(
                this.root,
                `ModuleCard:${definition.id}`,
                cardWidth,
                122,
                0,
                y,
            );

            fillNode(card, cardWidth, 122, palette.surface, 18);

            createLabel(
                card,
                definition.title,
                cardWidth - 190,
                42,
                25,
                palette.text,
                -70,
                25,
            );

            createLabel(
                card,
                definition.description,
                cardWidth - 190,
                54,
                16,
                palette.muted,
                -70,
                -24,
            );

            createButton(card, {
                name: `Open:${definition.id}`,
                text: 'OPEN',
                width: 122,
                height: 54,
                x: cardWidth / 2 - 82,
                y: 0,
                onPress: () => {
                    void context.open(definition.id);
                },
            });

            y -= 148;
        }

        if (definitions.length === 0) {
            createLabel(
                this.root,
                'The application shell is ready. Register a module to make it appear here.',
                Math.min(700, width - 64),
                100,
                20,
                palette.muted,
                0,
                0,
            );
        }

        createLabel(
            this.root,
            'All visible content in this project is generated at runtime by TypeScript and shaders.',
            Math.min(860, width - 48),
            46,
            16,
            palette.muted,
            0,
            -height / 2 + 40,
        );
    }

    unmount(): void {
        this.root?.destroy();
        this.root = null;
    }

    private drawDecoration(parent: Node, width: number, height: number): void {
        const decoration = createUiNode(parent, 'Decoration', width, height);
        const graphics = decoration.addComponent(Graphics);

        graphics.strokeColor = new Color(42, 55, 78, 130);
        graphics.lineWidth = 2;

        for (let radius = 90; radius <= Math.min(width, height) * 0.62; radius += 64) {
            graphics.circle(width * 0.34, height * 0.24, radius);
        }

        graphics.stroke();
        graphics.fillColor = palette.accent;

        for (let index = 0; index < 16; index += 1) {
            const angle = (Math.PI * 2 * index) / 16;
            const radius = Math.min(width, height) * 0.34;
            graphics.circle(
                width * 0.34 + Math.cos(angle) * radius,
                height * 0.24 + Math.sin(angle) * radius,
                3 + (index % 4),
            );
        }

        graphics.fill();
    }
}
