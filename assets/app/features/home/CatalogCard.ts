import {
    Button,
    Color,
    HorizontalTextAlignment,
    Node,
    sys,
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
    readonly directOpen?: boolean;
    readonly style?: CatalogCardStyle;
    readonly onOpen: () => void;
}

export interface CatalogCardStyle {
    readonly card: Color;
    readonly hover: Color;
    readonly border: Color;
    readonly ink: Color;
    readonly muted: Color;
    readonly accent: Color;
    readonly radius?: number;
}

export function createCatalogCard(parent: Node, options: CatalogCardOptions): Node {
    const width = Math.max(1, options.width);
    const height = Math.max(1, options.height);
    const style = options.style;
    const radius = style?.radius ?? Math.min(22, Math.max(1, width * 0.038), width / 2, height / 2);
    const directOpen = options.directOpen ?? sys.isMobile;
    const hit = createUiNode(
        parent,
        options.name,
        width,
        height,
        options.x,
        options.y,
    );
    const card = createUiNode(hit, '__CardVisual', width, height);
    fillNode(card, width, height, style?.card ?? nativeTheme.card, radius);
    strokeNode(card, width, height, style?.border ?? nativeTheme.border, radius, 1);

    const hoverWidth = Math.max(1, width - 2);
    const hoverHeight = Math.max(1, height - 2);
    const hoverLayer = createUiNode(card, 'HoverLayer', hoverWidth, hoverHeight);
    fillNode(
        hoverLayer,
        hoverWidth,
        hoverHeight,
        style?.hover ?? nativeTheme.cardHover,
        Math.min(Math.max(1, radius - 1), hoverWidth / 2, hoverHeight / 2),
    );
    const hoverOpacity = hoverLayer.addComponent(UIOpacity);
    hoverOpacity.opacity = directOpen ? 255 : 0;

    const coverHeight = Math.max(1, height * 0.8);
    const coverWidth = Math.max(1, width - Math.max(28, width * 0.08));
    const cover = drawCatalogCover(
        card,
        options.cover,
        coverWidth,
        coverHeight,
    );
    cover.setPosition(0, height * (directOpen ? 0.105 : 0.02), 0);

    const detailWidth = Math.max(1, width - 40);
    const detailHeight = Math.max(1, Math.min(height, Math.max(72, height * 0.26)));
    const detail = createUiNode(
        card,
        'Details',
        detailWidth,
        detailHeight,
        0,
        -height * 0.32,
    );
    const detailOpacity = detail.addComponent(UIOpacity);
    detailOpacity.opacity = directOpen ? 255 : 0;

    const titleFontSize = Math.max(11, Math.min(28, width * 0.056, height * 0.12));
    const subtitleFontSize = Math.max(9, Math.min(14, width * 0.027, height * 0.065));
    const titleY = Math.min(26, detailHeight * 0.22);
    const subtitleY = -Math.min(10, detailHeight * 0.08);
    const iconY = -Math.min(45, detailHeight * 0.38);

    createLabel(
        detail,
        options.title,
        Math.max(1, width - 52),
        Math.max(1, Math.min(42, detailHeight * 0.38)),
        titleFontSize,
        style?.ink ?? nativeTheme.ink,
        0,
        titleY,
        HorizontalTextAlignment.CENTER,
    );
    createLabel(
        detail,
        options.subtitle,
        Math.max(1, width - 68),
        Math.max(1, Math.min(26, detailHeight * 0.24)),
        subtitleFontSize,
        style?.muted ?? nativeTheme.muted,
        0,
        subtitleY,
        HorizontalTextAlignment.CENTER,
    );
    createNativeIcon(
        detail,
        'chevron-right',
        Math.max(10, Math.min(18, width * 0.05)),
        style?.accent ?? nativeTheme.accent,
        0,
        iconY,
    );

    const button = hit.addComponent(Button);
    button.target = card;
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.985;
    button.duration = 0.08;

    let revealed = directOpen;
    let pointerWasTouch = false;

    const stopAnimations = (): void => {
        Tween.stopAllByTarget(card);
        Tween.stopAllByTarget(cover);
        Tween.stopAllByTarget(detailOpacity);
        Tween.stopAllByTarget(hoverOpacity);
    };

    const setRevealed = (next: boolean): void => {
        if (revealed === next) {
            return;
        }

        revealed = next;
        stopAnimations();

        tween(card)
            .to(0.16, {
                scale: next ? new Vec3(1.008, 1.008, 1) : new Vec3(1, 1, 1),
            })
            .start();
        tween(cover)
            .to(0.16, {
                position: new Vec3(0, next ? height * 0.105 : height * 0.02, 0),
            })
            .start();
        tween(detailOpacity)
            .to(0.16, { opacity: next ? 255 : 0 })
            .start();
        tween(hoverOpacity)
            .to(0.16, { opacity: next ? 255 : 0 })
            .start();
    };

    if (!directOpen) {
        hit.on(Node.EventType.MOUSE_ENTER, () => {
            setRevealed(true);
            setPointerCursor(true);
        });
        hit.on(Node.EventType.MOUSE_LEAVE, () => {
            setRevealed(false);
            setPointerCursor(false);
        });
    }

    hit.on(Node.EventType.TOUCH_START, () => {
        pointerWasTouch = true;
    });
    hit.on(Node.EventType.TOUCH_CANCEL, () => {
        pointerWasTouch = false;
    });
    hit.on(Button.EventType.CLICK, () => {
        if (directOpen || pointerWasTouch || revealed) {
            pointerWasTouch = false;
            stopAnimations();
            setPointerCursor(false);
            options.onOpen();
            return;
        }

        setRevealed(true);
    });

    return hit;
}

function setPointerCursor(active: boolean): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.body.style.cursor = active ? 'pointer' : 'default';
}
