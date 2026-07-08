import {
  hslToHex,
  hslToRgb,
  rgbToCmyk,
  type CmykTuple,
  type HslTuple,
  type RgbTuple,
} from "../utils/color-convert";

export type SpectrumFamily =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "neutral";

export type SpectrumColor = {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  pinyin?: string;
  hex: string;
  rgb: RgbTuple;
  cmyk: CmykTuple;
  hsl: HslTuple;
  family: SpectrumFamily;
  index: number;
  source?: string;
};

type FamilySeed = {
  family: SpectrumFamily;
  slug: string;
  han: string;
  pinyin: string;
  label: string;
  hue: [number, number];
  saturation: [number, number];
  lightness: [number, number];
};

type ToneSeed = {
  han: string;
  pinyin: string;
  label: string;
  slug: string;
};

const tones: ToneSeed[] = [
  {han: "晓", pinyin: "xiao", label: "Dawn", slug: "dawn"},
  {han: "薄", pinyin: "bo", label: "Veil", slug: "veil"},
  {han: "晴", pinyin: "qing", label: "Clear", slug: "clear"},
  {han: "霁", pinyin: "ji", label: "After Rain", slug: "after-rain"},
  {han: "烟", pinyin: "yan", label: "Mist", slug: "mist"},
  {han: "岚", pinyin: "lan", label: "Haze", slug: "haze"},
  {han: "露", pinyin: "lu", label: "Dew", slug: "dew"},
  {han: "月", pinyin: "yue", label: "Moon", slug: "moon"},
  {han: "绢", pinyin: "juan", label: "Silk", slug: "silk"},
  {han: "砚", pinyin: "yan", label: "Inkstone", slug: "inkstone"},
  {han: "庭", pinyin: "ting", label: "Court", slug: "court"},
  {han: "山", pinyin: "shan", label: "Mountain", slug: "mountain"},
  {han: "檐", pinyin: "yan", label: "Eave", slug: "eave"},
  {han: "松", pinyin: "song", label: "Pine", slug: "pine"},
  {han: "竹", pinyin: "zhu", label: "Bamboo", slug: "bamboo"},
  {han: "莲", pinyin: "lian", label: "Lotus", slug: "lotus"},
  {han: "梅", pinyin: "mei", label: "Plum", slug: "plum"},
  {han: "棠", pinyin: "tang", label: "Begonia", slug: "begonia"},
  {han: "锦", pinyin: "jin", label: "Brocade", slug: "brocade"},
  {han: "灯", pinyin: "deng", label: "Lantern", slug: "lantern"},
  {han: "炉", pinyin: "lu", label: "Kiln", slug: "kiln"},
  {han: "酥", pinyin: "su", label: "Soft", slug: "soft"},
  {han: "墨", pinyin: "mo", label: "Ink", slug: "ink"},
  {han: "玄", pinyin: "xuan", label: "Deep", slug: "deep"},
];

const families: FamilySeed[] = [
  {
    family: "red",
    slug: "red",
    han: "绯",
    pinyin: "fei",
    label: "Red",
    hue: [350, 12],
    saturation: [58, 90],
    lightness: [30, 72],
  },
  {
    family: "orange",
    slug: "orange",
    han: "橙",
    pinyin: "cheng",
    label: "Orange",
    hue: [18, 34],
    saturation: [62, 92],
    lightness: [34, 74],
  },
  {
    family: "yellow",
    slug: "yellow",
    han: "黄",
    pinyin: "huang",
    label: "Yellow",
    hue: [42, 58],
    saturation: [56, 94],
    lightness: [42, 82],
  },
  {
    family: "green",
    slug: "green",
    han: "绿",
    pinyin: "lv",
    label: "Green",
    hue: [82, 138],
    saturation: [38, 78],
    lightness: [26, 70],
  },
  {
    family: "cyan",
    slug: "cyan",
    han: "青",
    pinyin: "qing",
    label: "Cyan",
    hue: [158, 188],
    saturation: [36, 82],
    lightness: [28, 72],
  },
  {
    family: "blue",
    slug: "blue",
    han: "蓝",
    pinyin: "lan",
    label: "Blue",
    hue: [198, 236],
    saturation: [42, 86],
    lightness: [28, 72],
  },
  {
    family: "purple",
    slug: "purple",
    han: "紫",
    pinyin: "zi",
    label: "Purple",
    hue: [260, 292],
    saturation: [36, 82],
    lightness: [28, 70],
  },
  {
    family: "pink",
    slug: "pink",
    han: "粉",
    pinyin: "fen",
    label: "Pink",
    hue: [318, 342],
    saturation: [38, 82],
    lightness: [42, 80],
  },
  {
    family: "brown",
    slug: "brown",
    han: "褐",
    pinyin: "he",
    label: "Brown",
    hue: [20, 42],
    saturation: [24, 58],
    lightness: [18, 58],
  },
  {
    family: "neutral",
    slug: "neutral",
    han: "灰",
    pinyin: "hui",
    label: "Neutral",
    hue: [30, 220],
    saturation: [2, 18],
    lightness: [8, 94],
  },
];

const interpolate = ([from, to]: [number, number], progress: number): number => from + (to - from) * progress;

const hueInterpolate = ([from, to]: [number, number], progress: number): number => {
  const span = to < from ? to + 360 - from : to - from;
  return (from + span * progress) % 360;
};

const makeColor = (familySeed: FamilySeed, tone: ToneSeed, localIndex: number, globalIndex: number): SpectrumColor => {
  if (familySeed.family === "yellow" && localIndex === 0) {
    const hsl: HslTuple = [46, 91, 69];
    const rgb = hslToRgb(hsl);
    return {
      id: "kuishan-yellow",
      name: "葵扇黄",
      displayName: "Kuisan Yellow",
      slug: "kuishan-yellow",
      pinyin: "kuishanhuang",
      hex: "#f8d86a",
      rgb,
      cmyk: rgbToCmyk(rgb),
      hsl,
      family: "yellow",
      index: globalIndex,
      source: "built-in spectrum seed",
    };
  }

  const progress = localIndex / Math.max(tones.length - 1, 1);
  const wave = Math.sin((localIndex + 1) * 1.73) * 0.5 + 0.5;
  const inverseWave = Math.cos((localIndex + 2) * 1.17) * 0.5 + 0.5;
  const hue = Math.round(hueInterpolate(familySeed.hue, progress));
  const saturation = Math.round(interpolate(familySeed.saturation, familySeed.saturation[0] > familySeed.saturation[1] ? progress : wave));
  const lightness = Math.round(interpolate(familySeed.lightness, inverseWave));
  const hsl: HslTuple =
    familySeed.family === "neutral"
      ? [
          Math.round(hueInterpolate(familySeed.hue, progress)),
          Math.round(interpolate(familySeed.saturation, wave)),
          Math.round(interpolate(familySeed.lightness, progress)),
        ]
      : [hue, saturation, lightness];
  const rgb = hslToRgb(hsl);
  const slug = `${tone.slug}-${familySeed.slug}`;

  return {
    id: slug,
    name: `${tone.han}${familySeed.han}`,
    displayName: `${tone.label} ${familySeed.label}`,
    slug,
    pinyin: `${tone.pinyin}${familySeed.pinyin}`,
    hex: hslToHex(hsl),
    rgb,
    cmyk: rgbToCmyk(rgb),
    hsl,
    family: familySeed.family,
    index: globalIndex,
    source: "built-in spectrum seed",
  };
};

export const spectrumColors: SpectrumColor[] = families.flatMap((familySeed, familyIndex) =>
  tones.map((tone, localIndex) => makeColor(familySeed, tone, localIndex, familyIndex * tones.length + localIndex)),
);

export const spectrumColorBySlug = new Map(spectrumColors.map((color) => [color.slug, color]));

export const defaultSpectrumColor = spectrumColorBySlug.get("kuishan-yellow") ?? spectrumColors[0];
