import {
    Button,
    Color,
    Graphics,
    Node,
    Slider,
    Toggle,
} from 'cc';
import {
    createLabel,
    createSlider,
    createToggle,
    createUiNode,
    fillNode,
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
    createNativeIcon(
        visual,
        options.icon,
        18,
        options.selected ? nativeTheme.accent : nativeTheme.ink,
    );

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
    return createToggle(parent, {
        name: options.name,
        checked: options.checked,
        x: options.x,
        y: options.y,
        onChange: options.onChange,
    });
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
    return createSlider(parent, {
        name: options.name,
        width: options.width,
        progress: options.progress,
        x: options.x,
        y: options.y,
        onChange: options.onChange,
    });
}

function drawNativeIcon(node: Node, icon: NativeIconName, size: number, color: Color): void {
    const graphics = node.addComponent(Graphics);
    const unit = size / 2;
    graphics.clear();
    graphics.strokeColor = color;
    graphics.fillColor = color;
    graphics.lineWidth = Math.max(1.5, size * 0.1);

    if (icon === 'play') {
        const startX = -unit * 0.32;
        const startY = unit * 0.52;
        graphics.moveTo(startX, startY);
        graphics.lineTo(unit * 0.5, 0);
        graphics.lineTo(startX, -unit * 0.52);
        graphics.lineTo(startX, startY);
        graphics.fill();
        return;
    }

    if (icon === 'pause') {
        const barWidth = size * 0.15;
        const barHeight = size * 0.68;
        graphics.fillRect(-unit * 0.34, -barHeight / 2, barWidth, barHeight);
        graphics.fillRect(unit * 0.19, -barHeight / 2, barWidth, barHeight);
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

    const pointsRight = icon === 'chevron-right';
    const tipX = (pointsRight ? 1 : -1) * unit * 0.26;
    const armX = -tipX;
    graphics.moveTo(armX, unit * 0.56);
    graphics.lineTo(tipX, 0);
    graphics.lineTo(armX, -unit * 0.56);

    if (icon === 'back') {
        graphics.moveTo(tipX, 0);
        graphics.lineTo(unit * 0.66, 0);
    }

    graphics.stroke();
}

function setPointerCursor(active: boolean): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.body.style.cursor = active ? 'pointer' : 'default';
}
