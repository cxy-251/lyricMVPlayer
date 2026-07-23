import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/card/card.js';
import '@awesome.me/webawesome/dist/components/icon/icon.js';
import '@awesome.me/webawesome/dist/components/slider/slider.js';
import '@awesome.me/webawesome/dist/components/switch/switch.js';

const ROOT_ID = 'cocoslab-web-ui';
const STYLE_ID = 'cocoslab-web-ui-style';

export interface WebUiRect {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}

export function hasWebUi(): boolean {
    return typeof window !== 'undefined'
        && typeof document !== 'undefined'
        && Boolean(document.body);
}

export function getWebUiScope(name: string): HTMLDivElement | null {
    const root = ensureRoot();

    if (!root) {
        return null;
    }

    const id = `${ROOT_ID}:${name}`;
    let scope = root.querySelector<HTMLDivElement>(`[data-cocoslab-scope="${name}"]`);

    if (!scope) {
        scope = document.createElement('div');
        scope.dataset.cocoslabScope = name;
        scope.id = id;
        scope.className = 'cocoslab-ui-scope';
        root.appendChild(scope);
    }

    scope.replaceChildren();
    return scope;
}

export function clearWebUiScope(name: string): void {
    if (!hasWebUi()) {
        return;
    }

    document.querySelector(`[data-cocoslab-scope="${name}"]`)?.remove();
}

export function cocosRectToCss(
    x: number,
    y: number,
    width: number,
    height: number,
): WebUiRect {
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

    return {
        left: viewportWidth / 2 + x - width / 2,
        top: viewportHeight / 2 - y - height / 2,
        width,
        height,
    };
}

export function applyRect(element: HTMLElement, rect: WebUiRect): void {
    element.style.position = 'absolute';
    element.style.left = `${Math.round(rect.left)}px`;
    element.style.top = `${Math.round(rect.top)}px`;
    element.style.width = `${Math.round(rect.width)}px`;
    element.style.height = `${Math.round(rect.height)}px`;
}

export function createWebIconButton(options: {
    readonly parent: HTMLElement;
    readonly icon: string;
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

    const icon = document.createElement('wa-icon');
    icon.setAttribute('name', options.icon);
    icon.setAttribute('label', options.label);
    button.appendChild(icon);
    button.addEventListener('click', options.onPress);
    options.parent.appendChild(button);
    return button;
}

function ensureRoot(): HTMLDivElement | null {
    if (!hasWebUi()) {
        return null;
    }

    ensureStyles();
    let root = document.getElementById(ROOT_ID) as HTMLDivElement | null;

    if (!root) {
        root = document.createElement('div');
        root.id = ROOT_ID;
        root.setAttribute('aria-live', 'polite');
        document.body.appendChild(root);
    }

    return root;
}

function ensureStyles(): void {
    if (document.getElementById(STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
:root {
  --cocoslab-bg: #f2f1ed;
  --cocoslab-ink: #303432;
  --cocoslab-muted: #747b77;
  --cocoslab-line: #d7dad5;
  --cocoslab-blue: #dfe9f3;
  --cocoslab-green: #e2ece6;
  --cocoslab-lilac: #ebe5f0;
  --cocoslab-sand: #eee8dc;
  --wa-color-brand-50: #f4f7fa;
  --wa-color-brand-100: #e7eef5;
  --wa-color-brand-200: #d6e3ee;
  --wa-color-brand-300: #bfd2e2;
  --wa-color-brand-400: #9db8cd;
  --wa-color-brand-500: #7899b3;
  --wa-color-brand-600: #5f7f98;
  --wa-color-brand-700: #4f687c;
  --wa-color-brand-800: #445767;
  --wa-color-brand-900: #3c4a56;
  --wa-font-family-body: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  --wa-font-family-heading: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
  --wa-border-radius-s: 10px;
  --wa-border-radius-m: 16px;
  --wa-border-radius-l: 22px;
}
#${ROOT_ID} {
  position: fixed;
  inset: 0;
  z-index: 40;
  pointer-events: none;
  overflow: hidden;
  color: var(--cocoslab-ink);
  font-family: var(--wa-font-family-body);
}
.cocoslab-ui-scope {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.cocoslab-navigation {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.cocoslab-navigation > * {
  pointer-events: auto;
}
.cocoslab-navigation-title {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13px;
  letter-spacing: 0.015em;
  color: var(--cocoslab-muted);
}
.cocoslab-navigation-spacer {
  flex: 1;
}
.cocoslab-icon-button {
  width: 44px;
  height: 44px;
}
.cocoslab-icon-button::part(base) {
  min-width: 40px;
  min-height: 40px;
  border-radius: 999px;
  color: var(--cocoslab-ink);
}
.cocoslab-icon-button:not(.is-selected)::part(base) {
  background: color-mix(in srgb, var(--cocoslab-blue) 58%, transparent);
}
.cocoslab-catalog-card {
  position: absolute;
  display: block;
  pointer-events: auto;
  cursor: pointer;
  color: var(--cocoslab-ink);
  transition: transform 160ms ease, filter 160ms ease;
}
.cocoslab-catalog-card:hover,
.cocoslab-catalog-card:focus-visible {
  transform: translateY(-3px);
  filter: saturate(1.04);
  outline: none;
}
.cocoslab-catalog-card::part(body) {
  height: 100%;
  box-sizing: border-box;
  padding: 0;
  overflow: hidden;
}
.cocoslab-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 20px;
}
.cocoslab-card-inner[data-tone="blue"] { background: var(--cocoslab-blue); }
.cocoslab-card-inner[data-tone="green"] { background: var(--cocoslab-green); }
.cocoslab-card-inner[data-tone="lilac"] { background: var(--cocoslab-lilac); }
.cocoslab-card-inner[data-tone="sand"] { background: var(--cocoslab-sand); }
.cocoslab-card-cover {
  width: 84%;
  height: 76%;
  display: block;
}
.cocoslab-card-copy {
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 22px;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 160ms ease, transform 160ms ease;
  text-align: center;
}
.cocoslab-catalog-card:hover .cocoslab-card-copy,
.cocoslab-catalog-card:focus-visible .cocoslab-card-copy,
.cocoslab-catalog-card.is-revealed .cocoslab-card-copy {
  opacity: 1;
  transform: translateY(0);
}
.cocoslab-card-title {
  font-size: clamp(19px, 2.4vw, 29px);
  font-weight: 560;
  letter-spacing: -0.025em;
}
.cocoslab-card-subtitle {
  margin-top: 5px;
  font-size: 12px;
  color: var(--cocoslab-muted);
}
.cocoslab-parameter-card {
  position: absolute;
  display: block;
  pointer-events: auto;
}
.cocoslab-parameter-card::part(body) {
  height: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
}
.cocoslab-parameter-grid {
  height: 100%;
  display: grid;
  gap: 10px 18px;
  align-content: center;
}
.cocoslab-parameter-control {
  min-width: 0;
}
.cocoslab-parameter-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 5px;
  font-size: 11px;
  color: var(--cocoslab-muted);
}
.cocoslab-parameter-value {
  color: var(--cocoslab-ink);
  font-variant-numeric: tabular-nums;
}
.cocoslab-parameter-control wa-slider,
.cocoslab-parameter-control wa-switch {
  width: 100%;
}
`;
    document.head.appendChild(style);
}
