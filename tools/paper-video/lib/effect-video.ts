import fs from "node:fs/promises";
import path from "node:path";
import type {
  BackgroundEffectId,
  EffectProfileConfig,
  RenderManifest,
  WebGLEffectProfileId,
} from "@paper-to-video/shared-types";
import {ensureRunDirectories, getRunContext, makeRunId, writeRunSummary} from "./run-artifacts";

export const mapEffectProfileToAtomId = (effectProfileId: WebGLEffectProfileId): BackgroundEffectId => {
  switch (effectProfileId) {
    case "life-game":
      return "cellular-life";
    case "snake-grid":
      return "snake-grid";
    case "particle-orbit":
      return "particle-orbit";
    case "donut-spin":
      return "donut-spin";
    case "lights-beams":
      return "lights-beams";
    case "rubiks-solver":
      return "rubiks-auto-solve";
    default:
      return "aurora";
  }
};

export const createEffectOnlyManifest = ({
  durationInFrames,
  effectProfileId,
  fps,
  height,
  modules,
  seed,
  width,
}: {
  durationInFrames: number;
  effectProfileId: WebGLEffectProfileId;
  fps: number;
  height: number;
  modules?: RenderManifest["modules"];
  seed: number;
  width: number;
}): RenderManifest => {
  const effectId = mapEffectProfileToAtomId(effectProfileId);
  const effectProfile: EffectProfileConfig = {id: effectProfileId};

  return {
    projectId: `effect-${effectProfileId}`,
    seed,
    fps,
    width,
    height,
    totalFrames: durationInFrames,
    template: {
      id: "effect-only-v1",
      path: "virtual/effect-only-v1.json",
    },
    templateDocument: {
      id: "effect-only-v1",
      version: "1.0.0",
      description: "A single-scene composition dedicated to WebGL effect capture.",
      sceneTemplates: [
        {
          sceneType: "default",
          nodes: [],
        },
        {
          sceneType: "hero",
          nodes: [],
        },
      ],
    },
    paper: {
      source: "manual",
      paperId: effectProfileId,
      title: `${effectProfileId} effect-only render`,
    },
    theme: {
      id: "clean-tech",
      paletteId: "teal-slate",
      fontPackId: "modern-cn",
    },
    voice: {
      provider: "edge-tts",
      name: "zh-CN-XiaoxiaoNeural",
      rate: "+0%",
      pitch: "+0Hz",
    },
    effectProfile,
    modules,
    scenes: [
      {
        id: "scene-effect",
        type: "hero",
        fromFrame: 0,
        durationInFrames,
        backgroundPresetId: "effect-only",
        backgroundImageLayoutId: "gradient-default",
        backgroundEffectId: effectId,
        motionPresetId: "hard-cut",
        imageAssetIds: [],
        audioSegmentIds: [],
        subtitleSegmentIds: [],
        content: {},
        timing: {
          enterFrames: 0,
          holdFrames: durationInFrames,
          exitFrames: 0,
          audioOffsetFrames: 0,
          interactionFrameOffset: 0,
          effectStartFrameOffset: 0,
        },
      },
    ],
    audioAssets: [],
    imageAssets: [],
    subtitleSegments: [],
  };
};

export const scaffoldEffectRun = async ({
  durationInFrames,
  effectProfileId,
  fps,
  height,
  modules,
  requestedRunId,
  seed,
  width,
}: {
  durationInFrames: number;
  effectProfileId: WebGLEffectProfileId;
  fps: number;
  height: number;
  modules?: RenderManifest["modules"];
  requestedRunId?: string;
  seed: number;
  width: number;
}) => {
  const runId = requestedRunId ?? makeRunId();
  const context = getRunContext(`effect-${effectProfileId}`, runId);
  await ensureRunDirectories(context);

  const manifest = createEffectOnlyManifest({
    durationInFrames,
    effectProfileId,
    fps,
    height,
    modules,
    seed,
    width,
  });

  const inputConfig = {
    mode: "effect-only",
    effectProfileId,
    durationInFrames,
    fps,
    width,
    height,
    seed,
    modules: modules ?? {},
  };

  const outputVideoPath = path.join(context.videoDir, `${context.projectSlug}.mp4`);

  await fs.writeFile(context.productionManifestPath, JSON.stringify(inputConfig, null, 2), "utf-8");
  await fs.writeFile(context.renderManifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  await writeRunSummary(context, {
    projectId: context.projectId,
    runId: context.runId,
    stage: "effect-manifest-written",
    renderManifestPath: context.renderManifestPath,
    outputVideoPath,
  });

  return {
    context,
    manifest,
    outputVideoPath,
  };
};
