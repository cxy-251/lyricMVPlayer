import {
    Color,
    HorizontalTextAlignment,
    Node,
    Tween,
    tween,
    UIOpacity,
    Vec3,
} from 'cc';
import {
    createLabel,
    createUiNode,
    fillNode,
    palette,
    strokeNode,
} from '../../ui/UiFactory';
import {
    drawCatalogCover,
    type CatalogCoverKind,
} from './CatalogCovers';

export interface CatalogCardOptions {
    readonly name: string;
    readonly title: string;
    readonly subtitle: string;
    readonly cover: CatalogCoverKind;
    readonly width: number;
    readonly height: number;
    readonly x: number;
    readonly y: number;
    readonly onOpen: () => void;
}

export function createCatalogCard(parent: Node, options: CatalogCardOptions): Node {
    const radius = Math.min(20, Math.max(10, options.width * 0.035));
    const shadow = createUiNode(
        parent,
        `${options.name}:Shadow`,
        options.width,
        options.height,
        options.x,
        options.y - 7,
    );
    fillNode(shadow, options.width, options.height, new Color(30, 38, 52, 16), radius);

    const card = createUiNode(
        parent,
        options.name,
        options.width,
        options.height,
        options.x,
        options.y,
    );
    fillNode(card, options.width, options.height, palette.surface, radius);

    const hoverLayer = createUiNode(card, 'HoverLayer', options.width - 2, options.height - 2);
    fillNode(
        hoverLayer,
        options.width - 2,
        options.height - 2,
        new Color(225, 233, 248, 220),
        Math.max(8, radius - 1),
    );
    const hoverOpacity = hoverLayer.addComponent(UIOpacity);
    hoverOpacity.opacity = 0;
    strokeNode(card, options.width, options.height, palette.border, radius, 1);

    const coverHeight = options.height * 0.78;
    const cover = drawCatalogCover(
        card,
        options.cover,
        options.width - Math.max(26, options.width * 0.07),
        coverHeight,
    );
    cover.setPosition(0, options.height * 0.025, 0);

    const detail = createUiNode(
        card,
        'Details',
        options.width - 36,
        Math.max(98, options.height * 0.27),
        0,
        -options.height * 0.32,
    );
    const detailOpacity = detail.addComponent(UIOpacity);
    detailOpacity.opacity = 0;

    createLabel(
        detail,
        options.title,
        options.width - 48,
        44,
        Math.max(20, Math.min(31, options.width * 0.061)),
        palette.text,
        0,
        27,
        HorizontalTextAlignment.CENTER,
    );
    createLabel(
        detail,
        options.subtitle,
        options.width - 64,
        28,
        Math.max(12, Math.min(15, options.width * 0.028)),
        new Color(45, 92, 214, 255),
        0,
        -11,
        HorizontalTextAlignment.CENTER,
    );
    createLabel(
        detail,
        '→',
        54,
        32,
        24,
        new Color(45, 92, 214, 255),
        0,
        -48,
    );

    let revealed = false;

    const setRevealed = (next: boolean): void => {
        if (revealed === next) {
            return;
        }

        revealed = next;
        Tween.stopAllByTarget(card);
        Tween.stopAllByTarget(cover);
        Tween.stopAllByTarget(detailOpacity);
        Tween.stopAllByTarget(hoverOpacity);

        tween(card)
            .to(0.16, {
                scale: next ? new Vec3(1.016, 1.016, 1) : new Vec3(1, 1, 1),
            })
            .start();
        tween(cover)
            .to(0.16, {
                position: new Vec3(0, next ? options.height * 0.115 : options.height * 0.025, 0),
            })
            .start();
        tween(detailOpacity)
            .to(0.16, { opacity: next ? 255 : 0 })
            .start();
        tween(hoverOpacity)
            .to(0.16, { opacity: next ? 255 : 0 })
            .start();
    };

    card.on(Node.EventType.MOUSE_ENTER, () => {
        setRevealed(true);
    });
    card.on(Node.EventType.MOUSE_LEAVE, () => {
        setRevealed(false);
    });
    card.on(Node.EventType.TOUCH_END, () => {
        if (!revealed) {
            setRevealed(true);
            return;
        }

        options.onOpen();
    });

    return card;
}
