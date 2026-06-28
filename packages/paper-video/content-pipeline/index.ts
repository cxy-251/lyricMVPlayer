import type {RenderManifest, RenderScene} from "@paper-to-video/shared-types";
export {
  getCoverLayoutConfig,
  getInterpolatedCoverLayoutConfig,
  getSceneVisualIds,
  resolveSceneBackgroundImageLayoutId,
} from "./visual-system";
export {
  DEFAULT_BACKGROUND_MOTION,
  DEFAULT_CELLULAR_EFFECT,
  DEFAULT_DONUT_EFFECT,
  DEFAULT_LIGHTS_EFFECT,
  DEFAULT_PARTICLE_EFFECT,
  DEFAULT_RUBIKS_EFFECT,
  DEFAULT_TEXT_MOTIONS,
  DEFAULT_TYPOGRAPHY_SCALE,
  resolveBackgroundMotionConfig,
  resolveCellularEffectConfig,
  resolveDonutEffectConfig,
  resolveLightsEffectConfig,
  resolveParticleEffectConfig,
  resolveRubiksEffectConfig,
  resolveTextMotionConfig,
  resolveTypographyScaleConfig,
} from "./module-api";

export {getTextMotionState} from "./text-motion";
export {EFFECT_ATOMS, createModuleOverride, getEffectAtomDefinition} from "../../web3dlab/core/atoms";
export type {
  EffectAtomDefinition,
  EffectAtomId,
  EffectAtomRuntimeProps,
  EffectControlDefinition,
} from "../../web3dlab/core/simulations/types";

export type ThemePalette = {
  bg: string;
  fg: string;
  accent: string;
  panel: string;
};

export const getThemePalette = (themeId: string): ThemePalette => {
  const presets: Record<string, ThemePalette> = {
    "clean-tech": {
      bg: "#07111f",
      fg: "#f4f7fb",
      accent: "#57d8c4",
      panel: "rgba(5, 13, 24, 0.55)",
    },
  };

  return presets[themeId] ?? presets["clean-tech"];
};

export const getSceneTitle = (scene: RenderScene) => {
  if (typeof scene.content.title === "string") {
    return scene.content.title;
  }

  if (typeof scene.content.heading === "string") {
    return scene.content.heading;
  }

  return "PaperToVideo";
};

export const getSceneKicker = (scene: RenderScene, manifest: RenderManifest) => {
  if (typeof scene.content.kicker === "string" && scene.content.kicker.trim()) {
    return scene.content.kicker;
  }

  return `${manifest.paper.paperId} · AI Paper Digest`;
};

export const getSceneBody = (scene: RenderScene) => {
  if (typeof scene.content.body === "string") {
    return scene.content.body;
  }

  return "";
};

export const getSceneBullets = (scene: RenderScene) => {
  if (Array.isArray(scene.content.bullets)) {
    return scene.content.bullets.filter((item): item is string => typeof item === "string");
  }

  return [];
};
