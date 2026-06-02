import React from "react";
import {
  getCoverLayoutConfig,
  getEffectAtomDefinition,
  getInterpolatedCoverLayoutConfig,
  resolveContinuousEffectId,
  resolveLifeGameActivationFrame,
  resolveLifeGameInteractionFrame,
  getSceneTitle,
  getSceneVisualIds,
  getThemePalette,
  resolveBackgroundMotionConfig,
  resolveCellularEffectConfig,
  resolveDonutEffectConfig,
  resolveLightsEffectConfig,
  resolveParticleEffectConfig,
  resolveRubiksEffectConfig,
  resolveSceneBackgroundEffectId,
  resolveTextMotionConfig,
} from "@paper-to-video/content-pipeline";
import {renderTemplateZone} from "@paper-to-video/timeline-engine";
import type {
  BackgroundEffectId,
  ContentProfileDocument,
  ContentProfileRegistryDocument,
  ProductionManifest,
  RenderManifest,
  RenderScene,
  SubtitleSegment,
  TemplateDocument,
  WebGLEffectProfileId,
} from "@paper-to-video/shared-types";
import type {
  CoverLayoutConfig,
  EffectLayoutResolution,
  EffectRoute,
  LayoutResolution,
  LegacyRedirectMap,
  ProfileOption,
  RouteCollections,
  RouteLookup,
  TemplateLayoutInput,
  TemplateRoute,
  TemplateStageInput,
} from "./App.types";

declare const __LATEST_RUN_FILE__: string;
declare const __DEFAULT_RENDER_MANIFEST__: string;
declare const __DEFAULT_PRODUCTION_MANIFEST__: string;
declare const __CONTENT_PROFILE_REGISTRY__: string;
declare const __WORKSPACE_ROOT__: string;

export const EFFECT_LAB_RENDER_WIDTH = 540;
export const EFFECT_LAB_RENDER_HEIGHT = 960;
export const PAPER_EDITOR_BASE_PATH = "/paper";

const fetchJson = async <T,>(absolutePath: string) => {
  const response = await fetch(`/@fs${absolutePath}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${absolutePath}: ${response.status}`);
  }

  return (await response.json()) as T;
};

const resolveWorkspacePath = (targetPath: string) =>
  targetPath.startsWith("/") ? targetPath : `${__WORKSPACE_ROOT__}/${targetPath}`;

export const buildLocalAssetSrc = (relativePath?: string) => {
  if (!relativePath) {
    return null;
  }

  return `/@fs${__WORKSPACE_ROOT__}/${relativePath}`;
};

const loadLatestRunDescriptor = async () =>
  fetchJson<{
    productionManifestPath: string;
    renderManifestPath: string;
  }>(__LATEST_RUN_FILE__);

export const loadLatestManifest = async () => {
  const latestRun = await loadLatestRunDescriptor();
  return fetchJson<RenderManifest>(latestRun.renderManifestPath);
};

export const loadLatestProductionManifest = async () => {
  const latestRun = await loadLatestRunDescriptor();
  return fetchJson<ProductionManifest>(latestRun.productionManifestPath);
};

export const loadLatestContentProfileRegistry = async () =>
  fetchJson<ContentProfileRegistryDocument>(__CONTENT_PROFILE_REGISTRY__);

export const loadLatestContentProfileDocument = async (profilePath: string) =>
  fetchJson<ContentProfileDocument>(resolveWorkspacePath(profilePath));

export const loadDefaultProductionManifest = async () =>
  fetchJson<ProductionManifest>(__DEFAULT_PRODUCTION_MANIFEST__);

export const loadDefaultContentProfileRegistry = async () =>
  fetchJson<ContentProfileRegistryDocument>(__CONTENT_PROFILE_REGISTRY__);

export const loadDefaultContentProfileDocument = async (profilePath: string) =>
  fetchJson<ContentProfileDocument>(resolveWorkspacePath(profilePath));

export const loadContentProfileRegistry = async () =>
  fetchJson<ContentProfileRegistryDocument>(__CONTENT_PROFILE_REGISTRY__);

export const loadContentProfileDocument = async (profilePath: string) =>
  fetchJson<ContentProfileDocument>(resolveWorkspacePath(profilePath));

export const loadTemplateDocument = async (templatePath: string) =>
  fetchJson<TemplateDocument>(resolveWorkspacePath(templatePath));

export const loadLatestRenderManifest = async () => {
  const latestRun = await fetchJson<{
    renderManifestPath: string;
  }>(__LATEST_RUN_FILE__);

  return fetchJson<RenderManifest>(latestRun.renderManifestPath);
};

export const loadDefaultManifest = async () => fetchJson<RenderManifest>(__DEFAULT_RENDER_MANIFEST__);

export const templateRoutes: TemplateRoute[] = [
  {
    id: "latest-run",
    href: `${PAPER_EDITOR_BASE_PATH}/templates/latest`,
    title: "Latest Run Template",
    description: "读取 output/latest-run.json 指向的最新产物，用来验证本地案例和最新模板编排。",
    loadProductionManifest: loadLatestProductionManifest,
    loadRenderManifest: loadLatestManifest,
  },
  {
    id: "repo-demo",
    href: `${PAPER_EDITOR_BASE_PATH}/templates/demo`,
    title: "Repository Demo Template",
    description: "读取仓库内默认 render manifest，作为稳定基线模板案例。",
    loadProductionManifest: loadDefaultProductionManifest,
    loadRenderManifest: loadDefaultManifest,
  },
];

export const effectRoutes: EffectRoute[] = [
  {
    id: "effect-life-game",
    href: `${PAPER_EDITOR_BASE_PATH}/effects/life-game`,
    title: "Life Game Effect",
    description: "单独查看可点击启动的生命游戏中间层原子，后续小游戏也沿这套接口扩展。",
    effectId: "cellular-life",
    source: "default",
  },
  {
    id: "effect-snake-grid",
    href: `${PAPER_EDITOR_BASE_PATH}/effects/snake-grid`,
    title: "Snake Grid Effect",
    description: "单独查看贪吃蛇网格型 WebGL 中间层原子，用于验证第二类小游戏动效接口。",
    effectId: "snake-grid",
    source: "default",
  },
  {
    id: "effect-particle-orbit",
    href: `${PAPER_EDITOR_BASE_PATH}/effects/particle-orbit`,
    title: "Particle Orbit Effect",
    description: "单独查看粒子轨道型 WebGL 中间层原子，用于承接更偏 Three.js 官网氛围案例的视觉方向。",
    effectId: "particle-orbit",
    source: "default",
  },
  {
    id: "effect-donut-spin",
    href: `${PAPER_EDITOR_BASE_PATH}/effects/donut-spin`,
    title: "Donut Spin Effect",
    description: "单独查看旋转甜甜圈型 WebGL 中间层原子，用于承接更强调中心主体、材质和珠点环绕的案例方向。",
    effectId: "donut-spin",
    source: "default",
  },
  {
    id: "effect-lights-beams",
    href: `${PAPER_EDITOR_BASE_PATH}/effects/lights-beams`,
    title: "Lights Beams Effect",
    description: "单独查看发光束线型 WebGL 中间层原子，用于承接更偏舞台灯束、音乐可视化和沉浸式空间氛围的案例方向。",
    effectId: "lights-beams",
    source: "default",
  },
  {
    id: "effect-rubiks-solver",
    href: `${PAPER_EDITOR_BASE_PATH}/effects/rubiks-solver`,
    title: "Rubiks Solver Effect",
    description: "单独查看自动解魔方型 WebGL 中间层原子，用来承接更偏空间结构和解题机械感的 Three.js 案例。",
    effectId: "rubiks-auto-solve",
    source: "default",
  },
];

export const legacyRedirects: LegacyRedirectMap = {
  "/effects/cellular-launch": `${PAPER_EDITOR_BASE_PATH}/effects/life-game`,
  "/effects/cellular-life": `${PAPER_EDITOR_BASE_PATH}/effects/life-game`,
  "/effects/aurora": `${PAPER_EDITOR_BASE_PATH}/effects/life-game`,
  "/effects/life-game": `${PAPER_EDITOR_BASE_PATH}/effects/life-game`,
  "/effects/snake-grid": `${PAPER_EDITOR_BASE_PATH}/effects/snake-grid`,
  "/effects/particle-orbit": `${PAPER_EDITOR_BASE_PATH}/effects/particle-orbit`,
  "/effects/donut-spin": `${PAPER_EDITOR_BASE_PATH}/effects/donut-spin`,
  "/effects/lights-beams": `${PAPER_EDITOR_BASE_PATH}/effects/lights-beams`,
  "/effects/rubiks-solver": `${PAPER_EDITOR_BASE_PATH}/effects/rubiks-solver`,
  "/previews/demo": `${PAPER_EDITOR_BASE_PATH}/templates/demo`,
  "/previews/latest": `${PAPER_EDITOR_BASE_PATH}/templates/latest`,
  "/templates/demo": `${PAPER_EDITOR_BASE_PATH}/templates/demo`,
  "/templates/latest": `${PAPER_EDITOR_BASE_PATH}/templates/latest`,
};

export const routeCollections: RouteCollections = {
  effectRoutes,
  templateRoutes,
};

export const resolveInitialPath = (pathname: string) => legacyRedirects[pathname] ?? pathname;

export const findRoutes = (pathname: string): RouteLookup => ({
  templateRoute: templateRoutes.find((route) => route.href === pathname) ?? null,
  effectRoute: effectRoutes.find((route) => route.href === pathname) ?? null,
});

export const formatSeconds = (frames: number, fps: number) => `${(frames / fps).toFixed(1)}s`;

export const effectProfileOptions: ProfileOption<WebGLEffectProfileId>[] = [
  {
    id: "life-game",
    label: "Life Game",
    description: "Launch button + continuous cellular automata evolution.",
  },
  {
    id: "snake-grid",
    label: "Snake Grid",
    description: "Grid-based snake pathing as the middle WebGL layer.",
  },
  {
    id: "particle-orbit",
    label: "Particle Orbit",
    description: "Centered particle orbit field inspired by Three.js atmosphere studies.",
  },
  {
    id: "donut-spin",
    label: "Donut Spin",
    description: "Glossy rotating donut with orbiting pearls as a bold central subject.",
  },
  {
    id: "lights-beams",
    label: "Lights Beams",
    description: "Centered luminous beam choreography inspired by the Hello Enjoy Lights interaction.",
  },
  {
    id: "rubiks-solver",
    label: "Rubiks Solver",
    description: "Auto-solving 3D cube effect inspired by Stewart Smith's Rubik's Cube Explorer.",
  },
];

const buildSceneSubtitles = (
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

export const resolveContentProfileOptions = (
  registry: ContentProfileRegistryDocument | null,
  productionManifest: ProductionManifest | null,
) => {
  const options: ProfileOption[] = [];
  const existing = new Set<string>();

  for (const entry of registry?.profiles ?? []) {
    existing.add(entry.id);
    options.push({
      id: entry.id,
      label: entry.label ?? entry.id,
      description: entry.path,
    });
  }

  if (productionManifest?.contentProfile?.id && !existing.has(productionManifest.contentProfile.id)) {
    options.unshift({
      id: productionManifest.contentProfile.id,
      label: productionManifest.contentProfile.id,
      description: productionManifest.contentProfile.path,
    });
  }

  return options;
};

export const resolveContentProfilePath = (
  registry: ContentProfileRegistryDocument | null,
  productionManifest: ProductionManifest | null,
  profileId: string,
) => {
  if (!profileId) {
    return null;
  }

  const registryEntry = registry?.profiles.find((item) => item.id === profileId);
  if (registryEntry) {
    return registryEntry.path;
  }

  if (productionManifest?.contentProfile?.id === profileId) {
    return productionManifest.contentProfile.path ?? null;
  }

  return null;
};

export const createTemplatePreviewManifest = ({
  contentProfile,
  effectProfileId,
  productionManifest,
  renderManifest,
  templateDocument,
}: {
  contentProfile: ContentProfileDocument | null;
  effectProfileId: WebGLEffectProfileId;
  productionManifest: ProductionManifest;
  renderManifest: RenderManifest;
  templateDocument: TemplateDocument;
}) => {
  const nextScenes = renderManifest.scenes.map((renderScene) => {
    const sourceScene = productionManifest.scenes.find((scene) => scene.id === renderScene.id);
    if (!sourceScene) {
      return renderScene;
    }

    const contentProfileScene = contentProfile?.scenes[sourceScene.contentRef];
    const narrationText = contentProfileScene?.narrationText ?? sourceScene.narrationText ?? "";
    const nextContent = contentProfileScene?.content ?? renderScene.content;

    return {
      ...renderScene,
      backgroundEffectId: resolveSceneBackgroundEffectId(sourceScene, {id: effectProfileId}),
      content: nextContent,
      subtitleSegmentIds: buildSceneSubtitles(
        renderScene.id,
        renderScene.fromFrame,
        narrationText,
        renderScene.durationInFrames,
      ).map((segment) => segment.id),
    };
  });

  const nextSubtitleSegments = nextScenes.flatMap((scene) => {
    const sourceScene = productionManifest.scenes.find((item) => item.id === scene.id);
    const contentProfileScene = sourceScene ? contentProfile?.scenes[sourceScene.contentRef] : null;
    const narrationText = contentProfileScene?.narrationText ?? sourceScene?.narrationText ?? "";
    return buildSceneSubtitles(scene.id, scene.fromFrame, narrationText, scene.durationInFrames);
  });

  return {
    ...renderManifest,
    projectId: `${productionManifest.projectId}-${effectProfileId}-${contentProfile?.id ?? productionManifest.contentProfile?.id ?? "content"}`,
    templateDocument,
    paper: {
      ...renderManifest.paper,
      ...(contentProfile?.paper ?? {}),
    },
    effectProfile: {id: effectProfileId},
    scenes: nextScenes,
    subtitleSegments: nextSubtitleSegments,
  } satisfies RenderManifest;
};

export const getEffectStartLabel = (effectId: EffectRoute["effectId"]) => {
  switch (effectId) {
    case "snake-grid":
      return "Start Snake Grid";
    case "particle-orbit":
      return "Start Particle Orbit";
    case "donut-spin":
      return "Spin Donut";
    case "lights-beams":
      return "Ignite Lights";
    case "rubiks-auto-solve":
      return "Start Cube Solver";
    default:
      return "Start Life Simulation";
  }
};

export const findEffectScene = (manifest: RenderManifest, effectId: BackgroundEffectId): RenderScene => {
  const matched = manifest.scenes.find((scene) => getSceneVisualIds(scene).backgroundEffectId === effectId);
  return matched ?? manifest.scenes[0];
};

export const getCoverImageSrc = (manifest: RenderManifest) =>
  manifest.coverImage?.source === "remote"
    ? manifest.coverImage.path
    : buildLocalAssetSrc(manifest.coverImage?.path);

const resolveTemplateLayout = ({
  activeScene,
  manifest,
  previewFrame,
}: TemplateLayoutInput): LayoutResolution => {
  const palette = getThemePalette(manifest.theme.id);
  const {backgroundImageLayoutId, backgroundEffectId} = getSceneVisualIds(activeScene);
  const backgroundMotion = resolveBackgroundMotionConfig(manifest.modules);
  const textMotion = resolveTextMotionConfig(activeScene.motionPresetId, manifest.modules);
  const activeSceneIndex = manifest.scenes.findIndex((scene) => scene.id === activeScene.id);
  const previousScene = activeSceneIndex > 0 ? manifest.scenes[activeSceneIndex - 1] : null;
  const previousLayoutId = previousScene ? getSceneVisualIds(previousScene).backgroundImageLayoutId : "cover-full";
  const sceneDuration = Math.max(1, activeScene.durationInFrames);
  const sceneMotionProgress = previewFrame / sceneDuration;
  const visualLayout =
    previousLayoutId === backgroundImageLayoutId
      ? getCoverLayoutConfig(backgroundImageLayoutId, backgroundMotion.panTravelPercent)
      : getInterpolatedCoverLayoutConfig({
          fromLayoutId: previousLayoutId,
          toLayoutId: backgroundImageLayoutId,
          progress: Math.min(1, Math.max(0, sceneMotionProgress)),
          panTravelPercent: backgroundMotion.panTravelPercent,
        });
  const usesCoverImage = backgroundImageLayoutId !== "gradient-default";
  const stageBackground =
    usesCoverImage
      ? "linear-gradient(180deg, #050c13 0%, #071019 100%)"
      : `radial-gradient(circle at 20% 20%, ${palette.accent}33, transparent 28%), linear-gradient(135deg, ${palette.bg}, #10253a 48%, #081018)`;

  /**
   * We anchor template preview activation to the launch scene so the editor and
   * the final render use the same moment as the effect hand-off boundary.
   */
  return {
    activationFrame: resolveLifeGameActivationFrame(manifest),
    continuousEffectId: resolveContinuousEffectId(manifest),
    interactionFrame: resolveLifeGameInteractionFrame(manifest),
    backgroundEffectId,
    coverImageSrc: getCoverImageSrc(manifest),
    palette,
    stageBackground,
    textMotion,
    visualLayout,
  };
};

export const createTemplateStageModel = ({
  activeScene,
  activeSubtitles,
  manifest,
  previewFrame,
}: TemplateStageInput) => {
  const layout = resolveTemplateLayout({activeScene, manifest, previewFrame});
  const absolutePreviewFrame = activeScene.fromFrame + previewFrame;
  const primaryNodes = renderTemplateZone({
    zone: "primary",
    context: {
      manifest,
      scene: activeScene,
      coverSrc: layout.coverImageSrc,
      subtitleText: activeSubtitles[0]?.text ?? null,
    },
  });
  const secondaryNodes = renderTemplateZone({
    zone: "secondary",
    context: {
      manifest,
      scene: activeScene,
      coverSrc: layout.coverImageSrc,
      subtitleText: activeSubtitles[0]?.text ?? null,
    },
  });

  return {
    absolutePreviewFrame,
    activationFrame: layout.activationFrame,
    continuousEffectId: layout.continuousEffectId,
    interactionFrame: layout.interactionFrame,
    backgroundEffectId: layout.backgroundEffectId,
    coverImageSrc: layout.coverImageSrc,
    palette: layout.palette,
    primaryNodes,
    renderHeight: manifest.height,
    renderWidth: manifest.width,
    secondaryNodes,
    stageBackground: layout.stageBackground,
    textMotion: layout.textMotion,
    visualLayout: layout.visualLayout,
  };
};

export const createEffectStageModel = ({
  effectRoute,
  isRunning,
  manifest,
  moduleOverrides,
  scene,
  simulationFrame,
}: {
  effectRoute: EffectRoute;
  isRunning: boolean;
  manifest: RenderManifest;
  moduleOverrides?: RenderManifest["modules"];
  scene: RenderScene;
  simulationFrame: number;
}): EffectLayoutResolution => {
  const palette = getThemePalette(manifest.theme.id);
  const mergedModules = {
    ...(manifest.modules ?? {}),
    ...(moduleOverrides ?? {}),
    cellularEffect: {
      ...(manifest.modules?.cellularEffect ?? {}),
      ...(moduleOverrides?.cellularEffect ?? {}),
    },
      particleEffect: {
        ...(manifest.modules?.particleEffect ?? {}),
        ...(moduleOverrides?.particleEffect ?? {}),
      },
      donutEffect: {
        ...(manifest.modules?.donutEffect ?? {}),
        ...(moduleOverrides?.donutEffect ?? {}),
      },
      lightsEffect: {
        ...(manifest.modules?.lightsEffect ?? {}),
        ...(moduleOverrides?.lightsEffect ?? {}),
    },
    rubiksEffect: {
      ...(manifest.modules?.rubiksEffect ?? {}),
      ...(moduleOverrides?.rubiksEffect ?? {}),
    },
    backgroundMotion: {
      ...(manifest.modules?.backgroundMotion ?? {}),
      ...(moduleOverrides?.backgroundMotion ?? {}),
    },
  };
  const backgroundMotion = resolveBackgroundMotionConfig(mergedModules);
  const visualLayout = getCoverLayoutConfig("cover-full", backgroundMotion.panTravelPercent);

  /**
   * The effect lab is an isolated sandbox. We intentionally decouple it from
   * scene timelines so a user click can deterministically start the simulation.
   */
  return {
    absolutePreviewFrame: isRunning ? simulationFrame : 0,
    activationFrame: 0,
    continuousEffectId: effectRoute.effectId,
    interactionFrame: 0,
    coverImageSrc: null,
    effectId: effectRoute.effectId,
    modules: {
      ...mergedModules,
      cellularEffect: resolveCellularEffectConfig(mergedModules),
      particleEffect: resolveParticleEffectConfig(mergedModules),
      donutEffect: resolveDonutEffectConfig(mergedModules),
      lightsEffect: resolveLightsEffectConfig(mergedModules),
      rubiksEffect: resolveRubiksEffectConfig(mergedModules),
      backgroundMotion: resolveBackgroundMotionConfig(mergedModules),
    },
    palette,
    renderHeight: EFFECT_LAB_RENDER_HEIGHT,
    renderWidth: EFFECT_LAB_RENDER_WIDTH,
    stageBackground:
      "radial-gradient(circle at 50% 50%, rgba(87,216,196,0.12) 0%, transparent 26%), linear-gradient(180deg, #03070c 0%, #071019 100%)",
    visualLayout,
  };
};

export const getEffectDefinition = (effectId: EffectRoute["effectId"]) => getEffectAtomDefinition(effectId);

export const getSceneLabel = (scene: RenderScene) => getSceneTitle(scene);

export const isLoadingState = <T,>(value: T | null, errorMessage: string | null) => !value || Boolean(errorMessage);
