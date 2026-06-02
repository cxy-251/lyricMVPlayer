import fs from "node:fs/promises";
import path from "node:path";
import {parseArxivIdFromInput, toCanonicalArxivAbsUrl} from "./arxiv";
import {
  GENERATED_MANIFEST_ROOT,
  makeRunId,
  PREPARED_IMAGE_ROOT,
  slugify,
  SOURCE_BUNDLE_ROOT,
  VIDEO_BATCH_CONFIG_ROOT,
} from "./run-artifacts";

const IMAGE_FILE_PATTERN = /\.(png|jpg|jpeg|webp|svg)$/i;

export type PaperUrlStatus = "processed" | "published" | "unprocessed" | "error";

export type PaperUrlRecord = {
  paperUrl: string;
  status: PaperUrlStatus;
};

const normalizeStatus = (value: string | undefined): PaperUrlStatus => {
  const normalized = (value ?? "").trim().toLowerCase();

  if (["published", "posted", "live", "已发布", "已上线"].includes(normalized)) {
    return "published";
  }

  if (["processed", "done", "complete", "completed", "已处理", "done"].includes(normalized)) {
    return "processed";
  }

  if (["error", "failed", "failure", "problem", "broken", "有问题", "失败", "出错"].includes(normalized)) {
    return "error";
  }

  return "unprocessed";
};

export const readPaperUrlFile = async (filePath: string) => {
  const raw = await fs.readFile(filePath, "utf-8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
};

export const readPaperUrlCsv = async (filePath: string) => {
  const records = await readPaperUrlCsvRecords(filePath);
  return records.map((record) => record.paperUrl);
};

export const readPaperUrlCsvRecords = async (filePath: string): Promise<PaperUrlRecord[]> => {
  const raw = await fs.readFile(filePath, "utf-8");
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (rows.length === 0) {
    return [];
  }

  const values = rows.map((row) => row.split(",").map((cell) => cell.trim()).filter(Boolean));
  const headers = values[0]?.map((cell) => cell.toLowerCase()) ?? [];
  const hasHeader = headers.includes("paper_url") || headers.includes("url");
  const dataRows = hasHeader ? values.slice(1) : values;
  const urlIndex = hasHeader ? Math.max(headers.indexOf("paper_url"), headers.indexOf("url")) : 0;
  const statusIndex = hasHeader ? headers.indexOf("status") : -1;

  return dataRows
    .map((cells) => {
      const paperUrl = cells[urlIndex] ?? cells[0] ?? "";
      const status = normalizeStatus(statusIndex >= 0 ? cells[statusIndex] : undefined);
      return {
        paperUrl,
        status,
      } satisfies PaperUrlRecord;
    })
    .filter((record) => Boolean(record.paperUrl));
};

export const normalizePaperUrlList = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const arxivId = parseArxivIdFromInput(normalized);
    const canonical = arxivId ? toCanonicalArxivAbsUrl(arxivId) : normalized;
    const dedupeKey = arxivId ? arxivId.toLowerCase() : canonical.toLowerCase();

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    result.push(canonical);
  }

  return result;
};

export const normalizePaperUrlRecords = (records: PaperUrlRecord[]) => {
  const seen = new Map<string, PaperUrlRecord>();

  for (const record of records) {
    const normalized = record.paperUrl.trim();
    if (!normalized) {
      continue;
    }

    const arxivId = parseArxivIdFromInput(normalized);
    const canonical = arxivId ? toCanonicalArxivAbsUrl(arxivId) : normalized;
    const dedupeKey = arxivId ? arxivId.toLowerCase() : canonical.toLowerCase();
    const nextRecord: PaperUrlRecord = {
      paperUrl: canonical,
      status: record.status,
    };

    const previous = seen.get(dedupeKey);
    if (!previous) {
      seen.set(dedupeKey, nextRecord);
      continue;
    }

    seen.set(dedupeKey, {
      paperUrl: previous.paperUrl,
      status:
        previous.status === "published" || nextRecord.status === "published"
          ? "published"
          : previous.status === "processed" || nextRecord.status === "processed"
          ? "processed"
          : previous.status === "error" || nextRecord.status === "error"
            ? "error"
            : "unprocessed",
    });
  }

  return [...seen.values()];
};

export const writePaperUrlCsv = async ({
  filePath,
  urls,
}: {
  filePath: string;
  urls: string[];
}) => {
  const normalized = normalizePaperUrlList(urls);
  const raw = ["paper_url", ...normalized].join("\n");
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, `${raw}\n`, "utf-8");
};

export const writePaperUrlCsvRecords = async ({
  filePath,
  records,
}: {
  filePath: string;
  records: PaperUrlRecord[];
}) => {
  const normalized = normalizePaperUrlRecords(records);
  const raw = ["paper_url, status", ...normalized.map((record) => `${record.paperUrl}, ${record.status}`)].join("\n");
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, `${raw}\n`, "utf-8");
};

const directoryHasImages = async (dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, {withFileTypes: true});
    return entries.some((entry) => entry.isFile() && IMAGE_FILE_PATTERN.test(entry.name));
  } catch {
    return false;
  }
};

export const resolveDefaultBackgroundDir = async () => {
  const preferred = PREPARED_IMAGE_ROOT;
  if (await directoryHasImages(preferred)) {
    return preferred;
  }

  const fallback = path.resolve("data/images");
  if (await directoryHasImages(fallback)) {
    return fallback;
  }

  return preferred;
};

export const makePaperUrlBatchId = (label = "paper-urls", date = new Date()) =>
  slugify(`${label}-${makeRunId(date)}`);

export const buildPaperUrlBatchPaths = (batchId: string) => ({
  sourceBundlePath: path.join(SOURCE_BUNDLE_ROOT, `${batchId}.json`),
  analysisBundlePath: path.join(SOURCE_BUNDLE_ROOT, `${batchId}.analysis.json`),
  manifestDir: path.join(GENERATED_MANIFEST_ROOT, batchId),
  batchCsvPath: path.join(VIDEO_BATCH_CONFIG_ROOT, `${batchId}.csv`),
});
