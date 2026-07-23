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

export const nativeTheme = {
    background: palette.background,
    neutral: new Color(235, 232, 224, 255),
    blue: new Color(226, 235, 239, 255),
    green: new Color(228, 237, 230, 255),
    lilac: new Color(236, 231, 239, 255),
    sand: new Color(239, 232, 218, 255),
    control: new Color(232, 229, 220, 255),
    controlHover: palette.hover,
    controlSelected: new Color(207, 220, 224, 255),
    border: palette.border,
    borderStrong: palette.borderStrong,
    ink: palette.text,
    muted: palette.muted,
    accent: palette.accent,
    light: palette.primaryText,
} as const;

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonShape = 'rounded' | 'capsule' | 'circle';
export type NativeIconName = 'back' | 'chevron-left' | 'chevron-right' | 'play' | 'pause' | 'reset';
export type SurfaceTone = 'neutral' | 'blue' | 'green' | 'lilac' | 'sand';

export function surfaceColor(tone: SurfaceTone): Color {
    return nativeTheme[tone];
}

export function createUiNode(parent: Node, name: string, width: number, height: number, x = 0, y = 0): Node {
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
    for (const child of [...node.children]) child.destroy();
}

export function fillNode(node: Node, width: number, height: number, color: Color, radius = 0): Graphics {
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
    const border = node.getChildByName('__Border') ?? createUiNode(node, '__Border', width, height);
    border.setPosition(0, 0, 0);
    resizeNode(border, width, height);
    const graphics = border.getComponent(Graphics) ?? border.addComponent(Graphics);
    graphics.clear();
    graphics.strokeColor = color;
    graphics.lineWidth = lineWidth;
    if (radius > 0) graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    else graphics.rect(-width / 2, -height / 2, width, height);
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

function attachButton(root: Node, visual: Node, zoom: number, onPress: () => void, paint?: (hovered: boolean) => void): void {
    const button = root.addComponent(Button);
    button.target = visual;
    button.transition = Button.Transition.SCALE;
    button.zoomScale = zoom;
    button.duration = 0.08;
    root.on(Button.EventType.CLICK, onPress);
    root.on(Node.EventType.MOUSE_ENTER, () => {
        paint?.(true);
        setPointerCursor(true);
    });
    root.on(Node.EventType.MOUSE_LEAVE, () => {
        paint?.(false);
        setPointerCursor(false);
    });
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
    const root = createUiNode(parent, options.name, Math.max(44, options.width), Math.max(44, options.height), options.x, options.y);
    const visual = createUiNode(root, '__ButtonVisual', options.width, options.height);
    const variant = options.variant ?? 'primary';
    const shape = options.shape ?? (options.width === options.height ? 'circle' : 'rounded');
    const radius = shape === 'circle' ? Math.min(options.width, options.height) / 2 : shape === 'capsule' ? options.height / 2 : Math.min(10, options.height / 3);
    const paint = (hovered: boolean): void => {
        const background = variant === 'primary'
            ? hovered ? new Color(79, 88, 83, 255) : palette.primary
            : variant === 'danger'
                ? hovered ? new Color(145, 61, 61, 255) : palette.danger
                : hovered ? palette.hover : variant === 'secondary' ? palette.surface : palette.clear;
        fillNode(visual, options.width, options.height, background, radius);
        if (variant === 'secondary') strokeNode(visual, options.width, options.height, hovered ? palette.borderStrong : palette.border, radius);
    };
    paint(false);
    createLabel(
        visual,
        options.text,
        Math.max(1, options.width - 12),
        options.height,
        options.fontSize ?? 14,
        variant === 'primary' || variant === 'danger' ? palette.primaryText : palette.text,
    );
    attachButton(root, visual, 0.94, options.onPress, paint);
    return root;
}

export function createNativeIcon(parent: Node, icon: NativeIconName, size: number, color: Color, x = 0, y = 0): Node {
    const node = createUiNode(parent, `Icon:${icon}`, size, size, x, y);
    drawNativeIcon(node, icon, size, color);
    return node;
}

export function createIconButton(
    parent: Node,
    options: {
        readonly name: string;
        readonly icon: NativeIconName;
        readonly x?: number;
        readonly y?: number;
        readonly tone?: SurfaceTone;
        readonly selected?: boolean;
        readonly onPress: () => void;
    },
): Node {
    const root = createUiNode(parent, options.name, 44, 44, options.x, options.y);
    const visual = createUiNode(root, '__IconButtonVisual', 36, 36);
    const paint = (hovered: boolean): void => {
        fillNode(
            visual,
            36,
            36,
            options.selected ? nativeTheme.controlSelected : hovered ? nativeTheme.controlHover : surfaceColor(options.tone ?? 'neutral'),
            18,
        );
        strokeNode(visual, 36, 36, hovered ? nativeTheme.borderStrong : nativeTheme.border, 18);
    };
    paint(false);
    createNativeIcon(visual, options.icon, 18, options.selected ? nativeTheme.accent : nativeTheme.ink);
    attachButton(root, visual, 0.93, options.onPress, paint);
    return root;
}

export function createTextButton(
    parent: Node,
    options: {
        readonly name: string;
        readonly text: string;
        readonly width: number;
        readonly x?: number;
        readonly y?: number;
        readonly tone?: SurfaceTone;
        readonly onPress: () => void;
    },
): Node {
    const root = createUiNode(parent, options.name, Math.max(44, options.width), 44, options.x, options.y);
    const visual = createUiNode(root, '__TextButtonVisual', options.width, 42);
    const paint = (hovered: boolean): void => {
        fillNode(visual, options.width, 42, hovered ? nativeTheme.controlHover : surfaceColor(options.tone ?? 'blue'), 21);
        strokeNode(visual, options.width, 42, hovered ? nativeTheme.borderStrong : nativeTheme.border, 21);
    };
    paint(false);
    createLabel(visual, options.text, options.width - 24, 42, 13, nativeTheme.ink);
    attachButton(root, visual, 0.97, options.onPress, paint);
    return root;
}

export function createToggle(
    parent: Node,
    options: { name: string; checked: boolean; x?: number; y?: number; onChange: (checked: boolean) => void },
): Toggle {
    const root = createUiNode(parent, options.name, 52, 44, options.x, options.y);
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

export const createNativeToggle = createToggle;

export function createSlider(
    parent: Node,
    options: { name: string; width: number; progress: number; x?: number; y?: number; onChange: (progress: number) => void },
): Slider {
    const root = createUiNode(parent, options.name, options.width, 44, options.x, options.y);
    const trackWidth = Math.max(24, options.width - 20);
    const track = createUiNode(root, '__SliderTrack', trackWidth, 4);
    fillNode(track, trackWidth, 4, palette.surfaceStrong, 2);
    const progress = createUiNode(root, '__SliderProgress', 1, 4, -trackWidth / 2, 0);
    const handle = createUiNode(root, '__SliderHandle', 20, 20);
    const handleSprite = handle.addComponent(Sprite);
    const handleVisual = createUiNode(handle, '__SliderHandleVisual', 20, 20);
    fillNode(handleVisual, 20, 20, palette.surface, 10);
    strokeNode(handleVisual, 20, 20, palette.borderStrong, 10);
    const slider = root.addComponent(Slider);
    slider.handle = handleSprite;
    slider.direction = Slider.Direction.Horizontal;
    const paint = (): void => {
        const value = Math.max(0, Math.min(1, slider.progress));
        const width = Math.max(1, trackWidth * value);
        fillNode(progress, width, 4, palette.accent, 2);
        progress.setPosition(-trackWidth / 2 + width / 2, 0, 0);
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

export const createNativeSlider = createSlider;

export function createPill(parent: Node, text: string, width: number, x: number, y: number, emphasized = false): Node {
    const node = createUiNode(parent, `Pill:${text}`, width, 26, x, y);
    fillNode(node, width, 26, emphasized ? palette.primary : palette.surfaceSoft, 13);
    if (!emphasized) strokeNode(node, width, 26, palette.border, 13);
    createLabel(node, text.toUpperCase(), width - 10, 26, 10, emphasized ? palette.primaryText : palette.muted);
    return node;
}

function drawNativeIcon(node: Node, icon: NativeIconName, size: number, color: Color): void {
    const graphics = node.addComponent(Graphics);
    const unit = size / 2;
    graphics.strokeColor = color;
    graphics.fillColor = color;
    graphics.lineWidth = Math.max(1.5, size * 0.1);
    if (icon === 'play') {
        const x = -unit * 0.32;
        const y = unit * 0.52;
        graphics.moveTo(x, y);
        graphics.lineTo(unit * 0.5, 0);
        graphics.lineTo(x, -y);
        graphics.lineTo(x, y);
        graphics.fill();
        return;
    }
    if (icon === 'pause') {
        graphics.fillRect(-unit * 0.34, -unit * 0.68, size * 0.15, size * 0.68);
        graphics.fillRect(unit * 0.19, -unit * 0.68, size * 0.15, size * 0.68);
        return;
    }
    if (icon === 'reset') {
        graphics.arc(0, 0, unit * 0.58, -Math.PI * 0.15, Math.PI * 1.45, false);
        graphics.stroke();
        graphics.moveTo(-unit * 0.72, unit * 0.22);
        graphics.lineTo(-unit * 0.2, unit * 0.2);
        graphics.lineTo(-unit * 0.48, unit * 0.64);
        graphics.stroke();
        return;
    }
    const tip = (icon === 'chevron-right' ? 1 : -1) * unit * 0.26;
    graphics.moveTo(-tip, unit * 0.56);
    graphics.lineTo(tip, 0);
    graphics.lineTo(-tip, -unit * 0.56);
    if (icon === 'back') {
        graphics.moveTo(tip, 0);
        graphics.lineTo(unit * 0.66, 0);
    }
    graphics.stroke();
}

function setPointerCursor(active: boolean): void {
    if (typeof document !== 'undefined') document.body.style.cursor = active ? 'pointer' : 'default';
}
