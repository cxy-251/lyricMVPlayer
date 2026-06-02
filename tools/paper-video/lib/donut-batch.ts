import fs from "node:fs/promises";
import path from "node:path";
import type {DonutEffectConfig, ProductionManifest} from "@paper-to-video/shared-types";
import type {VideoBatchRow} from "./video-batch";

const createSeededRandom = (seed: number) => {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const range = (random: () => number, min: number, max: number) => min + (max - min) * random();

const round = (value: number, digits = 2) => Number.parseFloat(value.toFixed(digits));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hashStringToSeed = (value: string) => {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return Math.max(1, hash);
};

const hslToHex = (h: number, s: number, l: number) => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = x;
  } else if (segment >= 1 && segment < 2) {
    red = x;
    green = chroma;
  } else if (segment >= 2 && segment < 3) {
    green = chroma;
    blue = x;
  } else if (segment >= 3 && segment < 4) {
    green = x;
    blue = chroma;
  } else if (segment >= 4 && segment < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = lightness - chroma / 2;
  const toHex = (value: number) => {
    const byte = Math.round((value + match) * 255);
    return byte.toString(16).padStart(2, "0");
  };

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

const buildBrightPalette = (
  random: () => number,
): Pick<DonutEffectConfig, "primaryColor" | "secondaryColor" | "accentColor"> => {
  const baseHue = range(random, 0, 360);
  const hueShiftA = range(random, 95, 150);
  const hueShiftB = range(random, 190, 260);

  return {
    primaryColor: hslToHex(baseHue, range(random, 84, 96), range(random, 70, 78)),
    secondaryColor: hslToHex(baseHue + hueShiftA, range(random, 82, 96), range(random, 70, 80)),
    accentColor: hslToHex(baseHue + hueShiftB, range(random, 88, 100), range(random, 72, 84)),
  };
};

export const buildRandomDonutEffectConfig = (seed: number): Partial<DonutEffectConfig> => {
  const random = createSeededRandom(seed * 97 + 13);
  const palette = buildBrightPalette(random);
  const variants = ["classic", "arcade", "cosmic"] as const;
  const variant = variants[Math.floor(random() * variants.length)] ?? variants[0];

  return {
    variant,
    ringRadius: round(range(random, 0.88, 1.02)),
    tubeRadius: round(range(random, 0.21, 0.29)),
    spinSpeed: round(range(random, 0.72, 1.12)),
    orbitSpeed: round(range(random, 0.64, 0.98)),
    wobbleAmount: round(range(random, 0.1, 0.24)),
    pearlCount: Math.max(4, Math.min(9, Math.round(range(random, 4, 9)))),
    glowIntensity: round(range(random, 0.16, 0.28)),
    ...palette,
  };
};

export const resolveDonutBatchBaseSeed = ({
  batchId,
  explicitSeed,
}: {
  batchId: string;
  explicitSeed?: number;
}) => {
  if (Number.isFinite(explicitSeed)) {
    return explicitSeed as number;
  }

  return hashStringToSeed(batchId);
};

export const applyDonutBatchPreset = ({
  manifest,
  seed,
}: {
  manifest: ProductionManifest;
  seed: number;
}): ProductionManifest => {
  const donutEffect = buildRandomDonutEffectConfig(seed);

  return {
    ...manifest,
    seed,
    effectProfile: {
      id: "donut-spin",
    },
    coverImage: undefined,
    coverProfile: undefined,
    modules: {
      ...manifest.modules,
      donutEffect: {
        ...manifest.modules?.donutEffect,
        ...donutEffect,
      },
    },
    scenes: manifest.scenes.map((scene) => ({
      ...scene,
      backgroundImageLayoutId: "gradient-default",
      backgroundEffectId: "donut-spin",
    })),
  };
};

export const writeDonutBatchManifests = async ({
  manifestDir,
  rows,
}: {
  manifestDir: string;
  rows: Array<Pick<VideoBatchRow, "contentProfileId" | "rowId" | "seed">>;
}) => {
  const updatedPaths: string[] = [];

  for (const [index, row] of rows.entries()) {
    const profileId = row.contentProfileId;
    const seed = row.seed ?? 100 + index;
    const manifestPath = path.join(manifestDir, `${profileId}.json`);
    const raw = await fs.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as ProductionManifest;
    const nextManifest = applyDonutBatchPreset({manifest, seed});
    await fs.writeFile(manifestPath, JSON.stringify(nextManifest, null, 2), "utf-8");
    updatedPaths.push(manifestPath);
  }

  return updatedPaths;
};

export const writeDonutBatchCsv = async ({
  outputPath,
  manifestDir,
  rows,
  voiceName,
  voiceRate,
  voicePitch,
}: {
  outputPath: string;
  manifestDir: string;
  rows: Array<{
    rowId: string;
    contentProfileId: string;
    seed: number;
  }>;
  voiceName: string;
  voiceRate: string;
  voicePitch: string;
}) => {
  const headers = [
    "enabled",
    "row_id",
    "content_profile_id",
    "cover_image_path",
    "cover_profile_id",
    "effect_profile_id",
    "project_id",
    "cover_image_source",
    "seed",
    "voice_name",
    "voice_rate",
    "voice_pitch",
    "base_manifest_path",
  ];

  const lines = [
    `# ${headers.join(",")}`,
    ...rows.map((row) =>
      [
        "true",
        row.rowId,
        row.contentProfileId,
        "",
        "",
        "donut-spin",
        "",
        "",
        String(row.seed),
        voiceName,
        voiceRate,
        voicePitch,
        path.relative(path.resolve("."), path.join(manifestDir, `${row.contentProfileId}.json`)),
      ].join(","),
    ),
  ];

  await fs.mkdir(path.dirname(outputPath), {recursive: true});
  await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf-8");
};
