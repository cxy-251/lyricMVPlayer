import path from "node:path";
import {fetchLatestArxivPapers, parseArxivIdFromInput, toCanonicalArxivAbsUrl} from "./lib/arxiv";
import {
  normalizePaperUrlRecords,
  readPaperUrlCsvRecords,
  writePaperUrlCsvRecords,
  type PaperUrlRecord,
} from "./lib/paper-url-batch";

const DEFAULT_OUTPUT = path.resolve("data/papers/paper-urls.csv");
const DEFAULT_CATEGORY = "cs.AI";
const DEFAULT_LIMIT = 10;
const MAX_SCAN_PAGES = 20;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const take = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    output: path.resolve(take("--output") ?? DEFAULT_OUTPUT),
    category: take("--category") ?? DEFAULT_CATEGORY,
    limit: Number.parseInt(take("--limit") ?? String(DEFAULT_LIMIT), 10),
    dryRun: args.includes("--dry-run"),
  };
};

const main = async () => {
  const options = parseArgs();
  const targetAddCount = Number.isFinite(options.limit) && options.limit > 0 ? options.limit : DEFAULT_LIMIT;

  let existingRecords: PaperUrlRecord[] = [];
  try {
    existingRecords = await readPaperUrlCsvRecords(options.output);
  } catch {
    existingRecords = [];
  }

  const existingIds = new Set(
    existingRecords.map((record) => parseArxivIdFromInput(record.paperUrl)?.toLowerCase() ?? record.paperUrl.toLowerCase()),
  );
  const fetchedUrls: string[] = [];
  const addedUrls: string[] = [];
  let start = 0;
  let pagesFetched = 0;

  while (addedUrls.length < targetAddCount && pagesFetched < MAX_SCAN_PAGES) {
    const latest = await fetchLatestArxivPapers({
      category: options.category,
      limit: targetAddCount,
      start,
    });

    if (latest.length === 0) {
      break;
    }

    pagesFetched += 1;
    start += latest.length;

    for (const paper of latest) {
      const paperUrl = toCanonicalArxivAbsUrl(paper.arxivId);
      fetchedUrls.push(paperUrl);
      const arxivId = parseArxivIdFromInput(paperUrl)?.toLowerCase() ?? paperUrl.toLowerCase();

      if (existingIds.has(arxivId)) {
        continue;
      }

      existingIds.add(arxivId);
      addedUrls.push(paperUrl);

      if (addedUrls.length >= targetAddCount) {
        break;
      }
    }

    if (latest.length < targetAddCount) {
      break;
    }
  }

  const merged = normalizePaperUrlRecords([
    ...addedUrls.map((paperUrl) => ({paperUrl, status: "unprocessed" as const})),
    ...existingRecords,
  ]);

  if (!options.dryRun) {
    await writePaperUrlCsvRecords({
      filePath: options.output,
      records: merged,
    });
  }

  console.log(
    JSON.stringify(
      {
        output: options.output,
        category: options.category,
        targetAddCount,
        latestFetched: fetchedUrls.length,
        pagesFetched,
        added: addedUrls.length,
        total: merged.length,
        dryRun: options.dryRun,
        addedUrls,
        previewHead: merged.slice(0, 8),
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
