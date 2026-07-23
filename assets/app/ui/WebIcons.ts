import {
    ArrowLeft,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Pause,
    Play,
    RotateCcw,
    createElement,
} from 'lucide';

export type WebIconName =
    | 'arrow-left'
    | 'arrow-right'
    | 'chevron-left'
    | 'chevron-right'
    | 'pause'
    | 'play'
    | 'rotate-left';

const iconDefinitions: Record<WebIconName, unknown> = {
    'arrow-left': ArrowLeft,
    'arrow-right': ArrowRight,
    'chevron-left': ChevronLeft,
    'chevron-right': ChevronRight,
    pause: Pause,
    play: Play,
    'rotate-left': RotateCcw,
};

export function createLucideIcon(
    name: WebIconName,
    label: string,
    size = 18,
): SVGElement {
    const icon = createElement(iconDefinitions[name] as never) as SVGElement;
    icon.setAttribute('width', String(size));
    icon.setAttribute('height', String(size));
    icon.setAttribute('stroke-width', '1.7');
    icon.setAttribute('aria-label', label);
    icon.setAttribute('role', 'img');
    icon.style.display = 'block';
    return icon;
}

export function createLibraryIconButton(options: {
    readonly parent: HTMLElement;
    readonly icon: WebIconName;
    readonly label: string;
    readonly onPress: () => void;
    readonly selected?: boolean;
}): HTMLElement {
    const button = document.createElement('wa-button') as HTMLElement;
    button.className = `cocoslab-icon-button${options.selected ? ' is-selected' : ''}`;
    button.setAttribute('appearance', options.selected ? 'filled' : 'plain');
    button.setAttribute('variant', options.selected ? 'brand' : 'neutral');
    button.setAttribute('size', 'small');
    button.setAttribute('aria-label', options.label);
    button.appendChild(createLucideIcon(options.icon, options.label));
    button.addEventListener('click', options.onPress);
    options.parent.appendChild(button);
    return button;
}
