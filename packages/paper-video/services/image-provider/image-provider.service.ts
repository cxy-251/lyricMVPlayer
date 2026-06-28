import fs from "node:fs/promises";
import path from "node:path";
import type {BackgroundImageSelection, CoverSelectionModeId} from "./image-provider.types";

const IMAGE_FILE_PATTERN = /\.(png|jpg|jpeg|webp|svg)$/i;

export const SUPPORTED_COVER_SELECTION_MODES: CoverSelectionModeId[] = [
  "none",
  "local-folder-random",
  "local-folder-cycle",
  "ai-generated-cover",
  "licensed-source",
];

export const isCoverSelectionModeId = (value: string): value is CoverSelectionModeId => {
  return SUPPORTED_COVER_SELECTION_MODES.includes(value as CoverSelectionModeId);
};

export const collectImageFiles = async (rootDir: string): Promise<string[]> => {
  const entries = await fs.readdir(rootDir, {withFileTypes: true});
  const files: string[] = [];

  for (const entry of entries) {
    const resolved = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectImageFiles(resolved)));
      continue;
    }

    if (IMAGE_FILE_PATTERN.test(entry.name)) {
      files.push(resolved);
    }
  }

  return files.sort();
};

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

const shuffleWithSeed = <T,>(items: T[], seed: number) => {
  const random = createSeededRandom(seed);
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }

  return clone;
};

const assignFromLocalFolder = async ({
  backgroundDir,
  seed,
  mode,
}: {
  backgroundDir: string;
  seed: number;
  mode: Extract<CoverSelectionModeId, "local-folder-random" | "local-folder-cycle">;
}): Promise<BackgroundImageSelection> => {
  const imagePaths = await collectImageFiles(backgroundDir);
  if (imagePaths.length === 0) {
    throw new Error(`No images were found in background directory: ${backgroundDir}`);
  }

  const resolvedPaths = mode === "local-folder-random" ? shuffleWithSeed(imagePaths, seed) : imagePaths;

  return {
    mode,
    sourceDir: backgroundDir,
    backgroundImages: resolvedPaths.map((localPath, index) => ({
      id: `bg-${String(index + 1).padStart(2, "0")}`,
      localPath,
    })),
  };
};

export const resolveBackgroundImageSelection = async ({
  backgroundDir,
  seed,
  mode,
}: {
  backgroundDir?: string;
  seed: number;
  mode: CoverSelectionModeId;
}): Promise<BackgroundImageSelection> => {
  if (mode === "none") {
    return {
      mode,
      sourceDir: null,
      backgroundImages: [],
    };
  }

  if (mode === "local-folder-random" || mode === "local-folder-cycle") {
    if (!backgroundDir) {
      throw new Error(`cover selection mode "${mode}" requires a background directory.`);
    }
    return assignFromLocalFolder({backgroundDir, seed, mode});
  }

  if (mode === "ai-generated-cover") {
    throw new Error(
      "cover selection mode \"ai-generated-cover\" is reserved for a future provider integration and is not implemented yet.",
    );
  }

  throw new Error(
    "cover selection mode \"licensed-source\" is reserved for a future licensed asset provider integration and is not implemented yet.",
  );
};
