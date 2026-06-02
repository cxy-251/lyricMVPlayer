import path from "node:path";
import {spawn} from "node:child_process";
import {
  buildPaperUrlBatchPaths,
  makePaperUrlBatchId,
  type PaperUrlRecord,
  type PaperUrlStatus,
  readPaperUrlCsvRecords,
  writePaperUrlCsvRecords,
} from "./lib/paper-url-batch";
import {SOURCE_BUNDLE_ROOT} from "./lib/run-artifacts";
import {
  resolveDonutBatchBaseSeed,
  writeDonutBatchCsv,
  writeDonutBatchManifests,
} from "./lib/donut-batch";

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

  const paperUrlCsv = take("--paper-url-csv");
  if (!paperUrlCsv) {
    throw new Error("Missing required argument: --paper-url-csv <csv-file>");
  }

  return {
    paperUrlCsv: path.resolve(paperUrlCsv),
    summaryMode: take("--summary-mode") ?? "lm-studio",
    lmStudioBaseUrl: take("--lm-studio-base-url"),
    lmStudioModel: take("--lm-studio-model"),
    lmStudioApiKey: take("--lm-studio-api-key"),
    lmStudioTemperature: take("--lm-studio-temperature"),
    lmStudioMaxOutputTokens: take("--lm-studio-max-output-tokens"),
    batchId: take("--batch-id"),
    seed: take("--seed") ? Number.parseInt(take("--seed") as string, 10) : undefined,
    voiceName: take("--voice-name") ?? "zh-CN-XiaoxiaoNeural",
    voiceRate: take("--voice-rate") ?? "+80%",
    voicePitch: take("--voice-pitch") ?? "+0Hz",
  };
};

const toProfileId = (arxivId: string) => `arxiv-${arxivId.replace(/[^\w]+/g, "-").toLowerCase()}`;

const buildPerPaperPaths = ({
  batchId,
  arxivId,
}: {
  batchId: string;
  arxivId: string;
}) => {
  const safePaperId = arxivId.replace(/[^\w]+/g, "-").toLowerCase();
  return {
    sourceBundlePath: path.join(SOURCE_BUNDLE_ROOT, `${batchId}-${safePaperId}.json`),
    analysisBundlePath: path.join(SOURCE_BUNDLE_ROOT, `${batchId}-${safePaperId}.analysis.json`),
  };
};

const writeStatusBack = async ({
  csvPath,
  records,
  paperUrl,
  status,
}: {
  csvPath: string;
  records: PaperUrlRecord[];
  paperUrl: string;
  status: PaperUrlStatus;
}) => {
  const updatedRecords = records.map((record) =>
    record.paperUrl === paperUrl
      ? {
          ...record,
          status,
        }
      : record,
  );

  records.splice(0, records.length, ...updatedRecords);

  await writePaperUrlCsvRecords({
    filePath: csvPath,
    records: updatedRecords,
  });
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const paperRecords = await readPaperUrlCsvRecords(options.paperUrlCsv);
  const unprocessedRecords = paperRecords.filter((record) => record.status === "unprocessed");

  if (unprocessedRecords.length === 0) {
    throw new Error("The CSV file did not contain any paper URLs with status=unprocessed.");
  }

  const batchId = options.batchId ?? makePaperUrlBatchId("paper-url-donut-batch");
  const baseSeed = resolveDonutBatchBaseSeed({
    batchId,
    explicitSeed: options.seed,
  });
  const paths = buildPaperUrlBatchPaths(batchId);
  const successfulRows: Array<{
    rowId: string;
    contentProfileId: string;
    seed: number;
  }> = [];
  const failures: Array<{paperUrl: string; error: string}> = [];

  for (const [index, record] of unprocessedRecords.entries()) {
    const rowSeed = baseSeed + index * 101;

    try {
      const fetchedRaw = await runWithCapture("node", [
        "--import",
        "tsx",
        "tools/fetch-arxiv-ai.ts",
        "--paper-url",
        record.paperUrl,
        "--download-pdf",
      ]);
      const fetchedPapers = JSON.parse(fetchedRaw) as FetchedPaper[];
      const fetchedPaper = fetchedPapers[0];

      if (!fetchedPaper?.arxivId) {
        throw new Error(`No fetched paper metadata returned for ${record.paperUrl}`);
      }

      if (fetchedPaper.localPdfPath) {
        const inputPdf = path.resolve(fetchedPaper.localPdfPath);
        const outputText = path.join(path.dirname(inputPdf), "source.txt");
        await run("node", [
          "--import",
          "tsx",
          "tools/extract-pdf-text.ts",
          "--input-pdf",
          inputPdf,
          "--output-text",
          outputText,
        ]).catch(async () => {
          return;
        });
      }

      const perPaperPaths = buildPerPaperPaths({
        batchId,
        arxivId: fetchedPaper.arxivId,
      });

      await run("node", [
        "--import",
        "tsx",
        "tools/build-source-bundle.ts",
        "--paper-ids",
        fetchedPaper.arxivId,
        "--output",
        perPaperPaths.sourceBundlePath,
        "--cover-selection-mode",
        "none",
        "--seed",
        String(rowSeed),
      ]);

      await run("node", [
        "--import",
        "tsx",
        "tools/analyze-paper-sources.ts",
        "--input",
        perPaperPaths.sourceBundlePath,
        "--output",
        perPaperPaths.analysisBundlePath,
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
        perPaperPaths.analysisBundlePath,
        "--output-dir",
        paths.manifestDir,
      ]);

      const row = {
        rowId: fetchedPaper.arxivId,
        contentProfileId: toProfileId(fetchedPaper.arxivId),
        seed: rowSeed,
      };

      await writeDonutBatchManifests({
        manifestDir: paths.manifestDir,
        rows: [row],
      });

      successfulRows.push(row);

      await writeDonutBatchCsv({
        outputPath: paths.batchCsvPath,
        manifestDir: paths.manifestDir,
        rows: successfulRows,
        voiceName: options.voiceName,
        voiceRate: options.voiceRate,
        voicePitch: options.voicePitch,
      });

      await run("node", [
        "--import",
        "tsx",
        "tools/produce-video.ts",
        "--batch-config",
        paths.batchCsvPath,
        "--rows",
        String(successfulRows.length),
      ]);

      await writeStatusBack({
        csvPath: options.paperUrlCsv,
        records: paperRecords,
        paperUrl: record.paperUrl,
        status: "processed",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      console.error(`Paper URL batch failed for ${record.paperUrl}: ${message}`);
      failures.push({
        paperUrl: record.paperUrl,
        error: message,
      });

      await writeStatusBack({
        csvPath: options.paperUrlCsv,
        records: paperRecords,
        paperUrl: record.paperUrl,
        status: "error",
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        batchId,
        processed: successfulRows.length,
        failed: failures.length,
        batchCsvPath: paths.batchCsvPath,
        failures,
      },
      null,
      2,
    ),
  );

  if (successfulRows.length === 0) {
    throw new Error("No videos were produced. Check the CSV rows marked as error.");
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
