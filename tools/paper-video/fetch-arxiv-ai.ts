import fs from "node:fs/promises";
import {
  downloadPdfIfMissing,
  fetchArxivPaperById,
  parseArxivIdFromInput,
  parseFeed,
} from "./lib/arxiv";

const DEFAULT_CATEGORY = "cs.AI";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const getValue = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    category: getValue("--category") ?? DEFAULT_CATEGORY,
    limit: Number.parseInt(getValue("--limit") ?? "5", 10),
    downloadPdf: args.includes("--download-pdf"),
    latestOnly: args.includes("--latest-only"),
    runPaperDir: getValue("--run-paper-dir"),
    paperIds: (getValue("--paper-ids") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    paperUrls: args
      .flatMap((arg, index) => (arg === "--paper-url" ? [args[index + 1]] : []))
      .map((item) => item?.trim())
      .filter(Boolean) as string[],
    paperUrlFile: getValue("--paper-url-file"),
  };
};

const readPaperUrlFile = async (filePath: string) => {
  const raw = await fs.readFile(filePath, "utf-8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
};

const main = async () => {
  const options = parseArgs();
  const fileUrls = options.paperUrlFile ? await readPaperUrlFile(options.paperUrlFile) : [];
  const explicitIds = [
    ...options.paperIds,
    ...options.paperUrls,
    ...fileUrls,
  ]
    .map((value) => parseArxivIdFromInput(value) ?? value)
    .filter(Boolean);

  const papers = explicitIds.length > 0
    ? await (async () => {
        const items = [];
        for (const arxivId of explicitIds) {
          items.push(await fetchArxivPaperById(arxivId));
        }

        return items;
      })()
    : await (async () => {
        const queryUrl =
          `http://export.arxiv.org/api/query?search_query=cat:${encodeURIComponent(options.category)}` +
          `&sortBy=submittedDate&sortOrder=descending&max_results=${options.limit}`;

        const response = await fetch(queryUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch arXiv feed: ${response.status}`);
        }

        const xml = await response.text();
        const parsed = parseFeed(xml);
        return options.latestOnly ? parsed.slice(0, 1) : parsed;
      })();

  const results = [];
  for (const paper of papers) {
    results.push(
      options.downloadPdf
        ? await downloadPdfIfMissing({paper, runPaperDir: options.runPaperDir})
        : paper,
    );
  }

  console.log(JSON.stringify(results, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
