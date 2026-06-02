import fs from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";
import {resolveLaunchCueOffsets} from "@paper-to-video/content-pipeline";
import {
  ensureCacheDirectories,
  GENERATED_AUDIO_ROOT,
  GENERATED_META_ROOT,
  getAudioCachePaths,
  linkOrCopyFile,
  readLatestRun,
  stableHash,
  writeRunSummary,
} from "./lib/run-artifacts";
import {resolveFfprobeBinary, resolvePythonCommand} from "./lib/python-runtime";
import type {
  AudioAsset,
  ProductionManifest,
  RenderManifest,
  RenderScene,
  SubtitleSegment,
} from "@paper-to-video/shared-types";

const DEFAULT_PRODUCTION_MANIFEST = path.resolve("data/manifests/demo-paper.json");
const DEFAULT_RENDER_MANIFEST = path.join(GENERATED_META_ROOT, "demo-paper-001.render.json");
const FfprobeBinary = resolveFfprobeBinary();
const TTS_RETRY_DELAYS_MS = [0, 1800, 4200, 9000, 18000];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const run = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {stdio: ["ignore", "pipe", "pipe"]});
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const details = stderr.trim() || stdout.trim();
      reject(new Error(`${command} exited with code ${code ?? "unknown"}${details ? `\n${details}` : ""}`));
    });
    child.on("error", reject);
  });

const isRetryableTtsError = (error: unknown) => {
  const message = error instanceof Error ? error.message : `${error ?? ""}`;
  return /timeout|timed out|speech\.platform\.bing\.com|ECONNRESET|ENOTFOUND|EAI_AGAIN|ws_connect|aiohttp|CancelledError/i.test(
    message,
  );
};

const synthesizeWithRetry = async ({
  command,
  args,
  audioPath,
  metaPath,
}: {
  command: string;
  args: string[];
  audioPath: string;
  metaPath: string;
}) => {
  let lastError: unknown;

  for (let attempt = 0; attempt < TTS_RETRY_DELAYS_MS.length; attempt += 1) {
    const delayMs = TTS_RETRY_DELAYS_MS[attempt];
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    await Promise.all([fs.rm(audioPath, {force: true}), fs.rm(metaPath, {force: true})]);

    try {
      await run(command, args);
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableTtsError(error) || attempt === TTS_RETRY_DELAYS_MS.length - 1) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown TTS synthesis failure");
};

const runWithCapture = (command: string, args: string[]) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {stdio: ["ignore", "pipe", "pipe"]});
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}\n${stderr}`));
    });

    child.on("error", reject);
  });

const splitNarration = (text: string) => {
  const sentenceParts = text
    .split(/[。！？!?；;]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const coarseParts = sentenceParts.length > 0 ? sentenceParts : [text.trim()];

  return coarseParts.flatMap((part) => {
    if (part.length <= 22) {
      return [part];
    }

    const chunks = part
      .split(/[，,、]/)
      .map((item) => item.trim())
      .filter(Boolean);

    return chunks.length > 0 ? chunks : [part];
  });
};

const estimateSegments = (text: string) => {
  const safeSentences = splitNarration(text);

  let cursor = 0;
  return safeSentences.map((sentence, index) => {
    const durationMs = Math.max(420, sentence.length * 185);
    const segment = {
      id: `seg-${index + 1}`,
      text: sentence,
      startMs: cursor,
      endMs: cursor + durationMs,
      role: "narration" as const,
    };
    cursor += durationMs;
    return segment;
  });
};

const msToFrames = (ms: number, fps: number) => Math.max(1, Math.round((ms / 1000) * fps));

const distributeSegmentsByDuration = (
  text: string,
  durationMs: number,
): AudioAsset["segments"] => {
  const safeSentences = splitNarration(text);
  const totalWeight = safeSentences.reduce((sum, sentence) => sum + Math.max(sentence.length, 1), 0);

  let cursor = 0;
  return safeSentences.map((sentence, index) => {
    const isLast = index === safeSentences.length - 1;
    const slice = isLast
      ? durationMs - cursor
      : Math.max(1, Math.round((Math.max(sentence.length, 1) / totalWeight) * durationMs));
    const nextCursor = isLast ? durationMs : cursor + slice;
    const segment = {
      id: `seg-${index + 1}`,
      text: sentence,
      startMs: cursor,
      endMs: nextCursor,
      role: "narration" as const,
    };
    cursor = nextCursor;
    return segment;
  });
};

const probeAudioDurationMs = async (audioPath: string) => {
  const result = await runWithCapture(FfprobeBinary, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ]);

  const seconds = Number.parseFloat(result);
  if (!Number.isFinite(seconds)) {
    throw new Error(`Unable to parse audio duration from ffprobe output: ${result}`);
  }

  return Math.max(1, Math.round(seconds * 1000));
};

const createMockAudioAsset = async (sceneId: string, text: string) => {
  const segments = estimateSegments(text);
  const durationMs = segments.length > 0 ? segments[segments.length - 1].endMs : 1000;

  return {
    id: `audio-${sceneId}`,
    filePath: "",
    durationMs,
    sceneId,
    segments,
  } satisfies AudioAsset;
};

const buildAudioCacheKey = ({
  scene,
  voice,
}: {
  scene: ProductionManifest["scenes"][number];
  voice: ProductionManifest["voice"];
}) =>
  stableHash(
    JSON.stringify({
      provider: voice.provider,
      voice: voice.name,
      rate: voice.rate,
      pitch: voice.pitch,
      volume: voice.volume ?? "",
      text: scene.narrationText ?? "",
    }),
  );

const rebuildTimeline = (
  renderManifest: RenderManifest,
  audioAssets: AudioAsset[],
): Pick<RenderManifest, "scenes" | "subtitleSegments" | "totalFrames"> => {
  let cursor = 0;
  const subtitleSegments: SubtitleSegment[] = [];

  const scenes = renderManifest.scenes.map<RenderScene>((scene) => {
    const audioAsset = audioAssets.find((asset) => asset.sceneId === scene.id);
    const enterFrames = scene.timing.enterFrames;
    const exitFrames = scene.timing.exitFrames;
    const audioFrames = audioAsset ? msToFrames(audioAsset.durationMs, renderManifest.fps) : 0;
    const holdFrames = Math.max(24, audioFrames);
    const durationInFrames = enterFrames + holdFrames + exitFrames;
    const fromFrame = cursor;

    const nextScene: RenderScene = {
      ...scene,
      fromFrame,
      durationInFrames,
      timing: {
        ...scene.timing,
        holdFrames,
        audioOffsetFrames: enterFrames,
        interactionFrameOffset: scene.timing.interactionFrameOffset,
        effectStartFrameOffset: scene.timing.effectStartFrameOffset,
      },
    };

    if (
      scene.backgroundEffectId === "cellular-launch" ||
      scene.backgroundEffectId === "lights-launch" ||
      scene.backgroundEffectId === "rubiks-launch"
    ) {
      Object.assign(nextScene.timing, resolveLaunchCueOffsets({scene: nextScene, modules: renderManifest.modules}));
    }

    if (audioAsset) {
      const sceneSubtitleSegments = audioAsset.segments.map<SubtitleSegment>((segment, index) => {
        const startFrame = fromFrame + enterFrames + msToFrames(segment.startMs, renderManifest.fps);
        const endFrame = fromFrame + enterFrames + msToFrames(segment.endMs, renderManifest.fps);

        return {
          id: `${scene.id}-subtitle-${index + 1}`,
          sceneId: scene.id,
          text: segment.text,
          startFrame,
          endFrame: Math.min(fromFrame + durationInFrames, Math.max(startFrame + 1, endFrame)),
          emphasisLevel: index === 0 ? 2 : 1,
        };
      });

      nextScene.subtitleSegmentIds = sceneSubtitleSegments.map((segment) => segment.id);
      subtitleSegments.push(...sceneSubtitleSegments);
    }

    cursor += durationInFrames;
    return nextScene;
  });

  return {
    scenes,
    subtitleSegments,
    totalFrames: cursor,
  };
};

const main = async () => {
  const args = process.argv.slice(2);
  const mockMode = args.includes("--mock");
  const positionalArgs = args.filter((arg) => arg !== "--mock");
  const latestRun = await readLatestRun().catch(() => null);
  const productionManifestPath = positionalArgs[0]
    ? path.resolve(positionalArgs[0])
    : latestRun?.productionManifestPath ?? DEFAULT_PRODUCTION_MANIFEST;
  const renderManifestPath = positionalArgs[1]
    ? path.resolve(positionalArgs[1])
    : latestRun?.renderManifestPath ?? DEFAULT_RENDER_MANIFEST;

  const [productionRaw, renderRaw] = await Promise.all([
    fs.readFile(productionManifestPath, "utf-8"),
    fs.readFile(renderManifestPath, "utf-8"),
  ]);

  const productionManifest = JSON.parse(productionRaw) as ProductionManifest;
  const renderManifest = JSON.parse(renderRaw) as RenderManifest;
  const audioAssets: AudioAsset[] = [];
  await ensureCacheDirectories();

  for (const scene of productionManifest.scenes) {
    const narrationText = scene.narrationText ?? "";
    if (!narrationText) {
      throw new Error(`Scene ${scene.id} is missing narrationText. Run compose:manifest first or provide a hydrated manifest.`);
    }

    if (mockMode) {
      const audioAsset = await createMockAudioAsset(scene.id, narrationText);
      const outputMeta = latestRun
        ? path.join(latestRun.rootDir, "meta", `${scene.id}.audio.json`)
        : path.join(GENERATED_META_ROOT, `${scene.id}.audio.json`);
      await fs.writeFile(outputMeta, JSON.stringify(audioAsset, null, 2), "utf-8");
      audioAssets.push(audioAsset);
      continue;
    }

    const outputAudio = latestRun
      ? path.join(latestRun.rootDir, "audio", `${scene.id}.mp3`)
      : path.join(GENERATED_AUDIO_ROOT, `${scene.id}.mp3`);
    const outputMeta = latestRun
      ? path.join(latestRun.rootDir, "meta", `${scene.id}.audio.json`)
      : path.join(GENERATED_META_ROOT, `${scene.id}.audio.json`);
    const cacheKey = buildAudioCacheKey({scene, voice: productionManifest.voice});
    const cachePaths = getAudioCachePaths(cacheKey);

    let cacheHit = true;
    try {
      await Promise.all([fs.access(cachePaths.audioPath), fs.access(cachePaths.metaPath)]);
    } catch {
      cacheHit = false;
    }

    if (!cacheHit) {
      const pythonCommand = resolvePythonCommand("services/tts-python/src/main.py", [
        "--scene-id",
        scene.id,
        "--text",
        narrationText,
        "--voice",
        productionManifest.voice.name,
        "--rate",
        productionManifest.voice.rate,
        "--pitch",
        productionManifest.voice.pitch,
        "--output-audio",
        cachePaths.audioPath,
        "--output-meta",
        cachePaths.metaPath,
      ]);
      await synthesizeWithRetry({
        command: pythonCommand.command,
        args: pythonCommand.args,
        audioPath: cachePaths.audioPath,
        metaPath: cachePaths.metaPath,
      });
    }

    await linkOrCopyFile(cachePaths.audioPath, outputAudio);

    const audioRaw = await fs.readFile(cachePaths.metaPath, "utf-8");
    const audioAsset = JSON.parse(audioRaw) as AudioAsset;
    const durationMs = await probeAudioDurationMs(cachePaths.audioPath);
    const normalizedAudioAsset: AudioAsset = {
      ...audioAsset,
      durationMs,
      segments: distributeSegmentsByDuration(narrationText, durationMs),
      filePath: outputAudio,
    };
    await fs.writeFile(outputMeta, JSON.stringify(normalizedAudioAsset, null, 2), "utf-8");
    audioAssets.push(normalizedAudioAsset);
  }

  const nextManifest: RenderManifest = {
    ...renderManifest,
    audioAssets,
    ...rebuildTimeline(renderManifest, audioAssets),
  };

  await fs.writeFile(renderManifestPath, JSON.stringify(nextManifest, null, 2), "utf-8");

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
        projectId: productionManifest.projectId,
        runId: latestRun.runId,
        productionManifestPath,
        renderManifestPath,
        audioAssets: audioAssets.map((asset) => asset.filePath),
        mockMode,
        stage: "audio-generated",
      },
    );
  }

  console.log(
    `${mockMode ? "Mock audio assets" : "Audio assets"} written into ${renderManifestPath}`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
