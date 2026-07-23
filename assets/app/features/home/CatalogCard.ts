import {
    Button,
    HorizontalTextAlignment,
    Node,
    Tween,
    tween,
    UIOpacity,
    Vec3,
} from 'cc';
import {
    createLabel,
    createNativeIcon,
    createUiNode,
    fillNode,
    nativeTheme,
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
    const radius = Math.min(22, Math.max(14, options.width * 0.038));
    const hit = createUiNode(
        parent,
        options.name,
        options.width,
        options.height,
        options.x,
        options.y,
    );
    const card = createUiNode(hit, '__CardVisual', options.width, options.height);
    fillNode(card, options.width, options.height, nativeTheme.card, radius);
    strokeNode(card, options.width, options.height, nativeTheme.border, radius, 1);

    const hoverLayer = createUiNode(card, 'HoverLayer', options.width - 2, options.height - 2);
    fillNode(
        hoverLayer,
        options.width - 2,
        options.height - 2,
        nativeTheme.cardHover,
        Math.max(12, radius - 1),
    );
    const hoverOpacity = hoverLayer.addComponent(UIOpacity);
    hoverOpacity.opacity = 0;

    const coverHeight = options.height * 0.8;
    const cover = drawCatalogCover(
        card,
        options.cover,
        options.width - Math.max(28, options.width * 0.08),
        coverHeight,
    );
    cover.setPosition(0, options.height * 0.02, 0);

    const detail = createUiNode(
        card,
        'Details',
        options.width - 40,
        Math.max(96, options.height * 0.26),
        0,
        -options.height * 0.32,
    );
    const detailOpacity = detail.addComponent(UIOpacity);
    detailOpacity.opacity = 0;

    createLabel(
        detail,
        options.title,
        options.width - 52,
        42,
        Math.max(19, Math.min(28, options.width * 0.056)),
        nativeTheme.ink,
        0,
        26,
        HorizontalTextAlignment.CENTER,
    );
    createLabel(
        detail,
        options.subtitle,
        options.width - 68,
        26,
        Math.max(11, Math.min(14, options.width * 0.027)),
        nativeTheme.muted,
        0,
        -10,
        HorizontalTextAlignment.CENTER,
    );
    createNativeIcon(detail, 'chevron-right', 18, nativeTheme.accent, 0, -45);

    const button = hit.addComponent(Button);
    button.target = card;
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.985;
    button.duration = 0.08;

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
                scale: next ? new Vec3(1.008, 1.008, 1) : new Vec3(1, 1, 1),
            })
            .start();
        tween(cover)
            .to(0.16, {
                position: new Vec3(0, next ? options.height * 0.105 : options.height * 0.02, 0),
            })
            .start();
        tween(detailOpacity)
            .to(0.16, { opacity: next ? 255 : 0 })
            .start();
        tween(hoverOpacity)
            .to(0.16, { opacity: next ? 255 : 0 })
            .start();
    };

    hit.on(Node.EventType.MOUSE_ENTER, () => {
        setRevealed(true);
        setPointerCursor(true);
    });
    hit.on(Node.EventType.MOUSE_LEAVE, () => {
        setRevealed(false);
        setPointerCursor(false);
    });
    hit.on(Button.EventType.CLICK, () => {
        if (!revealed) {
            setRevealed(true);
            return;
        }

        options.onOpen();
    });

    return hit;
}

function setPointerCursor(active: boolean): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.body.style.cursor = active ? 'pointer' : 'default';
}
