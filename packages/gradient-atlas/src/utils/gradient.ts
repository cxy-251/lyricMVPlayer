import type {CSSProperties} from "react";
import type {GradientPreset} from "../data/gradients";

export type HslColor = {
  h: number;
  s: number;
  l: number;
};

export const gradientDirections = ["to right", "to left", "to bottom", "135deg", "radial"] as const;

export type GradientDirection = (typeof gradientDirections)[number];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeHex = (hex: string): string => {
  const clean = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return `#${clean.split("").map((char) => char + char).join("")}`.toUpperCase();
  }

  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean}`.toUpperCase();
  }

  return "#111827";
};

const hexToRgb = (hex: string): {r: number; g: number; b: number} => {
  const normalized = normalizeHex(hex).replace(/^#/, "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

const relativeLuminance = (hex: string): number => {
  const {r, g, b} = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

export const hexToHsl = (hex: string): HslColor => {
  const {r, g, b} = hexToRgb(hex);
  const rUnit = r / 255;
  const gUnit = g / 255;
  const bUnit = b / 255;
  const max = Math.max(rUnit, gUnit, bUnit);
  const min = Math.min(rUnit, gUnit, bUnit);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    switch (max) {
      case rUnit:
        hue = 60 * (((gUnit - bUnit) / delta) % 6);
        break;
      case gUnit:
        hue = 60 * ((bUnit - rUnit) / delta + 2);
        break;
      default:
        hue = 60 * ((rUnit - gUnit) / delta + 4);
        break;
    }
  }

  return {
    h: Math.round((hue + 360) % 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
};

export const getContrastColor = (hex: string): string => (
  relativeLuminance(hex) > 0.48 ? "#0B1020" : "#FFFFFF"
);

export const isGradientDark = (colors: string[]): boolean => {
  const luminance = colors.reduce((sum, color) => sum + relativeLuminance(color), 0) / Math.max(colors.length, 1);
  return luminance < 0.42;
};

export const getAverageHsl = (colors: string[]): HslColor => {
  const hsl = colors.map(hexToHsl);
  const total = hsl.reduce(
    (acc, color) => ({
      h: acc.h + color.h,
      s: acc.s + color.s,
      l: acc.l + color.l,
    }),
    {h: 0, s: 0, l: 0},
  );
  const count = Math.max(hsl.length, 1);

  return {
    h: Math.round(total.h / count),
    s: Math.round(total.s / count),
    l: Math.round(total.l / count),
  };
};

export const toCssGradient = (preset: GradientPreset, direction = preset.direction): string => {
  const colorStops = preset.colors.join(", ");
  if (direction === "radial") {
    return `radial-gradient(circle at 28% 22%, ${colorStops})`;
  }

  return `linear-gradient(${direction}, ${colorStops})`;
};

export const toFallbackCss = (preset: GradientPreset, direction = preset.direction): string => [
  `background-color: ${preset.colors[0]};`,
  `background-image: ${toCssGradient(preset, direction)};`,
].join("\n");

export const toTailwindConfig = (preset: GradientPreset, direction = preset.direction): string => {
  const token = preset.id.replace(/[^a-z0-9-]/g, "-");
  return [
    "export default {",
    "  theme: {",
    "    extend: {",
    "      backgroundImage: {",
    `        "${token}": "${toCssGradient(preset, direction)}",`,
    "      },",
    "    },",
    "  },",
    "};",
  ].join("\n");
};

export const toCssVariables = (preset: GradientPreset, direction = preset.direction): string => {
  const lines = preset.colors.map((color, index) => `  --gradient-atlas-color-${index + 1}: ${color};`);
  return [
    ":root {",
    ...lines,
    `  --gradient-atlas-direction: ${direction};`,
    `  --gradient-atlas: ${toCssGradient(preset, direction)};`,
    "}",
  ].join("\n");
};

export const toReactStyle = (preset: GradientPreset, direction = preset.direction): string => [
  "const gradientStyle: React.CSSProperties = {",
  `  backgroundImage: "${toCssGradient(preset, direction)}",`,
  `  backgroundColor: "${preset.colors[0]}",`,
  "};",
].join("\n");

export const toJsonSnippet = (preset: GradientPreset, direction = preset.direction): string => JSON.stringify(
  {
    ...preset,
    direction,
  },
  null,
  2,
);

const hueTag = (hue: number): string => {
  if (hue < 18 || hue >= 345) return "red";
  if (hue < 45) return "orange";
  if (hue < 75) return "yellow";
  if (hue < 145) return "green";
  if (hue < 175) return "mint";
  if (hue < 200) return "cyan";
  if (hue < 245) return "blue";
  if (hue < 285) return "purple";
  if (hue < 330) return "pink";
  return "rose";
};

const isWarmHue = (hue: number) => hue < 75 || hue >= 330;
const isCoolHue = (hue: number) => hue >= 145 && hue < 285;

export const generateTags = (colors: string[]): string[] => {
  const hsl = colors.map(hexToHsl);
  const tags = new Set<string>();

  hsl.forEach((color) => tags.add(hueTag(color.h)));

  const avgSaturation = hsl.reduce((sum, color) => sum + color.s, 0) / Math.max(hsl.length, 1);
  const avgLightness = hsl.reduce((sum, color) => sum + color.l, 0) / Math.max(hsl.length, 1);
  const hasWarm = hsl.some((color) => isWarmHue(color.h));
  const hasCool = hsl.some((color) => isCoolHue(color.h));
  const hasBlueGreen = hsl.some((color) => color.h >= 160 && color.h < 245);
  const hasOrangePink = hsl.some((color) => color.h < 45 || color.h >= 300);

  if (avgLightness > 74 && avgSaturation < 70) tags.add("pastel");
  if (avgSaturation > 68 && avgLightness > 38) tags.add("neon");
  if (avgLightness < 34) tags.add("dark");
  if (avgLightness > 76) tags.add("light");
  if (hasWarm) tags.add("warm");
  if (hasCool) tags.add("cold");
  if (hasWarm && hasCool) tags.add("warm-cold");
  if (hasBlueGreen) tags.add("ocean");
  if (hasOrangePink && hasWarm) tags.add("sunset");
  if (avgSaturation > 62 && avgLightness < 48 && hasCool) tags.add("cyberpunk");
  if (avgSaturation > 40 && avgLightness > 28 && avgLightness < 76) tags.add("brand");
  tags.add("background");

  return Array.from(tags).slice(0, 9);
};

export const parseHexList = (value: string): string[] => value
  .split(/[,\s]+/)
  .map((item) => item.trim())
  .filter(Boolean)
  .map(normalizeHex)
  .filter((item, index, all) => /^#[0-9A-F]{6}$/.test(item) && all.indexOf(item) === index)
  .slice(0, 5);

export const createGradientId = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${slug || "custom-gradient"}-${Date.now().toString(36)}`;
};

export const getGradientSurfaceVars = (colors: string[]): CSSProperties => {
  const dark = isGradientDark(colors);
  const average = getAverageHsl(colors);
  const accent = colors[Math.min(1, colors.length - 1)] ?? colors[0] ?? "#7DD3FC";

  return {
    "--atlas-ink": dark ? "rgba(255,255,255,0.94)" : "rgba(11,16,32,0.92)",
    "--atlas-muted": dark ? "rgba(255,255,255,0.62)" : "rgba(11,16,32,0.62)",
    "--atlas-faint": dark ? "rgba(255,255,255,0.1)" : "rgba(11,16,32,0.1)",
    "--atlas-panel": dark ? "rgba(8,10,18,0.45)" : "rgba(255,255,255,0.46)",
    "--atlas-panel-strong": dark ? "rgba(8,10,18,0.68)" : "rgba(255,255,255,0.72)",
    "--atlas-border": dark ? "rgba(255,255,255,0.18)" : "rgba(11,16,32,0.16)",
    "--atlas-shadow": dark ? "rgba(0,0,0,0.32)" : "rgba(43,45,66,0.18)",
    "--atlas-accent": accent,
    "--atlas-glow": `hsla(${clamp(average.h + 24, 0, 360)}, ${clamp(average.s + 8, 34, 88)}%, ${clamp(average.l + 10, 38, 78)}%, 0.32)`,
  } as CSSProperties;
};
