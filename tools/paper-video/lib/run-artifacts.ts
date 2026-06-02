import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import type {ProductionManifest} from "@paper-to-video/shared-types";

const PAPER_VIDEO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EMBEDDED_OUTPUT_ROOT = path.resolve(PAPER_VIDEO_ROOT, "..", "artifacts", "paper-video", "output");

export const OUTPUT_ROOT = path.resolve(process.env.PAPER_VIDEO_ARTIFACT_ROOT ?? EMBEDDED_OUTPUT_ROOT);
const RUNS_ROOT = path.join(OUTPUT_ROOT, "runs");
const BATCHES_ROOT = path.join(OUTPUT_ROOT, "batches");
const CACHE_ROOT = path.join(OUTPUT_ROOT, "cache");
const AUDIO_CACHE_ROOT = path.join(CACHE_ROOT, "audio");
export const PAPER_CACHE_ROOT = path.join(CACHE_ROOT, "papers");
export const GENERATED_ROOT = path.join(OUTPUT_ROOT, "generated");
export const GENERATED_AUDIO_ROOT = path.join(GENERATED_ROOT, "audio");
export const GENERATED_META_ROOT = path.join(GENERATED_ROOT, "meta");
export const GENERATED_IMAGE_ROOT = path.join(GENERATED_ROOT, "images");
export const PREPARED_IMAGE_ROOT = path.join(GENERATED_IMAGE_ROOT, "prepared");
export const SOURCE_BUNDLE_ROOT = path.join(GENERATED_ROOT, "source-bundles");
export const GENERATED_MANIFEST_ROOT = path.join(GENERATED_ROOT, "manifests");
export const INGEST_MANIFEST_ROOT = path.join(GENERATED_MANIFEST_ROOT, "ingest");
export const CONTENT_PROFILE_ROOT = path.join(GENERATED_ROOT, "content-profiles");
export const VIDEO_BATCH_CONFIG_ROOT = path.join(GENERATED_ROOT, "video-batches");
const REGISTRY_CSV = path.join(OUTPUT_ROOT, "video-runs.csv");
const LATEST_RUN_FILE = path.join(OUTPUT_ROOT, "latest-run.json");

const pad = (value: number) => String(value).padStart(2, "0");

export const makeRunId = (date = new Date()) => {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
};

export const slugify = (input: string) =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");

export type RunContext = {
  projectId: string;
  projectSlug: string;
  runId: string;
  rootDir: string;
  inputDir: string;
  manifestDir: string;
  audioDir: string;
  metaDir: string;
  imageDir: string;
  paperDir: string;
  videoDir: string;
  productionManifestPath: string;
  renderManifestPath: string;
  summaryPath: string;
  videoPath: string;
};

export type BatchExportContext = {
  batchId: string;
  rootDir: string;
  videoDir: string;
  indexPath: string;
};

export const getRunContext = (projectId: string, runId: string): RunContext => {
  const projectSlug = slugify(projectId);
  const rootDir = path.join(RUNS_ROOT, projectSlug, runId);

  return {
    projectId,
    projectSlug,
    runId,
    rootDir,
    inputDir: path.join(rootDir, "inputs"),
    manifestDir: path.join(rootDir, "manifests"),
    audioDir: path.join(rootDir, "audio"),
    metaDir: path.join(rootDir, "meta"),
    imageDir: path.join(rootDir, "images"),
    paperDir: path.join(rootDir, "paper"),
    videoDir: path.join(rootDir, "video"),
    productionManifestPath: path.join(rootDir, "inputs", "production-manifest.json"),
    renderManifestPath: path.join(rootDir, "manifests", "render-manifest.json"),
    summaryPath: path.join(rootDir, "run-summary.json"),
    videoPath: path.join(rootDir, "video", `${projectSlug}.mp4`),
  };
};

export const ensureRunDirectories = async (context: RunContext) => {
  await Promise.all(
    [
      context.inputDir,
      context.manifestDir,
      context.audioDir,
      context.metaDir,
      context.imageDir,
      context.paperDir,
      context.videoDir,
    ].map((dir) => fs.mkdir(dir, {recursive: true})),
  );
};

export const getBatchExportContext = (batchId: string): BatchExportContext => {
  const safeBatchId = slugify(batchId);
  const rootDir = path.join(BATCHES_ROOT, safeBatchId);

  return {
    batchId: safeBatchId,
    rootDir,
    videoDir: path.join(rootDir, "videos"),
    indexPath: path.join(rootDir, "videos.csv"),
  };
};

export const ensureBatchExportDirectories = async (context: BatchExportContext) => {
  await fs.mkdir(context.videoDir, {recursive: true});
};

export const ensureCacheDirectories = async () => {
  await Promise.all([
    fs.mkdir(AUDIO_CACHE_ROOT, {recursive: true}),
    fs.mkdir(PAPER_CACHE_ROOT, {recursive: true}),
  ]);
};

export const stableHash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 20);

export const getAudioCachePaths = (cacheKey: string) => ({
  audioPath: path.join(AUDIO_CACHE_ROOT, `${cacheKey}.mp3`),
  metaPath: path.join(AUDIO_CACHE_ROOT, `${cacheKey}.json`),
});

export const getPaperCacheDir = (paperId: string) => path.join(PAPER_CACHE_ROOT, paperId);

export const linkOrCopyFile = async (sourcePath: string, targetPath: string) => {
  await fs.mkdir(path.dirname(targetPath), {recursive: true});
  await fs.rm(targetPath, {force: true});

  try {
    await fs.link(sourcePath, targetPath);
  } catch {
    await fs.copyFile(sourcePath, targetPath);
  }
};

export const createRunContextFromManifest = async (
  manifest: ProductionManifest,
  requestedRunId?: string,
) => {
  const runId = requestedRunId ?? makeRunId();
  const context = getRunContext(manifest.projectId, runId);
  await ensureRunDirectories(context);
  return context;
};

export const writeLatestRun = async (context: RunContext) => {
  await fs.mkdir(OUTPUT_ROOT, {recursive: true});
  await fs.writeFile(
    LATEST_RUN_FILE,
    JSON.stringify(
      {
        projectId: context.projectId,
        runId: context.runId,
        rootDir: context.rootDir,
        productionManifestPath: context.productionManifestPath,
        renderManifestPath: context.renderManifestPath,
        videoPath: context.videoPath,
      },
      null,
      2,
    ),
    "utf-8",
  );
};

export const readLatestRun = async () => {
  const raw = await fs.readFile(LATEST_RUN_FILE, "utf-8");
  return JSON.parse(raw) as {
    projectId: string;
    runId: string;
    rootDir: string;
    productionManifestPath: string;
    renderManifestPath: string;
    videoPath: string;
  };
};

export const writeRunSummary = async (
  context: RunContext,
  payload: Record<string, unknown>,
) => {
  await fs.writeFile(context.summaryPath, JSON.stringify(payload, null, 2), "utf-8");
};

const escapeCsv = (value: string) => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

export const appendRegistryRow = async (row: Record<string, string>) => {
  await fs.mkdir(OUTPUT_ROOT, {recursive: true});

  const headers = [
    "created_at",
    "project_id",
    "run_id",
    "production_manifest",
    "render_manifest",
    "audio_dir",
    "meta_dir",
    "video_path",
    "voice",
    "status",
  ];

  const line = `${headers.map((header) => escapeCsv(row[header] ?? "")).join(",")}\n`;

  try {
    await fs.access(REGISTRY_CSV);
  } catch {
    await fs.writeFile(REGISTRY_CSV, `${headers.join(",")}\n`, "utf-8");
  }

  await fs.appendFile(REGISTRY_CSV, line, "utf-8");
};

export const appendBatchVideoRow = async (
  context: BatchExportContext,
  row: Record<string, string>,
) => {
  await ensureBatchExportDirectories(context);

  const headers = [
    "created_at",
    "row_number",
    "row_id",
    "project_id",
    "run_id",
    "batch_video_path",
    "run_video_path",
    "manifest_path",
  ];

  const line = `${headers.map((header) => escapeCsv(row[header] ?? "")).join(",")}\n`;

  try {
    await fs.access(context.indexPath);
  } catch {
    await fs.writeFile(context.indexPath, `${headers.join(",")}\n`, "utf-8");
  }

  await fs.appendFile(context.indexPath, line, "utf-8");
};
