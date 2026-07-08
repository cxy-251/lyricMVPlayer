import type {SpectrumColor} from "../data/spectrum-colors";

export const toRgbString = (color: SpectrumColor): string => `rgb(${color.rgb.join(", ")})`;

export const toCmykString = (color: SpectrumColor): string => `cmyk(${color.cmyk.join(", ")}%)`;

export const toHslString = (color: SpectrumColor): string =>
  `hsl(${color.hsl[0]} ${color.hsl[1]}% ${color.hsl[2]}%)`;

export const toCssVariable = (color: SpectrumColor): string => `--spectrum-${color.slug}: ${color.hex};`;

export const toTailwindToken = (color: SpectrumColor): string =>
  JSON.stringify({[color.slug]: color.hex}, null, 2);

export const toJsonSnippet = (color: SpectrumColor): string =>
  JSON.stringify(
    {
      name: color.name,
      displayName: color.displayName,
      hex: color.hex,
      rgb: color.rgb,
      cmyk: color.cmyk,
      hsl: color.hsl,
      family: color.family,
    },
    null,
    2,
  );
