import {
    Button,
    Color,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Layers,
    Node,
    Slider,
    Sprite,
    Toggle,
    UITransform,
    VerticalTextAlignment,
} from 'cc';

export const palette = {
    background: new Color(242, 240, 234, 255),
    backgroundRaised: new Color(246, 244, 239, 255),
    surface: new Color(246, 244, 238, 255),
    surfaceStrong: new Color(224, 223, 215, 255),
    surfaceSoft: new Color(236, 233, 225, 255),
    border: new Color(204, 203, 194, 255),
    borderStrong: new Color(174, 177, 168, 255),
    hover: new Color(222, 221, 212, 255),
    primary: new Color(65, 74, 69, 255),
    primaryMuted: new Color(218, 225, 219, 255),
    primaryText: new Color(250, 249, 245, 255),
    text: new Color(49, 54, 50, 255),
    muted: new Color(103, 112, 106, 255),
    subtle: new Color(132, 139, 134, 255),
    accent: new Color(91, 122, 130, 255),
    accentSoft: new Color(226, 235, 239, 255),
    warning: new Color(145, 112, 62, 255),
    danger: new Color(165, 72, 72, 255),
    clear: new Color(0, 0, 0, 0),
} as const;

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonShape = 'rounded' | 'capsule' | 'circle';

export function createUiNode(
    parent: Node,
    name: string,
    width: number,
    height: number,
    x = 0,
    y = 0,
): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    node.setPosition(x, y, 0);
    resizeNode(node, width, height);
    return node;
}

export function resizeNode(node: Node, width: number, height: number): UITransform {
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(Math.max(1, width), Math.max(1, height));
    return transform;
}

export function clearNode(node: Node): void {
    for (const child of [...node.children]) {
        child.destroy();
    }
}

export function fillNode(
    node: Node,
    width: number,
    height: number,
    color: Color,
    radius = 0,
): Graphics {
    resizeNode(node, width, height);
    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
    graphics.clear();
    graphics.fillColor = color;

    if (radius > 0) {
        graphics.roundRect(-width / 2, -height / 2, width, height, radius);
        graphics.fill();
    } else {
        graphics.fillRect(-width / 2, -height / 2, width, height);
    }

    return graphics;
}

export function strokeNode(
    node: Node,
    width: number,
    height: number,
    color: Color,
    radius = 0,
    lineWidth = 1,
): Graphics {
    resizeNode(node, width, height);

    const borderNode = node.getChildByName('__Border')
        ?? createUiNode(node, '__Border', width, height);
    borderNode.setPosition(0, 0, 0);
    resizeNode(borderNode, width, height);

    const graphics = borderNode.getComponent(Graphics) ?? borderNode.addComponent(Graphics);
    graphics.clear();
    graphics.strokeColor = color;
    graphics.lineWidth = lineWidth;

    if (radius > 0) {
        graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    } else {
        graphics.rect(-width / 2, -height / 2, width, height);
    }

    graphics.stroke();
    return graphics;
}

export function createLabel(
    parent: Node,
    text: string,
    width: number,
    height: number,
    fontSize: number,
    color: Color,
    x = 0,
    y = 0,
    horizontalAlign = HorizontalTextAlignment.CENTER,
): Node {
    const node = createUiNode(parent, `Label:${text.slice(0, 24)}`, width, height, x, y);
    const label = node.addComponent(Label);

    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.35);
    label.color = color;
    label.horizontalAlign = horizontalAlign;
    label.verticalAlign = VerticalTextAlignment.CENTER;
    label.enableWrapText = true;

    return node;
}

export function createButton(
    parent: Node,
    options: {
        name: string;
        text: string;
        width: number;
        height: number;
        x?: number;
        y?: number;
        fontSize?: number;
        variant?: ButtonVariant;
        shape?: ButtonShape;
        onPress: () => void;
    },
): Node {
    const hitWidth = Math.max(44, options.width);
    const hitHeight = Math.max(44, options.height);
    const root = createUiNode(
        parent,
        options.name,
        hitWidth,
        hitHeight,
        options.x ?? 0,
        options.y ?? 0,
    );
    const visual = createUiNode(root, '__ButtonVisual', options.width, options.height);
    const variant = options.variant ?? 'primary';
    const shape = options.shape ?? (options.width === options.height ? 'circle' : 'rounded');
    const radius = shape === 'circle'
        ? Math.min(options.width, options.height) / 2
        : shape === 'capsule'
            ? options.height / 2
            : Math.min(10, options.height / 3);

    const paint = (hovered: boolean): void => {
        const background = variant === 'primary'
            ? hovered ? new Color(79, 88, 83, 255) : palette.primary
            : variant === 'danger'
                ? hovered ? new Color(145, 61, 61, 255) : palette.danger
                : hovered
                    ? palette.hover
                    : variant === 'secondary'
                        ? palette.surface
                        : palette.clear;
        fillNode(visual, options.width, options.height, background, radius);

        if (variant === 'secondary') {
            strokeNode(
                visual,
                options.width,
                options.height,
                hovered ? palette.borderStrong : palette.border,
                radius,
                1,
            );
        }
    };

    paint(false);
    const textColor = variant === 'primary' || variant === 'danger'
        ? palette.primaryText
        : palette.text;
    createLabel(
        visual,
        options.text,
        Math.max(1, options.width - 12),
        options.height,
        options.fontSize ?? 14,
        textColor,
    );

    const button = root.addComponent(Button);
    button.target = visual;
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.94;
    button.duration = 0.08;
    root.on(Button.EventType.CLICK, options.onPress);
    root.on(Node.EventType.MOUSE_ENTER, () => {
        paint(true);
        setPointerCursor(true);
    });
    root.on(Node.EventType.MOUSE_LEAVE, () => {
        paint(false);
        setPointerCursor(false);
    });

    return root;
}

export function createToggle(
    parent: Node,
    options: {
        name: string;
        checked: boolean;
        x?: number;
        y?: number;
        onChange: (checked: boolean) => void;
    },
): Toggle {
    const root = createUiNode(parent, options.name, 52, 44, options.x ?? 0, options.y ?? 0);
    const track = createUiNode(root, '__ToggleTrack', 44, 26);
    const knob = createUiNode(track, '__ToggleKnob', 20, 20);

    const paint = (checked: boolean): void => {
        fillNode(track, 44, 26, checked ? palette.accent : palette.surfaceStrong, 13);
        fillNode(knob, 20, 20, palette.surface, 10);
        knob.setPosition(checked ? 9 : -9, 0, 0);
    };

    const toggle = root.addComponent(Toggle);
    toggle.transition = Button.Transition.SCALE;
    toggle.target = track;
    toggle.zoomScale = 0.96;
    toggle.duration = 0.08;
    toggle.setIsCheckedWithoutNotify(options.checked);
    paint(options.checked);

    root.on('toggle', () => {
        paint(toggle.isChecked);
        options.onChange(toggle.isChecked);
    });
    root.on(Node.EventType.MOUSE_ENTER, () => setPointerCursor(true));
    root.on(Node.EventType.MOUSE_LEAVE, () => setPointerCursor(false));
    return toggle;
}

export function createSlider(
    parent: Node,
    options: {
        name: string;
        width: number;
        progress: number;
        x?: number;
        y?: number;
        onChange: (progress: number) => void;
    },
): Slider {
    const root = createUiNode(parent, options.name, options.width, 44, options.x ?? 0, options.y ?? 0);
    const trackWidth = Math.max(24, options.width - 20);
    const track = createUiNode(root, '__SliderTrack', trackWidth, 4);
    fillNode(track, trackWidth, 4, palette.surfaceStrong, 2);
    const progress = createUiNode(root, '__SliderProgress', 1, 4, -trackWidth / 2, 0);
    const handle = createUiNode(root, '__SliderHandle', 20, 20);
    const handleSprite = handle.addComponent(Sprite);
    const handleVisual = createUiNode(handle, '__SliderHandleVisual', 20, 20);
    fillNode(handleVisual, 20, 20, palette.surface, 10);
    strokeNode(handleVisual, 20, 20, palette.borderStrong, 10, 1);

    const slider = root.addComponent(Slider);
    slider.handle = handleSprite;
    slider.direction = Slider.Direction.Horizontal;

    const paint = (): void => {
        const value = Math.max(0, Math.min(1, slider.progress));
        const filledWidth = Math.max(1, trackWidth * value);
        fillNode(progress, filledWidth, 4, palette.accent, 2);
        progress.setPosition(-trackWidth / 2 + filledWidth / 2, 0, 0);
    };

    slider.progress = Math.max(0, Math.min(1, options.progress));
    paint();
    root.on('slide', () => {
        paint();
        options.onChange(slider.progress);
    });
    root.on(Node.EventType.MOUSE_ENTER, () => setPointerCursor(true));
    root.on(Node.EventType.MOUSE_LEAVE, () => setPointerCursor(false));
    return slider;
}

export function createPill(
    parent: Node,
    text: string,
    width: number,
    x: number,
    y: number,
    emphasized = false,
): Node {
    const node = createUiNode(parent, `Pill:${text}`, width, 26, x, y);
    fillNode(node, width, 26, emphasized ? palette.primary : palette.surfaceSoft, 13);

    if (!emphasized) {
        strokeNode(node, width, 26, palette.border, 13, 1);
    }

    createLabel(
        node,
        text.toUpperCase(),
        width - 10,
        26,
        10,
        emphasized ? palette.primaryText : palette.muted,
    );
    return node;
}

function setPointerCursor(active: boolean): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.body.style.cursor = active ? 'pointer' : 'default';
}
