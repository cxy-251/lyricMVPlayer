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
    background: new Color(9, 13, 22, 255),
    backgroundRaised: new Color(14, 20, 32, 255),
    surface: new Color(24, 32, 48, 255),
    surfaceStrong: new Color(34, 45, 66, 255),
    surfaceSoft: new Color(20, 27, 41, 255),
    border: new Color(58, 75, 105, 210),
    primary: new Color(54, 221, 184, 255),
    primaryMuted: new Color(31, 104, 91, 255),
    primaryText: new Color(7, 39, 33, 255),
    text: new Color(238, 243, 252, 255),
    muted: new Color(145, 159, 184, 255),
    subtle: new Color(93, 107, 133, 255),
    accent: new Color(255, 92, 142, 255),
    warning: new Color(255, 190, 74, 255),
    danger: new Color(255, 101, 111, 255),
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
                ? palette.surfaceStrong
                : palette.surfaceSoft;
    const textColor = variant === 'primary' ? palette.primaryText : palette.text;

    fillNode(button, options.width, options.height, background, Math.min(14, options.height / 3));

    if (variant === 'ghost') {
        strokeNode(button, options.width, options.height, palette.border, Math.min(14, options.height / 3), 1.5);
    }

    createLabel(
        button,
        options.text,
        options.width - 20,
        options.height,
        options.fontSize ?? 20,
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
    const node = createUiNode(parent, `Pill:${text}`, width, 30, x, y);
    fillNode(node, width, 30, emphasized ? palette.primaryMuted : palette.surfaceStrong, 15);
    createLabel(node, text.toUpperCase(), width - 12, 30, 12, emphasized ? palette.text : palette.muted);
    return node;
}
