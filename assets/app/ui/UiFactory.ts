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
    background: new Color(11, 15, 24, 255),
    surface: new Color(24, 32, 48, 255),
    surfaceStrong: new Color(34, 45, 66, 255),
    primary: new Color(54, 221, 184, 255),
    primaryText: new Color(7, 39, 33, 255),
    text: new Color(238, 243, 252, 255),
    muted: new Color(145, 159, 184, 255),
    accent: new Color(255, 92, 142, 255),
} as const;

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

    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);

    return node;
}

export function fillNode(
    node: Node,
    width: number,
    height: number,
    color: Color,
    radius = 0,
): Graphics {
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

export function createLabel(
    parent: Node,
    text: string,
    width: number,
    height: number,
    fontSize: number,
    color: Color,
    x = 0,
    y = 0,
): Node {
    const node = createUiNode(parent, `Label:${text.slice(0, 24)}`, width, height, x, y);
    const label = node.addComponent(Label);

    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.35);
    label.color = color;
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
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

    fillNode(button, options.width, options.height, palette.primary, 14);
    createLabel(
        button,
        options.text,
        options.width - 24,
        options.height,
        22,
        palette.primaryText,
    );

    button.on(Node.EventType.TOUCH_END, options.onPress);
    return button;
}
