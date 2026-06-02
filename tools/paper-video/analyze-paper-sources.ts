import fs from "node:fs/promises";
import path from "node:path";
import type {SummaryModeId} from "@paper-to-video/shared-types";
import {summarizePaper} from "../../modules/paper-video/services/summarizer/summarize-paper.service";
import type {LmStudioSummaryConfig} from "../../modules/paper-video/services/summarizer/summarizer.types";
import {SOURCE_BUNDLE_ROOT} from "./lib/run-artifacts";

type SourcePaper = {
  arxivId: string;
  title: string;
  summary: string;
  categories: string[];
  publishedAt: string;
  localPdfPath: string;
  localTextPath?: string;
  suggestedCoverImagePath: string | null;
};

type SourceBundle = {
  generatedAt: string;
  papers: SourcePaper[];
  backgroundImages: Array<{
    id: string;
    localPath: string;
  }>;
};

type AnalysisEntry = SourcePaper & {
  summaryMode: SummaryModeId;
  summaryModel?: string;
  abstractSentences: string[];
  sectionHeadings: string[];
  scriptDraft: {
    hook: string;
    problem: string;
    method: string;
    value: string;
    ending: string;
    bullets: string[];
  };
};

const DEFAULT_INPUT_PATH = path.join(SOURCE_BUNDLE_ROOT, "latest-ai-batch.json");
const DEFAULT_OUTPUT_PATH = path.join(SOURCE_BUNDLE_ROOT, "latest-ai-analysis.json");

const isSummaryModeId = (value: string): value is SummaryModeId => {
  return value === "rule-based" || value === "lm-studio";
};

const parseArgs = (args: string[]) => {
  const take = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  const summaryModeRaw = take("--summary-mode") ?? "rule-based";
  if (!isSummaryModeId(summaryModeRaw)) {
    throw new Error(`Unsupported summary mode: ${summaryModeRaw}`);
  }

  const lmStudioConfig: LmStudioSummaryConfig = {
    baseUrl: take("--lm-studio-base-url") ?? process.env.LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234/v1",
    model: take("--lm-studio-model") ?? process.env.LM_STUDIO_MODEL ?? "google/gemma-4-e4b",
    apiKey: take("--lm-studio-api-key") ?? process.env.LM_STUDIO_API_KEY ?? "lm-studio",
    temperature: Number.parseFloat(take("--lm-studio-temperature") ?? process.env.LM_STUDIO_TEMPERATURE ?? "0.2"),
    maxOutputTokens: Number.parseInt(
      take("--lm-studio-max-output-tokens") ?? process.env.LM_STUDIO_MAX_OUTPUT_TOKENS ?? "2200",
      10,
    ),
    maxInputChars: Number.parseInt(
      take("--lm-studio-max-input-chars") ?? process.env.LM_STUDIO_MAX_INPUT_CHARS ?? "9000",
      10,
    ),
    compactInputChars: Number.parseInt(
      take("--lm-studio-compact-input-chars") ?? process.env.LM_STUDIO_COMPACT_INPUT_CHARS ?? "2600",
      10,
    ),
  };

  return {
    inputPath: take("--input") ? path.resolve(take("--input") as string) : DEFAULT_INPUT_PATH,
    outputPath: take("--output") ? path.resolve(take("--output") as string) : DEFAULT_OUTPUT_PATH,
    summaryMode: summaryModeRaw,
    lmStudioConfig,
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const bundle = JSON.parse(await fs.readFile(options.inputPath, "utf-8")) as SourceBundle;
  const papers: AnalysisEntry[] = [];

  for (const paper of bundle.papers) {
    const rawText = paper.localTextPath ? await fs.readFile(paper.localTextPath, "utf-8") : paper.summary;
    const summary = await summarizePaper({
      paper,
      rawText,
      summaryMode: options.summaryMode,
      lmStudioConfig: options.summaryMode === "lm-studio" ? options.lmStudioConfig : undefined,
    });

    papers.push({
      ...paper,
      summaryMode: summary.summaryMode,
      summaryModel: summary.modelName,
      abstractSentences: summary.abstractSentences,
      sectionHeadings: summary.sectionHeadings,
      scriptDraft: summary.scriptDraft,
    });
  }

  await fs.mkdir(path.dirname(options.outputPath), {recursive: true});
  await fs.writeFile(
    options.outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceBundlePath: options.inputPath,
        summaryMode: options.summaryMode,
        summaryModel: options.summaryMode === "lm-studio" ? options.lmStudioConfig.model : null,
        papers,
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(`Analysis bundle written to ${options.outputPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
