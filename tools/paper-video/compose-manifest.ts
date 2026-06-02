import fs from "node:fs/promises";
import path from "node:path";
import {
  createRunContextFromManifest,
  linkOrCopyFile,
  writeLatestRun,
  writeRunSummary,
} from "./lib/run-artifacts";
import {
  resolveLaunchCueOffsets,
  resolveSceneBackgroundEffectId,
  resolveSceneBackgroundImageLayoutId,
} from "@paper-to-video/content-pipeline";
import type {
  ContentProfileDocument,
  ContentProfileRegistryDocument,
  CoverProfileRegistryDocument,
  ProductionManifest,
  RenderManifest,
  RenderScene,
  SceneTiming,
  SubtitleSegment,
} from "@paper-to-video/shared-types";

const DEFAULT_INPUT = path.resolve("data/manifests/demo-paper.json");
const DEFAULT_CONTENT_PROFILE_REGISTRY = path.resolve("data/content-profiles/index.json");
const DEFAULT_COVER_PROFILE_REGISTRY = path.resolve("data/cover-assets/index.json");

const msToFrames = (ms: number, fps: number) => Math.max(1, Math.round((ms / 1000) * fps));

const estimateSceneDurationMs = (text: string) => {
  const estimatedNarration = Math.max(1800, text.trim().length * 240);
  return Math.max(2500, estimatedNarration + 700);
};

const resolveContentProfile = async (manifest: ProductionManifest) => {
  if (!manifest.contentProfile) {
    return null;
  }

  const profilePath = manifest.contentProfile.path
    ? path.resolve(manifest.contentProfile.path)
    : await (async () => {
        const registryRaw = await fs.readFile(DEFAULT_CONTENT_PROFILE_REGISTRY, "utf-8");
        const registry = JSON.parse(registryRaw) as ContentProfileRegistryDocument;
        const entry = registry.profiles.find((item) => item.id === manifest.contentProfile?.id);
        if (!entry) {
          throw new Error(`Unknown content profile: ${manifest.contentProfile?.id}`);
        }

        return path.resolve(entry.path);
      })();

  const raw = await fs.readFile(profilePath, "utf-8");
  return JSON.parse(raw) as ContentProfileDocument;
};

const resolveCoverImage = async (manifest: ProductionManifest, contentProfile: ContentProfileDocument | null) => {
  if (manifest.coverProfile) {
    const registryPath = manifest.coverProfile.path
      ? path.resolve(manifest.coverProfile.path)
      : DEFAULT_COVER_PROFILE_REGISTRY;
    const registryRaw = await fs.readFile(registryPath, "utf-8");
    const registry = JSON.parse(registryRaw) as CoverProfileRegistryDocument;
    const entry = registry.assets.find((item) => item.id === manifest.coverProfile?.id);
    if (!entry) {
      throw new Error(`Unknown cover profile: ${manifest.coverProfile?.id}`);
    }

    return {
      source: entry.source,
      path: entry.path,
      alt: entry.alt,
    } satisfies NonNullable<ProductionManifest["coverImage"]>;
  }

  if (manifest.coverImage) {
    return manifest.coverImage;
  }

  return contentProfile?.coverImage;
};

const hydrateManifest = async (manifest: ProductionManifest) => {
  const contentProfile = await resolveContentProfile(manifest);
  const coverImage = await resolveCoverImage(manifest, contentProfile);

  const scenes = manifest.scenes.map((scene) => {
    const profileScene = contentProfile?.scenes[scene.contentRef];
    const hydratedScene = {
      ...scene,
      narrationText: profileScene?.narrationText ?? scene.narrationText,
      content: profileScene?.content ?? scene.content,
      imagePrompt: profileScene?.imagePrompt ?? scene.imagePrompt,
      imageAssetId: profileScene?.imageAssetId ?? scene.imageAssetId,
    };

    if (!hydratedScene.narrationText) {
      throw new Error(`Scene ${scene.id} is missing narrationText after content profile hydration.`);
    }

    return hydratedScene;
  });

  return {
    ...manifest,
    paper: {
      ...manifest.paper,
      ...(contentProfile?.paper ?? {}),
    },
    coverImage,
    scenes,
  } satisfies ProductionManifest;
};

const buildContent = (scene: ProductionManifest["scenes"][number]) => {
  const narrationText = scene.narrationText ?? "";
  if (scene.content) {
    return scene.content;
  }

  switch (scene.type) {
    case "hero":
      return {
        title: "这篇论文到底解决了什么问题？",
        body: narrationText,
      };
    case "paper-intro":
      return {
        title: "论文背景",
        body: narrationText,
      };
    case "summary":
      return {
        title: "核心总结",
        body: narrationText,
      };
    case "ending":
      return {
        title: "结论",
        body: narrationText,
      };
    default:
      return {
        title: scene.id,
        body: narrationText,
      };
  }
};

const buildSubtitles = (
  sceneId: string,
  fromFrame: number,
  narrationText: string,
  durationInFrames: number,
) => {
  const parts = narrationText
    .split(/[。！？!?]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const safeParts = parts.length > 0 ? parts : [narrationText.trim()];
  const segmentFrames = Math.max(1, Math.floor(durationInFrames / safeParts.length));

  return safeParts.map<SubtitleSegment>((text, index) => {
    const startFrame = fromFrame + index * segmentFrames;
    const endFrame =
      index === safeParts.length - 1 ? fromFrame + durationInFrames : startFrame + segmentFrames;

    return {
      id: `${sceneId}-subtitle-${index + 1}`,
      sceneId,
      text,
      startFrame,
      endFrame,
      emphasisLevel: index === 0 ? 2 : 1,
    };
  });
};

const main = async () => {
  const args = process.argv.slice(2);
  const take = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const requestedRunId = take("--run-id");
  const inputFlag = take("--input");
  const outputFlag = take("--output");
  const consumedIndexes = new Set<number>();

  for (const flag of ["--run-id", "--input", "--output"]) {
    const index = args.indexOf(flag);
    if (index >= 0) {
      consumedIndexes.add(index);
      consumedIndexes.add(index + 1);
    }
  }

  const positionalArgs = args.filter((arg, index) => {
    return !consumedIndexes.has(index);
  });
  const input = path.resolve(inputFlag ?? positionalArgs[0] ?? DEFAULT_INPUT);
  const requestedOutput = outputFlag
    ? path.resolve(outputFlag)
    : positionalArgs[1]
      ? path.resolve(positionalArgs[1])
      : null;
  const raw = await fs.readFile(input, "utf-8");
  const sourceManifest = JSON.parse(raw) as ProductionManifest;
  const manifest = await hydrateManifest(sourceManifest);
  const templateRef = manifest.template ?? {
    id: "paper-digest-v1",
    path: "data/templates/paper-digest-v1.json",
  };
  const templatePath = path.resolve(templateRef.path);
  const templateRaw = await fs.readFile(templatePath, "utf-8");
  const templateDocument = JSON.parse(templateRaw);
  const runContext = await createRunContextFromManifest(manifest, requestedRunId);

  let cursor = 0;
  const scenes: RenderScene[] = [];
  const subtitleSegments: SubtitleSegment[] = [];
  let coverCycleIndex = 0;
  let paperLocalPdfPath = manifest.paper.localPdfPath;

  if (manifest.paper.localPdfPath) {
    const sourcePdfPath = path.resolve(manifest.paper.localPdfPath);
    const extension = path.extname(sourcePdfPath) || ".pdf";
    const runPdfPath = path.join(runContext.paperDir, `source${extension}`);
    await linkOrCopyFile(sourcePdfPath, runPdfPath);
    paperLocalPdfPath = runPdfPath;
  }

  for (const scene of manifest.scenes) {
    const narrationText = scene.narrationText ?? "";
    const sceneDurationMs =
      scene.durationStrategy === "fixed" && scene.fixedDurationMs
        ? scene.fixedDurationMs
        : estimateSceneDurationMs(narrationText);

    const durationInFrames = msToFrames(sceneDurationMs, manifest.output.fps);
    const enterFrames = Math.min(12, Math.max(8, Math.floor(durationInFrames * 0.12)));
    const exitFrames = Math.min(12, Math.max(8, Math.floor(durationInFrames * 0.08)));
    const baseTiming: SceneTiming = {
      enterFrames,
      holdFrames: Math.max(1, durationInFrames - enterFrames - exitFrames),
      exitFrames,
      audioOffsetFrames: 0,
      interactionFrameOffset: enterFrames,
      effectStartFrameOffset: enterFrames,
    };
    const resolvedBackgroundEffectId = resolveSceneBackgroundEffectId(scene, manifest.effectProfile);
    const timing =
      resolvedBackgroundEffectId === "cellular-launch" ||
      resolvedBackgroundEffectId === "lights-launch" ||
      resolvedBackgroundEffectId === "rubiks-launch"
        ? {
            ...baseTiming,
            ...resolveLaunchCueOffsets({
              scene: {timing: baseTiming},
              modules: manifest.modules,
            }),
          }
        : baseTiming;

    const renderScene: RenderScene = {
      id: scene.id,
      type: scene.type,
      fromFrame: cursor,
      durationInFrames,
      backgroundPresetId: scene.backgroundPresetId,
      backgroundImageLayoutId: resolveSceneBackgroundImageLayoutId(scene, coverCycleIndex),
      backgroundEffectId: resolvedBackgroundEffectId,
      motionPresetId: scene.motionPresetId,
      imageAssetIds: scene.imageAssetId ? [scene.imageAssetId] : [],
      audioSegmentIds: [`audio-${scene.id}`],
      subtitleSegmentIds: [],
      content: buildContent(scene),
      timing,
    };

    const sceneSubtitles = buildSubtitles(
      scene.id,
      renderScene.fromFrame,
      narrationText,
      renderScene.durationInFrames,
    );
    renderScene.subtitleSegmentIds = sceneSubtitles.map((segment) => segment.id);
    subtitleSegments.push(...sceneSubtitles);
    scenes.push(renderScene);
    if (renderScene.backgroundImageLayoutId !== "gradient-default" && renderScene.backgroundImageLayoutId !== "cover-full") {
      coverCycleIndex += 1;
    }
    cursor += durationInFrames;
  }

  const renderManifest: RenderManifest = {
    projectId: manifest.projectId,
    seed: manifest.seed,
    fps: manifest.output.fps,
    width: manifest.output.width,
    height: manifest.output.height,
    totalFrames: cursor,
    template: templateRef,
    templateDocument,
    coverImage: manifest.coverImage,
    paper: {
      ...manifest.paper,
      localPdfPath: paperLocalPdfPath,
    },
    theme: manifest.theme,
    voice: manifest.voice,
    effectProfile: manifest.effectProfile,
    modules: manifest.modules,
    scenes,
    audioAssets: [],
    imageAssets: [],
    subtitleSegments,
  };

  await fs.writeFile(
    runContext.productionManifestPath,
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );

  const finalOutput = requestedOutput ?? runContext.renderManifestPath;
  await fs.mkdir(path.dirname(finalOutput), {recursive: true});
  await fs.writeFile(finalOutput, JSON.stringify(renderManifest, null, 2), "utf-8");

  if (finalOutput !== runContext.renderManifestPath) {
    await fs.writeFile(runContext.renderManifestPath, JSON.stringify(renderManifest, null, 2), "utf-8");
  }

  await writeLatestRun(runContext);
  await writeRunSummary(runContext, {
    projectId: manifest.projectId,
    runId: runContext.runId,
    sourceManifestPath: input,
    productionManifestPath: runContext.productionManifestPath,
    renderManifestPath: runContext.renderManifestPath,
    stage: "manifest-composed",
  });

  console.log(`Run ${runContext.runId} manifest written to ${runContext.renderManifestPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
