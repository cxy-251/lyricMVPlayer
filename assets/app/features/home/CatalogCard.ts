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
    const radius = Math.min(16, Math.max(10, options.width * 0.035));
    const shadow = createUiNode(
        parent,
        `${options.name}:Shadow`,
        options.width,
        options.height,
        options.x,
        options.y - 5,
    );
    fillNode(shadow, options.width, options.height, new Color(30, 38, 52, 14), radius);

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

    const coverHeight = options.height * 0.68;
    const cover = drawCatalogCover(
        card,
        options.cover,
        options.width - 32,
        coverHeight,
    );
    cover.setPosition(0, options.height * 0.06, 0);

    const detail = createUiNode(
        card,
        'Details',
        options.width - 36,
        Math.max(84, options.height * 0.26),
        0,
        -options.height * 0.30,
    );
    const detailOpacity = detail.addComponent(UIOpacity);
    detailOpacity.opacity = 0;

    createLabel(
        detail,
        options.title,
        options.width - 48,
        38,
        Math.max(18, Math.min(25, options.width * 0.066)),
        palette.text,
        0,
        22,
        HorizontalTextAlignment.CENTER,
    );
    createLabel(
        detail,
        options.subtitle,
        options.width - 64,
        24,
        11,
        new Color(45, 92, 214, 255),
        0,
        -10,
        HorizontalTextAlignment.CENTER,
    );
    createLabel(
        detail,
        '→',
        48,
        28,
        21,
        new Color(45, 92, 214, 255),
        0,
        -38,
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
                scale: next ? new Vec3(1.018, 1.018, 1) : new Vec3(1, 1, 1),
            })
            .start();
        tween(cover)
            .to(0.16, {
                position: new Vec3(0, next ? options.height * 0.11 : options.height * 0.06, 0),
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
