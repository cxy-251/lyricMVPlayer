export type RgbTuple = [number, number, number];
export type CmykTuple = [number, number, number, number];
export type HslTuple = [number, number, number];

const clamp = (value: number, min = 0, max = 255) => Math.min(max, Math.max(min, value));

const normalizeHex = (hex: string): string => {
  const value = hex.trim().replace(/^#/, "");
  if (value.length === 3) {
    return `#${value.split("").map((part) => part + part).join("")}`.toLowerCase();
  }
  return `#${value.padEnd(6, "0").slice(0, 6)}`.toLowerCase();
};

export const hexToRgb = (hex: string): RgbTuple => {
  const normalized = normalizeHex(hex).slice(1);
  const value = Number.parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

export const rgbToHex = ([red, green, blue]: RgbTuple): string =>
  `#${[red, green, blue]
    .map((value) => Math.round(clamp(value)).toString(16).padStart(2, "0"))
    .join("")}`;

export const rgbToCmyk = ([red, green, blue]: RgbTuple): CmykTuple => {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 0.999) return [0, 0, 0, 100];
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return [c, m, y, k].map((value) => Math.round(clamp(value * 100, 0, 100))) as CmykTuple;
};

export const rgbToHsl = ([red, green, blue]: RgbTuple): HslTuple => {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return [0, 0, Math.round(lightness * 100)];
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  if (max === g) hue = 60 * ((b - r) / delta + 2);
  if (max === b) hue = 60 * ((r - g) / delta + 4);

  return [
    Math.round((hue + 360) % 360),
    Math.round(saturation * 100),
    Math.round(lightness * 100),
  ];
};

export const hslToRgb = ([hue, saturation, lightness]: HslTuple): RgbTuple => {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const l = clamp(lightness, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = l - chroma / 2;
  const sector: RgbTuple =
    h < 60 ? [chroma, x, 0] :
    h < 120 ? [x, chroma, 0] :
    h < 180 ? [0, chroma, x] :
    h < 240 ? [0, x, chroma] :
    h < 300 ? [x, 0, chroma] :
    [chroma, 0, x];

  return sector.map((value) => Math.round((value + match) * 255)) as RgbTuple;
};

export const hslToHex = (hsl: HslTuple): string => rgbToHex(hslToRgb(hsl));

export const getLuminance = (hex: string): number => {
  const [red, green, blue] = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

export const getReadableTextColor = (hex: string): string =>
  getLuminance(hex) > 0.52 ? "#12110f" : "#fbf7ef";

const mixWith = (hex: string, target: RgbTuple, amount: number): string => {
  const source = hexToRgb(hex);
  const ratio = clamp(amount, 0, 1);
  return rgbToHex(source.map((value, index) => value + (target[index] - value) * ratio) as RgbTuple);
};

export const lighten = (hex: string, amount: number): string => mixWith(hex, [255, 255, 255], amount);

export const darken = (hex: string, amount: number): string => mixWith(hex, [0, 0, 0], amount);

export const withAlpha = (hex: string, alpha: number): string => {
  const [red, green, blue] = hexToRgb(hex);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1).toFixed(3)})`;
};
