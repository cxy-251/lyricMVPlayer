import fs from "node:fs/promises";
import path from "node:path";
import {resolveDefaultBackgroundDir} from "./lib/paper-url-batch";
import {PAPER_CACHE_ROOT, SOURCE_BUNDLE_ROOT} from "./lib/run-artifacts";
import {
  isCoverSelectionModeId,
  resolveBackgroundImageSelection,
} from "../../modules/paper-video/services/image-provider/image-provider.service";
import type {CoverSelectionModeId} from "../../modules/paper-video/services/image-provider/image-provider.types";

type PaperMetadata = {
  arxivId: string;
  title: string;
  summary: string;
  authors: string[];
  categories: string[];
  pdfUrl: string;
  publishedAt: string;
  updatedAt: string;
  localPdfPath: string;
};

type SourceBundle = {
  generatedAt: string;
  coverSelection: {
    mode: CoverSelectionModeId;
    sourceDir: string | null;
  };
  papers: Array<
    PaperMetadata & {
      localTextPath?: string;
      textExtracted: boolean;
      suggestedCoverImagePath: string | null;
    }
  >;
  backgroundImages: Array<{
    id: string;
    localPath: string;
  }>;
};

const OUTPUT_PATH = path.join(SOURCE_BUNDLE_ROOT, "latest-ai-batch.json");

const readJson = async <T,>(targetPath: string) =>
  JSON.parse(await fs.readFile(targetPath, "utf-8")) as T;

const parseArgs = (args: string[]) => {
  const take = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  const paperIds = (take("--paper-ids") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    paperIds: paperIds.length > 0 ? new Set(paperIds) : null,
    output: take("--output") ? path.resolve(take("--output") as string) : OUTPUT_PATH,
    backgroundDir: take("--background-dir") ? path.resolve(take("--background-dir") as string) : undefined,
    coverSelectionMode: take("--cover-selection-mode") ?? "local-folder-random",
    seed: Number.parseInt(take("--seed") ?? "42", 10),
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (!isCoverSelectionModeId(options.coverSelectionMode)) {
    throw new Error(`Unsupported cover selection mode: ${options.coverSelectionMode}`);
  }

  const paperDirs = (await fs.readdir(PAPER_CACHE_ROOT, {withFileTypes: true}))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(PAPER_CACHE_ROOT, entry.name))
    .sort();

  const backgroundDir =
    options.coverSelectionMode === "none"
      ? undefined
      : options.backgroundDir ?? await resolveDefaultBackgroundDir();
  const coverSelection = await resolveBackgroundImageSelection({
    backgroundDir,
    seed: options.seed,
    mode: options.coverSelectionMode,
  });
  const backgroundImages = coverSelection.backgroundImages;

  const papers = await Promise.all(
    paperDirs.map(async (paperDir, index) => {
      const metadata = await readJson<PaperMetadata>(path.join(paperDir, "metadata.json"));
      const localTextPath = path.join(paperDir, "source.txt");
      let textExtracted = true;
      try {
        await fs.access(localTextPath);
      } catch {
        textExtracted = false;
      }

      return {
        ...metadata,
        localTextPath: textExtracted ? localTextPath : undefined,
        textExtracted,
        suggestedCoverImagePath: backgroundImages[index % Math.max(1, backgroundImages.length)]?.localPath ?? null,
      };
    }),
  );

  const filteredPapers = options.paperIds
    ? papers.filter((paper) => options.paperIds?.has(paper.arxivId))
    : papers;

  const bundle: SourceBundle = {
    generatedAt: new Date().toISOString(),
    coverSelection: {
      mode: coverSelection.mode,
      sourceDir: coverSelection.sourceDir,
    },
    papers: filteredPapers,
    backgroundImages,
  };

  await fs.mkdir(path.dirname(options.output), {recursive: true});
  await fs.writeFile(options.output, JSON.stringify(bundle, null, 2), "utf-8");
  console.log(`Source bundle written to ${options.output}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
