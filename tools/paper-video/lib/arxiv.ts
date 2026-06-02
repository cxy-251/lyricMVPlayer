import fs from "node:fs/promises";
import path from "node:path";
import {getPaperCacheDir, linkOrCopyFile} from "./run-artifacts";

export type ArxivPaper = {
  arxivId: string;
  title: string;
  summary: string;
  authors: string[];
  categories: string[];
  pdfUrl: string;
  publishedAt: string;
  updatedAt: string;
};

const decodeXml = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const getTag = (input: string, tag: string) => {
  const match = input.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1].trim()) : "";
};

const getTags = (input: string, tag: string) =>
  [...input.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g"))].map((match) =>
    decodeXml(match[1].trim()),
  );

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

const parseRetryAfterMs = (value: string | null) => {
  if (!value) {
    return null;
  }

  const seconds = Number.parseFloat(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) {
    return Math.max(0, timestamp - Date.now());
  }

  return null;
};

const fetchTextWithRetry = async ({
  url,
  label,
  attempts = 6,
}: {
  url: string;
  label: string;
  attempts?: number;
}) => {
  let lastStatus = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) {
      return response.text();
    }

    lastStatus = response.status;
    if (!isRetryableStatus(response.status) || attempt === attempts - 1) {
      const retryHint =
        response.status === 429
          ? " arXiv returned 429. Wait a bit and retry, or reduce the rate of new-paper fetches."
          : "";
      throw new Error(`Failed to fetch ${label}: ${response.status}${retryHint}`);
    }

    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    const defaultDelayMs = response.status === 429 ? 2500 * (attempt + 1) : 900 * (attempt + 1);
    await sleep(Math.max(retryAfterMs ?? 0, defaultDelayMs));
  }

  throw new Error(`Failed to fetch ${label}: ${lastStatus}`);
};

const fetchBufferWithRetry = async ({
  url,
  label,
  attempts = 6,
}: {
  url: string;
  label: string;
  attempts?: number;
}) => {
  let lastStatus = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) {
      return Buffer.from(await response.arrayBuffer());
    }

    lastStatus = response.status;
    if (!isRetryableStatus(response.status) || attempt === attempts - 1) {
      const retryHint =
        response.status === 429
          ? " arXiv returned 429. Wait a bit and retry, or reduce the rate of new-paper fetches."
          : "";
      throw new Error(`Failed to download ${label}: ${response.status}${retryHint}`);
    }

    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    const defaultDelayMs = response.status === 429 ? 2500 * (attempt + 1) : 900 * (attempt + 1);
    await sleep(Math.max(retryAfterMs ?? 0, defaultDelayMs));
  }

  throw new Error(`Failed to download ${label}: ${lastStatus}`);
};

const readCachedPaperMetadata = async (arxivId: string) => {
  const resolveCandidatePaperIds = async (inputId: string) => {
    const normalizedId = inputId.replace("/", "_");
    const candidates = [normalizedId];

    // Users often provide arXiv URLs without the explicit version suffix
    // (for example `2604.22748`), while our local cache is stored under the
    // concrete fetched id (`2604.22748v1`). Prefer the exact id first, then
    // fall back to the newest cached version if present.
    if (!/v\d+$/i.test(normalizedId)) {
      const paperCacheRoot = path.dirname(getPaperCacheDir("placeholder"));

      try {
        const entries = await fs.readdir(paperCacheRoot, {withFileTypes: true});
        const versionedMatches = entries
          .filter(
            (entry) =>
              entry.isDirectory() &&
              new RegExp(`^${normalizedId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}v\\d+$`, "i").test(
                entry.name,
              ),
          )
          .sort((left, right) => {
            const leftVersion = Number.parseInt(left.name.match(/v(\d+)$/i)?.[1] ?? "0", 10);
            const rightVersion = Number.parseInt(right.name.match(/v(\d+)$/i)?.[1] ?? "0", 10);
            return rightVersion - leftVersion;
          })
          .map((entry) => entry.name);

        candidates.push(...versionedMatches);
      } catch {
        // If the cache root is not readable yet, just fall through and let the
        // normal fetch path handle it.
      }
    }

    return [...new Set(candidates)];
  };

  const candidatePaperIds = await resolveCandidatePaperIds(arxivId);

  for (const candidatePaperId of candidatePaperIds) {
    const paperCacheDir = getPaperCacheDir(candidatePaperId);
    const metadataPath = path.join(paperCacheDir, "metadata.json");

    try {
      const raw = await fs.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(raw) as ArxivPaper & {localPdfPath?: string};
      if (!metadata?.arxivId || !metadata?.title || !metadata?.summary) {
        continue;
      }

      return metadata;
    } catch {
      continue;
    }
  }

  return null;
};

export const parseArxivIdFromInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const directIdMatch = trimmed.match(/^\d{4}\.\d{4,5}(?:v\d+)?$/i);
  if (directIdMatch) {
    return directIdMatch[0];
  }

  try {
    const url = new URL(trimmed);
    if (!/arxiv\.org$/i.test(url.hostname)) {
      return null;
    }

    const absMatch = url.pathname.match(/^\/abs\/([^/]+)$/i);
    if (absMatch) {
      return absMatch[1];
    }

    const pdfMatch = url.pathname.match(/^\/pdf\/([^/]+?)(?:\.pdf)?$/i);
    if (pdfMatch) {
      return pdfMatch[1];
    }
  } catch {
    return null;
  }

  return null;
};

export const toCanonicalArxivAbsUrl = (arxivId: string) => `https://arxiv.org/abs/${arxivId}`;

export const parseFeed = (xml: string): ArxivPaper[] => {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1]);

  return entries.map((entry) => {
    const idUrl = getTag(entry, "id");
    const arxivId = idUrl.split("/abs/")[1] ?? idUrl;
    const pdfLinkMatch = entry.match(/<link[^>]+title="pdf"[^>]+href="([^"]+)"/);
    const categoryMatches = [...entry.matchAll(/<category[^>]+term="([^"]+)"/g)].map((match) => match[1]);

    return {
      arxivId,
      title: getTag(entry, "title").replace(/\s+/g, " ").trim(),
      summary: getTag(entry, "summary").replace(/\s+/g, " ").trim(),
      authors: getTags(entry, "name"),
      categories: categoryMatches,
      pdfUrl: pdfLinkMatch?.[1] ?? `https://arxiv.org/pdf/${arxivId}.pdf`,
      publishedAt: getTag(entry, "published"),
      updatedAt: getTag(entry, "updated"),
    };
  });
};

export const fetchArxivPaperById = async (arxivId: string) => {
  const cached = await readCachedPaperMetadata(arxivId);
  if (cached) {
    return cached;
  }

  const queryUrl =
    `http://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}&max_results=1`;
  const xml = await fetchTextWithRetry({
    url: queryUrl,
    label: `arXiv paper ${arxivId}`,
  });
  const papers = parseFeed(xml);
  const paper = papers[0];

  if (!paper) {
    throw new Error(`No arXiv paper found for ${arxivId}`);
  }

  return paper;
};

export const fetchLatestArxivPapers = async ({
  category,
  limit,
  start = 0,
}: {
  category: string;
  limit: number;
  start?: number;
}) => {
  const queryUrl =
    `http://export.arxiv.org/api/query?search_query=cat:${encodeURIComponent(category)}` +
    `&sortBy=submittedDate&sortOrder=descending&start=${start}&max_results=${limit}`;

  const xml = await fetchTextWithRetry({
    url: queryUrl,
    label: `arXiv feed ${category}`,
  });

  return parseFeed(xml);
};

export const downloadPdfIfMissing = async ({
  paper,
  runPaperDir,
}: {
  paper: ArxivPaper;
  runPaperDir?: string;
}) => {
  const paperCacheDir = getPaperCacheDir(paper.arxivId.replace("/", "_"));
  const pdfPath = path.join(paperCacheDir, "source.pdf");
  const metadataPath = path.join(paperCacheDir, "metadata.json");
  await fs.mkdir(paperCacheDir, {recursive: true});

  try {
    await fs.access(pdfPath);
  } catch {
    const buffer = await fetchBufferWithRetry({
      url: paper.pdfUrl,
      label: `PDF ${paper.pdfUrl}`,
    });
    await fs.writeFile(pdfPath, buffer);
  }

  await fs.writeFile(metadataPath, JSON.stringify({...paper, localPdfPath: pdfPath}, null, 2), "utf-8");

  if (runPaperDir) {
    const targetPath = path.join(path.resolve(runPaperDir), `${paper.arxivId.replace("/", "_")}.pdf`);
    await linkOrCopyFile(pdfPath, targetPath);
  }

  return {
    ...paper,
    localPdfPath: pdfPath,
  };
};
