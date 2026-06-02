import fs from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";
import {VIDEO_BATCH_CONFIG_ROOT} from "./lib/run-artifacts";

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
    category: take("--category") ?? "cs.AI",
    limit: Number.parseInt(take("--limit") ?? "3", 10),
    backgroundDir: take("--background-dir") ? path.resolve(take("--background-dir") as string) : undefined,
    coverSelectionMode: take("--cover-selection-mode") ?? "local-folder-random",
    batchOutput: take("--batch-output")
      ? path.resolve(take("--batch-output") as string)
      : path.join(VIDEO_BATCH_CONFIG_ROOT, "latest-ai-batch.csv"),
    effectCycle: take("--effect-cycle") ?? "life-game,snake-grid,particle-orbit,lights-beams,rubiks-solver",
    summaryMode: take("--summary-mode") ?? "rule-based",
    lmStudioBaseUrl: take("--lm-studio-base-url"),
    lmStudioModel: take("--lm-studio-model"),
    lmStudioApiKey: take("--lm-studio-api-key"),
    lmStudioTemperature: take("--lm-studio-temperature"),
    lmStudioMaxOutputTokens: take("--lm-studio-max-output-tokens"),
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  const fetchedRaw = await runWithCapture("node", [
    "--import",
    "tsx",
    "tools/fetch-arxiv-ai.ts",
    "--category",
    options.category,
    "--limit",
    String(options.limit),
    "--download-pdf",
  ]);
  const fetchedPapers = JSON.parse(fetchedRaw) as FetchedPaper[];

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

  const fetchedIds = fetchedPapers.map((paper) => paper.arxivId).join(",");
  await run("node", [
    "--import",
    "tsx",
    "tools/build-source-bundle.ts",
    "--paper-ids",
    fetchedIds,
    ...(options.backgroundDir ? ["--background-dir", options.backgroundDir] : []),
    "--cover-selection-mode",
    options.coverSelectionMode,
  ]);
  await run("node", [
    "--import",
    "tsx",
    "tools/analyze-paper-sources.ts",
    "--summary-mode",
    options.summaryMode,
    ...(options.lmStudioBaseUrl ? ["--lm-studio-base-url", options.lmStudioBaseUrl] : []),
    ...(options.lmStudioModel ? ["--lm-studio-model", options.lmStudioModel] : []),
    ...(options.lmStudioApiKey ? ["--lm-studio-api-key", options.lmStudioApiKey] : []),
    ...(options.lmStudioTemperature ? ["--lm-studio-temperature", options.lmStudioTemperature] : []),
    ...(options.lmStudioMaxOutputTokens ? ["--lm-studio-max-output-tokens", options.lmStudioMaxOutputTokens] : []),
  ]);
  await run("node", ["--import", "tsx", "tools/scaffold-paper-manifests.ts"]);
  await run("node", [
    "--import",
    "tsx",
    "tools/build-video-batch.ts",
    "--output",
    options.batchOutput,
    "--effect-cycle",
    options.effectCycle,
  ]);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
