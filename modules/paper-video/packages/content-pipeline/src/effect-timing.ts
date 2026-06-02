import {resolveCellularEffectConfig} from "./module-api";
import type {BackgroundEffectId, RenderManifest, RenderScene} from "@paper-to-video/shared-types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const resolveLaunchCueOffsets = ({
  scene,
  modules,
}: {
  scene: Pick<RenderScene, "timing">;
  modules?: RenderManifest["modules"];
}) => {
  const config = resolveCellularEffectConfig(modules);
  const clickFrames = clamp(
    Math.round(scene.timing.holdFrames * config.launchClickRatio),
    config.minLaunchClickFrames,
    config.maxLaunchClickFrames,
  );
  const settleFrames = clamp(
    Math.round(scene.timing.holdFrames * config.launchSettleRatio),
    config.minLaunchSettleFrames,
    config.maxLaunchSettleFrames,
  );
  const interactionFrameOffset = scene.timing.enterFrames + Math.min(scene.timing.holdFrames - 1, clickFrames);
  const effectStartFrameOffset =
    scene.timing.enterFrames + Math.min(scene.timing.holdFrames - 1, clickFrames + settleFrames);

  return {
    interactionFrameOffset,
    effectStartFrameOffset:
      settleFrames <= 0
        ? interactionFrameOffset
        : Math.max(interactionFrameOffset, effectStartFrameOffset),
  };
};

export const resolveLifeGameActivationFrame = (manifest: RenderManifest) => {
  const launchScene =
    manifest.scenes.find(
      (scene) =>
        scene.backgroundEffectId === "cellular-launch" ||
        scene.backgroundEffectId === "rubiks-launch" ||
        scene.backgroundEffectId === "lights-launch",
    ) ?? null;

  if (!launchScene) {
    return 0;
  }

  return launchScene.fromFrame + launchScene.timing.effectStartFrameOffset;
};

export const resolveLifeGameInteractionFrame = (manifest: RenderManifest) => {
  const launchScene =
    manifest.scenes.find(
      (scene) =>
        scene.backgroundEffectId === "cellular-launch" ||
        scene.backgroundEffectId === "rubiks-launch" ||
        scene.backgroundEffectId === "lights-launch",
    ) ?? null;

  if (!launchScene) {
    return 0;
  }

  return launchScene.fromFrame + launchScene.timing.interactionFrameOffset;
};

export const resolveContinuousEffectId = (manifest: RenderManifest): BackgroundEffectId => {
  if (manifest.effectProfile?.id === "snake-grid") {
    return "snake-grid";
  }

  if (manifest.effectProfile?.id === "particle-orbit") {
    return "particle-orbit";
  }

  if (manifest.effectProfile?.id === "donut-spin") {
    return "donut-spin";
  }

  if (manifest.effectProfile?.id === "lights-beams") {
    return "lights-beams";
  }

  if (manifest.effectProfile?.id === "rubiks-solver") {
    return "rubiks-auto-solve";
  }

  return "cellular-life";
};
