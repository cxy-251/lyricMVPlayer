import fs from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";
import {buildPaperUrlBatchPaths, makePaperUrlBatchId, readPaperUrlFile, resolveDefaultBackgroundDir} from "./lib/paper-url-batch";

type FetchedPaper = {
  arxivId: string;
  localPdfPath?: string;
};

const run = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {stdio: "inherit"});
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });

const runWithCapture = (command: string, args: string[]) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {stdio: ["ignore", "pipe", "inherit"]});
    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });

const parseArgs = (args: string[]) => {
  const take = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    paperUrls: args
      .flatMap((arg, index) => (arg === "--paper-url" ? [args[index + 1]] : []))
      .map((value) => value?.trim())
      .filter(Boolean) as string[],
    paperUrlFile: take("--paper-url-file") ? path.resolve(take("--paper-url-file") as string) : undefined,
    backgroundDir: take("--background-dir") ? path.resolve(take("--background-dir") as string) : undefined,
    coverSelectionMode: take("--cover-selection-mode") ?? "local-folder-random",
    effectPool: take("--effect-pool") ?? "life-game,snake-grid,particle-orbit,lights-beams,rubiks-solver",
    seed: Number.parseInt(take("--seed") ?? "42", 10),
    voiceName: take("--voice-name") ?? "zh-CN-XiaoxiaoNeural",
    voiceRate: take("--voice-rate") ?? "+80%",
    voicePitch: take("--voice-pitch") ?? "+0Hz",
    summaryMode: take("--summary-mode") ?? "rule-based",
    lmStudioBaseUrl: take("--lm-studio-base-url"),
    lmStudioModel: take("--lm-studio-model"),
    lmStudioApiKey: take("--lm-studio-api-key"),
    lmStudioTemperature: take("--lm-studio-temperature"),
    lmStudioMaxOutputTokens: take("--lm-studio-max-output-tokens"),
    batchId: take("--batch-id"),
    mockMode: args.includes("--mock"),
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const fileUrls = options.paperUrlFile ? await readPaperUrlFile(options.paperUrlFile) : [];
  const paperUrls = [...options.paperUrls, ...fileUrls];

  if (paperUrls.length === 0) {
    throw new Error("Please provide --paper-url <url> or --paper-url-file <file>");
  }

  const batchId = options.batchId ?? makePaperUrlBatchId(paperUrls.length === 1 ? "paper-url-single" : "paper-url-batch");
  const paths = buildPaperUrlBatchPaths(batchId);
  const backgroundDir = options.backgroundDir ?? await resolveDefaultBackgroundDir();

  const fetchedRaw = await runWithCapture("node", [
    "--import",
    "tsx",
    "tools/fetch-arxiv-ai.ts",
    ...paperUrls.flatMap((paperUrl) => ["--paper-url", paperUrl]),
    "--download-pdf",
  ]);
  const fetchedPapers = JSON.parse(fetchedRaw) as FetchedPaper[];
  const fetchedIds = fetchedPapers.map((paper) => paper.arxivId).join(",");

  for (const paper of fetchedPapers) {
    if (!paper.localPdfPath) {
      continue;
    }

    const inputPdf = path.resolve(paper.localPdfPath);
    const outputText = path.join(path.dirname(inputPdf), "source.txt");
    try {
      await fs.access(outputText);
    } catch {
      await run("node", [
        "--import",
        "tsx",
        "tools/extract-pdf-text.ts",
        "--input-pdf",
        inputPdf,
        "--output-text",
        outputText,
      ]);
    }
  }

  await run("node", [
    "--import",
    "tsx",
    "tools/build-source-bundle.ts",
    "--paper-ids",
    fetchedIds,
    "--output",
    paths.sourceBundlePath,
    "--background-dir",
    backgroundDir,
    "--cover-selection-mode",
    options.coverSelectionMode,
    "--seed",
    String(options.seed),
  ]);

  await run("node", [
    "--import",
    "tsx",
    "tools/analyze-paper-sources.ts",
    "--input",
    paths.sourceBundlePath,
    "--output",
    paths.analysisBundlePath,
    "--summary-mode",
    options.summaryMode,
    ...(options.lmStudioBaseUrl ? ["--lm-studio-base-url", options.lmStudioBaseUrl] : []),
    ...(options.lmStudioModel ? ["--lm-studio-model", options.lmStudioModel] : []),
    ...(options.lmStudioApiKey ? ["--lm-studio-api-key", options.lmStudioApiKey] : []),
    ...(options.lmStudioTemperature ? ["--lm-studio-temperature", options.lmStudioTemperature] : []),
    ...(options.lmStudioMaxOutputTokens ? ["--lm-studio-max-output-tokens", options.lmStudioMaxOutputTokens] : []),
  ]);

  await run("node", [
    "--import",
    "tsx",
    "tools/scaffold-paper-manifests.ts",
    "--input",
    paths.analysisBundlePath,
    "--output-dir",
    paths.manifestDir,
  ]);

  await run("node", [
    "--import",
    "tsx",
    "tools/build-video-batch.ts",
    "--input",
    paths.analysisBundlePath,
    "--output",
    paths.batchCsvPath,
    "--base-manifest-dir",
    paths.manifestDir,
    "--effect-mode",
    "random",
    "--effect-pool",
    options.effectPool,
    "--voice-name",
    options.voiceName,
    "--voice-rate",
    options.voiceRate,
    "--voice-pitch",
    options.voicePitch,
    "--seed-start",
    String(options.seed),
  ]);

  await run("node", [
    "--import",
    "tsx",
    "tools/produce-video.ts",
    "--batch-config",
    paths.batchCsvPath,
    ...(options.mockMode ? ["--mock"] : []),
  ]);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
