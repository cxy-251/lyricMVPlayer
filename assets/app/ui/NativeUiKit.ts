import {
    Button,
    Color,
    Graphics,
    Node,
    Slider,
    Sprite,
    Toggle,
} from 'cc';
import {
    createLabel,
    createUiNode,
    fillNode,
    palette,
    strokeNode,
} from './UiFactory';

export type NativeIconName =
    | 'back'
    | 'chevron-left'
    | 'chevron-right'
    | 'play'
    | 'pause'
    | 'reset';

export type SurfaceTone = 'neutral' | 'blue' | 'green' | 'lilac' | 'sand';

export const nativeTheme = {
    background: new Color(242, 240, 234, 255),
    neutral: new Color(235, 232, 224, 255),
    blue: new Color(226, 235, 239, 255),
    green: new Color(228, 237, 230, 255),
    lilac: new Color(236, 231, 239, 255),
    sand: new Color(239, 232, 218, 255),
    control: new Color(232, 229, 220, 255),
    controlHover: new Color(222, 221, 212, 255),
    controlSelected: new Color(207, 220, 224, 255),
    border: new Color(204, 203, 194, 255),
    borderStrong: new Color(174, 177, 168, 255),
    ink: new Color(49, 54, 50, 255),
    muted: new Color(103, 112, 106, 255),
    accent: new Color(91, 122, 130, 255),
    light: new Color(250, 249, 245, 255),
} as const;

export function surfaceColor(tone: SurfaceTone): Color {
    return nativeTheme[tone];
}

export function createNativeIcon(
    parent: Node,
    icon: NativeIconName,
    size: number,
    color: Color,
    x = 0,
    y = 0,
): Node {
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
    const hitSize = 44;
    const visualSize = 36;
    const root = createUiNode(
        parent,
        options.name,
        hitSize,
        hitSize,
        options.x ?? 0,
        options.y ?? 0,
    );
    const visual = createUiNode(root, '__IconButtonVisual', visualSize, visualSize);
    const tone = options.tone ?? 'neutral';

    const paint = (hovered: boolean): void => {
        const background = options.selected
            ? nativeTheme.controlSelected
            : hovered
                ? nativeTheme.controlHover
                : surfaceColor(tone);
        fillNode(visual, visualSize, visualSize, background, visualSize / 2);
        strokeNode(
            visual,
            visualSize,
            visualSize,
            hovered ? nativeTheme.borderStrong : nativeTheme.border,
            visualSize / 2,
            1,
        );
    };

    paint(false);
    createNativeIcon(visual, options.icon, 18, options.selected ? nativeTheme.accent : nativeTheme.ink);

    const button = root.addComponent(Button);
    button.target = visual;
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.93;
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
    const height = 42;
    const root = createUiNode(
        parent,
        options.name,
        Math.max(44, options.width),
        44,
        options.x ?? 0,
        options.y ?? 0,
    );
    const visual = createUiNode(root, '__TextButtonVisual', options.width, height);
    const tone = options.tone ?? 'blue';

    const paint = (hovered: boolean): void => {
        fillNode(
            visual,
            options.width,
            height,
            hovered ? nativeTheme.controlHover : surfaceColor(tone),
            height / 2,
        );
        strokeNode(
            visual,
            options.width,
            height,
            hovered ? nativeTheme.borderStrong : nativeTheme.border,
            height / 2,
            1,
        );
    };

    paint(false);
    createLabel(visual, options.text, options.width - 24, height, 13, nativeTheme.ink);

    const button = root.addComponent(Button);
    button.target = visual;
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.97;
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

export function createNativeToggle(
    parent: Node,
    options: {
        readonly name: string;
        readonly checked: boolean;
        readonly x?: number;
        readonly y?: number;
        readonly onChange: (checked: boolean) => void;
    },
): Toggle {
    const root = createUiNode(parent, options.name, 54, 44, options.x ?? 0, options.y ?? 0);
    const track = createUiNode(root, '__ToggleTrack', 44, 26);
    const knob = createUiNode(track, '__ToggleKnob', 20, 20);

    const paint = (checked: boolean): void => {
        fillNode(
            track,
            44,
            26,
            checked ? nativeTheme.controlSelected : nativeTheme.control,
            13,
        );
        strokeNode(track, 44, 26, nativeTheme.border, 13, 1);
        fillNode(knob, 20, 20, checked ? nativeTheme.accent : nativeTheme.light, 10);
        knob.setPosition(checked ? 9 : -9, 0, 0);
    };

    const toggle = root.addComponent(Toggle);
    toggle.target = track;
    toggle.transition = Button.Transition.SCALE;
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

export function createNativeSlider(
    parent: Node,
    options: {
        readonly name: string;
        readonly width: number;
        readonly progress: number;
        readonly x?: number;
        readonly y?: number;
        readonly onChange: (progress: number) => void;
    },
): Slider {
    const root = createUiNode(parent, options.name, options.width, 44, options.x ?? 0, options.y ?? 0);
    const trackWidth = Math.max(24, options.width - 20);
    const track = createUiNode(root, '__SliderTrack', trackWidth, 5);
    fillNode(track, trackWidth, 5, nativeTheme.control, 2.5);
    const progress = createUiNode(root, '__SliderProgress', 1, 5, -trackWidth / 2, 0);
    const handle = createUiNode(root, '__SliderHandle', 22, 22);
    const handleSprite = handle.addComponent(Sprite);
    const handleVisual = createUiNode(handle, '__SliderHandleVisual', 22, 22);
    fillNode(handleVisual, 22, 22, nativeTheme.light, 11);
    strokeNode(handleVisual, 22, 22, nativeTheme.borderStrong, 11, 1);

    const slider = root.addComponent(Slider);
    slider.handle = handleSprite;
    slider.direction = Slider.Direction.Horizontal;

    const paint = (): void => {
        const value = Math.max(0, Math.min(1, slider.progress));
        const filledWidth = Math.max(1, trackWidth * value);
        fillNode(progress, filledWidth, 5, nativeTheme.accent, 2.5);
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

function drawNativeIcon(node: Node, icon: NativeIconName, size: number, color: Color): void {
    const graphics = node.addComponent(Graphics);
    const unit = size / 2;
    graphics.clear();
    graphics.strokeColor = color;
    graphics.fillColor = color;
    graphics.lineWidth = Math.max(1.5, size * 0.1);
    graphics.lineCap = Graphics.LineCap.ROUND;
    graphics.lineJoin = Graphics.LineJoin.ROUND;

    if (icon === 'play') {
        graphics.moveTo(-unit * 0.32, unit * 0.52);
        graphics.lineTo(unit * 0.5, 0);
        graphics.lineTo(-unit * 0.32, -unit * 0.52);
        graphics.close();
        graphics.fill();
        return;
    }

    if (icon === 'pause') {
        const barWidth = size * 0.14;
        const barHeight = size * 0.68;
        graphics.roundRect(-unit * 0.34, -barHeight / 2, barWidth, barHeight, barWidth / 2);
        graphics.roundRect(unit * 0.2, -barHeight / 2, barWidth, barHeight, barWidth / 2);
        graphics.fill();
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

    const direction = icon === 'chevron-right' ? 1 : -1;
    const innerX = direction * unit * 0.26;
    const outerX = -direction * unit * 0.26;
    graphics.moveTo(innerX, unit * 0.56);
    graphics.lineTo(outerX, 0);
    graphics.lineTo(innerX, -unit * 0.56);

    if (icon === 'back') {
        graphics.moveTo(outerX, 0);
        graphics.lineTo(direction * unit * 0.66, 0);
    }

    graphics.stroke();
}

function setPointerCursor(active: boolean): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.body.style.cursor = active ? 'pointer' : 'default';
}
