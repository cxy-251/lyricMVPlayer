import fs from "node:fs/promises";
import path from "node:path";
import {pickOneWithSeed} from "./lib/deterministic-random";
import {SUPPORTED_EFFECT_PROFILE_IDS, isSupportedEffectProfileId} from "./lib/effect-profiles";
import {
  INGEST_MANIFEST_ROOT,
  SOURCE_BUNDLE_ROOT,
  VIDEO_BATCH_CONFIG_ROOT,
} from "./lib/run-artifacts";

type AnalysisBundle = {
  papers: Array<{
    arxivId: string;
    suggestedCoverImagePath?: string | null;
  }>;
};

const DEFAULT_ANALYSIS_PATH = path.join(SOURCE_BUNDLE_ROOT, "latest-ai-analysis.json");
const DEFAULT_OUTPUT_PATH = path.join(VIDEO_BATCH_CONFIG_ROOT, "latest-ai-batch.csv");
const DEFAULT_BASE_MANIFEST_DIR = INGEST_MANIFEST_ROOT;

const parseArgs = (args: string[]) => {
  const take = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    input: take("--input") ? path.resolve(take("--input") as string) : DEFAULT_ANALYSIS_PATH,
    output: take("--output") ? path.resolve(take("--output") as string) : DEFAULT_OUTPUT_PATH,
    baseManifestDir: take("--base-manifest-dir")
      ? path.resolve(take("--base-manifest-dir") as string)
      : DEFAULT_BASE_MANIFEST_DIR,
    effectCycle: (take("--effect-cycle") ?? "life-game").split(",").map((item) => item.trim()).filter(Boolean),
    effectMode: take("--effect-mode") ?? "cycle",
    effectPool: (take("--effect-pool") ?? SUPPORTED_EFFECT_PROFILE_IDS.join(","))
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    voiceName: take("--voice-name") ?? "zh-CN-XiaoxiaoNeural",
    voiceRate: take("--voice-rate") ?? "+80%",
    voicePitch: take("--voice-pitch") ?? "+0Hz",
    seedStart: Number.parseInt(take("--seed-start") ?? "100", 10),
  };
};

const toProfileId = (arxivId: string) => `arxiv-${arxivId.replace(/[^\w]+/g, "-").toLowerCase()}`;

const toManifestPath = (baseManifestDir: string, profileId: string) =>
  path.relative(path.resolve("."), path.join(baseManifestDir, `${profileId}.json`));

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const raw = await fs.readFile(options.input, "utf-8");
  const bundle = JSON.parse(raw) as AnalysisBundle;
  const supportedEffectPool = options.effectPool.filter(isSupportedEffectProfileId);

  if (supportedEffectPool.length === 0) {
    throw new Error("No supported effect ids were provided in --effect-pool");
  }

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
    ...bundle.papers.map((paper, index) => {
      const profileId = toProfileId(paper.arxivId);
      const effectProfileId =
        options.effectMode === "random"
          ? pickOneWithSeed(supportedEffectPool, options.seedStart + index) ?? "life-game"
          : (options.effectCycle[index % options.effectCycle.length] ?? "life-game");
      return [
        "true",
        paper.arxivId,
        profileId,
        paper.suggestedCoverImagePath ?? "",
        "",
        effectProfileId,
        "",
        paper.suggestedCoverImagePath ? "local" : "",
        String(options.seedStart + index),
        options.voiceName,
        options.voiceRate,
        options.voicePitch,
        toManifestPath(options.baseManifestDir, profileId),
      ].join(",");
    }),
  ];

  await fs.mkdir(path.dirname(options.output), {recursive: true});
  await fs.writeFile(options.output, `${lines.join("\n")}\n`, "utf-8");

  console.log(`Video batch config written to ${options.output}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
