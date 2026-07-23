import {
    Color,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Layers,
    Node,
    UITransform,
    VerticalTextAlignment,
} from 'cc';

export const palette = {
    background: new Color(246, 246, 243, 255),
    backgroundRaised: new Color(252, 252, 250, 255),
    surface: new Color(255, 255, 253, 255),
    surfaceStrong: new Color(232, 232, 228, 255),
    surfaceSoft: new Color(249, 249, 247, 255),
    border: new Color(211, 211, 205, 255),
    primary: new Color(22, 22, 21, 255),
    primaryMuted: new Color(232, 232, 228, 255),
    primaryText: new Color(255, 255, 253, 255),
    text: new Color(24, 24, 23, 255),
    muted: new Color(91, 91, 87, 255),
    subtle: new Color(139, 139, 133, 255),
    accent: new Color(45, 92, 214, 255),
    warning: new Color(159, 101, 22, 255),
    danger: new Color(177, 47, 47, 255),
    clear: new Color(0, 0, 0, 0),
} as const;

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

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
        onPress: () => void;
    },
): Node {
    const button = createUiNode(
        parent,
        options.name,
        options.width,
        options.height,
        options.x ?? 0,
        options.y ?? 0,
    );

    const variant = options.variant ?? 'primary';
    const background = variant === 'primary'
        ? palette.primary
        : variant === 'danger'
            ? palette.danger
            : variant === 'secondary'
                ? palette.surfaceSoft
                : palette.clear;
    const textColor = variant === 'primary' || variant === 'danger'
        ? palette.primaryText
        : palette.text;
    const radius = Math.min(7, options.height / 5);

    fillNode(button, options.width, options.height, background, radius);

    if (variant === 'secondary') {
        strokeNode(button, options.width, options.height, palette.border, radius, 1);
    }

    createLabel(
        button,
        options.text,
        options.width - 16,
        options.height,
        options.fontSize ?? 15,
        textColor,
    );

    button.on(Node.EventType.TOUCH_END, options.onPress);
    return button;
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
    fillNode(node, width, 26, emphasized ? palette.primary : palette.surfaceSoft, 5);

    if (!emphasized) {
        strokeNode(node, width, 26, palette.border, 5, 1);
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
