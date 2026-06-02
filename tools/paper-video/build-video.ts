import fs from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";
import {
  appendRegistryRow,
  GENERATED_META_ROOT,
  OUTPUT_ROOT,
  readLatestRun,
  writeRunSummary,
} from "./lib/run-artifacts";
import type {CoverImageAsset, RenderManifest} from "@paper-to-video/shared-types";

const DEFAULT_RENDER_MANIFEST = path.join(GENERATED_META_ROOT, "demo-paper-001.render.json");
const DEFAULT_OUTPUT = path.join(OUTPUT_ROOT, "videos", "demo-paper-001.mp4");
const PUBLIC_DIR = path.resolve("public");
const DEFAULT_GL = process.env.REMOTION_GL ?? "angle";
const DEFAULT_CONCURRENCY = process.env.REMOTION_CONCURRENCY ?? "2";

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

const prepareStaticAssets = async (manifest: RenderManifest): Promise<RenderManifest> => {
  const generatedAudioDir = path.join(PUBLIC_DIR, "generated-audio");
  const generatedImagesDir = path.join(PUBLIC_DIR, "generated-images");
  await fs.mkdir(generatedAudioDir, {recursive: true});
  await fs.mkdir(generatedImagesDir, {recursive: true});

  const audioAssets = await Promise.all(
    manifest.audioAssets.map(async (asset, index) => {
      if (!asset.filePath) {
        return asset;
      }

      const sourcePath = path.resolve(asset.filePath);
      const extension = path.extname(sourcePath) || ".mp3";
      const fileName = `${String(index + 1).padStart(2, "0")}-${asset.sceneId}${extension}`;
      const targetPath = path.join(generatedAudioDir, fileName);
      await fs.copyFile(sourcePath, targetPath);

      return {
        ...asset,
        filePath: `generated-audio/${fileName}`,
      };
    }),
  );

  const imageAssets = await Promise.all(
    manifest.imageAssets.map(async (asset, index) => {
      if (!asset.localPath) {
        return asset;
      }

      const sourcePath = path.resolve(asset.localPath);
      const extension = path.extname(sourcePath) || ".png";
      const fileName = `${String(index + 1).padStart(2, "0")}-${asset.id}${extension}`;
      const targetPath = path.join(generatedImagesDir, fileName);
      await fs.copyFile(sourcePath, targetPath);

      return {
        ...asset,
        localPath: `generated-images/${fileName}`,
      };
    }),
  );

  const coverImage = await (async (): Promise<CoverImageAsset | undefined> => {
    if (!manifest.coverImage) {
      return undefined;
    }

    if (manifest.coverImage.source === "remote") {
      return manifest.coverImage;
    }

    const sourcePath = path.resolve(manifest.coverImage.path);
    const extension = path.extname(sourcePath) || ".png";
    const fileName = `cover-image${extension}`;
    const targetPath = path.join(generatedImagesDir, fileName);
    await fs.copyFile(sourcePath, targetPath);

    return {
      ...manifest.coverImage,
      path: `generated-images/${fileName}`,
    };
  })();

  return {
    ...manifest,
    coverImage,
    audioAssets,
    imageAssets,
  };
};

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");
  const skipRunRegistry = process.argv.includes("--skip-run-registry");
  const positionalArgs = process.argv.slice(2).filter((arg) => {
    return arg !== "--dry-run" && arg !== "--skip-run-registry";
  });
  const latestRun = skipRunRegistry ? null : await readLatestRun().catch(() => null);
  const renderManifest = positionalArgs[0]
    ? path.resolve(positionalArgs[0])
    : latestRun?.renderManifestPath ?? DEFAULT_RENDER_MANIFEST;
  const output = positionalArgs[1]
    ? path.resolve(positionalArgs[1])
    : latestRun?.videoPath ?? DEFAULT_OUTPUT;
  const manifestRaw = await fs.readFile(renderManifest, "utf-8");
  const sourceManifest = JSON.parse(manifestRaw) as RenderManifest;

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          composition: "PaperToVideo",
          renderManifest,
          output,
          outputRoot: OUTPUT_ROOT,
          gl: DEFAULT_GL,
          concurrency: DEFAULT_CONCURRENCY,
          scenes: sourceManifest.scenes.length,
          audioAssets: sourceManifest.audioAssets.length,
          imageAssets: sourceManifest.imageAssets.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  const manifest = await prepareStaticAssets(sourceManifest);

  await fs.mkdir(path.dirname(output), {recursive: true});

  await run("npx", [
    "remotion",
    "render",
    "apps/video-renderer/src/index.tsx",
    "PaperToVideo",
    output,
    "--gl",
    DEFAULT_GL,
    "--concurrency",
    DEFAULT_CONCURRENCY,
    "--props",
    JSON.stringify({
      manifest,
    }),
  ]);

  if (latestRun) {
    await writeRunSummary(
      {
        projectId: latestRun.projectId,
        projectSlug: latestRun.projectId,
        runId: latestRun.runId,
        rootDir: latestRun.rootDir,
        inputDir: path.join(latestRun.rootDir, "inputs"),
        manifestDir: path.join(latestRun.rootDir, "manifests"),
        audioDir: path.join(latestRun.rootDir, "audio"),
        metaDir: path.join(latestRun.rootDir, "meta"),
        imageDir: path.join(latestRun.rootDir, "images"),
        paperDir: path.join(latestRun.rootDir, "paper"),
        videoDir: path.join(latestRun.rootDir, "video"),
        productionManifestPath: latestRun.productionManifestPath,
        renderManifestPath: latestRun.renderManifestPath,
        summaryPath: path.join(latestRun.rootDir, "run-summary.json"),
        videoPath: latestRun.videoPath,
      },
      {
        projectId: latestRun.projectId,
        runId: latestRun.runId,
        productionManifestPath: latestRun.productionManifestPath,
        renderManifestPath: latestRun.renderManifestPath,
        outputVideoPath: output,
        audioDir: path.join(latestRun.rootDir, "audio"),
        metaDir: path.join(latestRun.rootDir, "meta"),
        stage: "video-rendered",
      },
    );

    const renderManifestRaw = JSON.parse(manifestRaw) as RenderManifest;
    await appendRegistryRow({
      created_at: new Date().toISOString(),
      project_id: latestRun.projectId,
      run_id: latestRun.runId,
      production_manifest: latestRun.productionManifestPath,
      render_manifest: latestRun.renderManifestPath,
      audio_dir: path.join(latestRun.rootDir, "audio"),
      meta_dir: path.join(latestRun.rootDir, "meta"),
      video_path: output,
      voice: renderManifestRaw.voice.name,
      status: "rendered",
    });
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
