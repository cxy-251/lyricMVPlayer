import React from "react";
import {AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {
  EffectRuntimeAdapter,
  getCoverLayoutConfig,
  getCellularLaunchOrigin,
  getInterpolatedCoverLayoutConfig,
  getSceneVisualIds,
  getThemePalette,
  getTextMotionState,
  resolveBackgroundMotionConfig,
  resolveContinuousEffectId,
  resolveLifeGameActivationFrame,
  resolveLifeGameInteractionFrame,
  resolveTextMotionConfig,
} from "@paper-to-video/content-pipeline";
import {renderTemplateZone} from "@paper-to-video/timeline-engine";
import type {
  AudioAsset,
  BackgroundEffectId,
  BackgroundImageLayoutId,
  CoverImageAsset,
  RenderManifest,
  RenderScene,
  SubtitleSegment,
} from "@paper-to-video/shared-types";
import {EffectCanvas} from "../../visual-effects/runtime";
import type {VisualEffectConfigMap, VisualEffectId} from "../../visual-effects/types";

declare const __WORKSPACE_ROOT__: string | undefined;

export type PaperCreativeEffect = {
  config: VisualEffectConfigMap[VisualEffectId];
  id: VisualEffectId;
};

const findSubtitle = (segments: SubtitleSegment[], frame: number) =>
  segments.find((segment) => frame >= segment.startFrame && frame < segment.endFrame);

const isRemoteAsset = (assetPath: string) => /^(https?:|data:|blob:)/.test(assetPath);

const canUseViteFileServing = () =>
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  Boolean(document.querySelector('script[src*="/@vite/client"]'));

const resolveAssetSrc = (assetPath?: string | null) => {
  if (!assetPath) {
    return null;
  }

  if (isRemoteAsset(assetPath) || assetPath.startsWith("/@fs/")) {
    return assetPath;
  }

  // The studio preview loads paper artifacts from the workspace instead of Remotion's public folder.
  if (canUseViteFileServing()) {
    if (assetPath.startsWith("/")) {
      return `/@fs${assetPath}`;
    }

    if (typeof __WORKSPACE_ROOT__ !== "undefined" && __WORKSPACE_ROOT__) {
      return `/@fs${__WORKSPACE_ROOT__}/${assetPath.replace(/^\.\//, "")}`;
    }
  }

  if (assetPath.startsWith("/")) {
    return assetPath;
  }

  return staticFile(assetPath);
};

const resolveCoverImageSrc = (coverImage?: CoverImageAsset) => {
  return coverImage?.source === "remote" ? coverImage.path : resolveAssetSrc(coverImage?.path);
};

type EffectLayerConfig = {
  opacity: number;
  renderScale: number;
  scale: number;
  translateY: number;
  filter?: string;
};

const effectLayerConfigs: Partial<Record<BackgroundEffectId, EffectLayerConfig>> = {
  "cellular-life": {opacity: 0.34, renderScale: 0.82, scale: 0.88, translateY: 72, filter: "saturate(0.9) brightness(0.72)"},
  "snake-grid": {opacity: 0.42, renderScale: 0.82, scale: 0.9, translateY: 88, filter: "saturate(0.9) brightness(0.76)"},
  "particle-orbit": {opacity: 0.48, renderScale: 0.76, scale: 0.82, translateY: 112, filter: "saturate(0.92) brightness(0.76)"},
  "donut-spin": {opacity: 0.62, renderScale: 0.7, scale: 0.72, translateY: 136, filter: "saturate(0.9) brightness(0.78)"},
  "lights-beams": {opacity: 0.5, renderScale: 0.82, scale: 0.86, translateY: 122, filter: "saturate(0.9) brightness(0.74)"},
  "rubiks-auto-solve": {opacity: 0.56, renderScale: 0.68, scale: 0.7, translateY: 142, filter: "saturate(0.88) brightness(0.76)"},
  aurora: {opacity: 0.62, renderScale: 1, scale: 1, translateY: 0},
  "grid-drift": {opacity: 0.28, renderScale: 1, scale: 1, translateY: 0},
  "noise-bloom": {opacity: 0.5, renderScale: 1, scale: 1, translateY: 0},
};

const defaultEffectLayerConfig: EffectLayerConfig = {
  opacity: 0.46,
  renderScale: 0.84,
  scale: 0.9,
  translateY: 96,
  filter: "saturate(0.9) brightness(0.78)",
};

const creativeEffectLayerConfigs: Record<VisualEffectId, EffectLayerConfig> = {
  "particle-galaxy": {opacity: 0.5, renderScale: 0.84, scale: 0.9, translateY: 96, filter: "saturate(0.9) brightness(0.76)"},
  "neon-energy-tunnel": {opacity: 0.46, renderScale: 0.9, scale: 0.94, translateY: 64, filter: "saturate(0.86) brightness(0.7)"},
  "fluid-cursor-field": {opacity: 0.42, renderScale: 1, scale: 1, translateY: 0, filter: "saturate(0.82) brightness(0.7)"},
  "physics-cloth-banner": {opacity: 0.54, renderScale: 0.76, scale: 0.78, translateY: 120, filter: "saturate(0.86) brightness(0.76)"},
  "particle-morphing-field": {opacity: 0.52, renderScale: 0.78, scale: 0.82, translateY: 112, filter: "saturate(0.9) brightness(0.72)"},
};

const getEffectLayerConfig = (effectId: BackgroundEffectId) =>
  effectLayerConfigs[effectId] ?? defaultEffectLayerConfig;

const getConstrainedEffectModules = (
  effectId: BackgroundEffectId,
  modules: RenderManifest["modules"] | undefined,
): RenderManifest["modules"] | undefined => {
  if (effectId === "donut-spin") {
    const donutEffect = modules?.donutEffect ?? {};
    return {
      ...modules,
      donutEffect: {
        ...donutEffect,
        ringRadius: typeof donutEffect.ringRadius === "number" ? donutEffect.ringRadius * 0.68 : 0.64,
        tubeRadius: typeof donutEffect.tubeRadius === "number" ? donutEffect.tubeRadius * 0.72 : 0.18,
        pearlCount: Math.min(4, typeof donutEffect.pearlCount === "number" ? donutEffect.pearlCount : 4),
      },
    };
  }

  if (effectId === "rubiks-auto-solve") {
    const rubiksEffect = modules?.rubiksEffect ?? {};
    return {
      ...modules,
      rubiksEffect: {
        ...rubiksEffect,
        cubeScale: typeof rubiksEffect.cubeScale === "number" ? rubiksEffect.cubeScale * 0.62 : 0.62,
        cameraDrift: typeof rubiksEffect.cameraDrift === "number" ? rubiksEffect.cameraDrift * 0.7 : 0.05,
        floatAmplitude: typeof rubiksEffect.floatAmplitude === "number" ? rubiksEffect.floatAmplitude * 0.7 : 0.05,
      },
    };
  }

  return modules;
};

const EffectSafeFrame: React.FC<{
  children: React.ReactNode;
  config: EffectLayerConfig;
}> = ({children, config}) => {
  return (
    <AbsoluteFill style={{overflow: "hidden", pointerEvents: "none"}}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: config.opacity,
          transform: `translate3d(0, ${config.translateY}px, 0) scale(${config.scale})`,
          transformOrigin: "50% 52%",
          filter: config.filter,
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

const PaperEffectSafeFrame: React.FC<{
  children: React.ReactNode;
  effectId: BackgroundEffectId;
}> = ({children, effectId}) => <EffectSafeFrame config={getEffectLayerConfig(effectId)}>{children}</EffectSafeFrame>;

const CreativeEffectLayer: React.FC<{
  creativeEffect: PaperCreativeEffect;
}> = ({creativeEffect}) => (
  <EffectSafeFrame config={creativeEffectLayerConfigs[creativeEffect.id]}>
    <EffectCanvas
      className="visual-effect-canvas visual-effect-canvas--paper"
      config={creativeEffect.config}
      effectId={creativeEffect.id}
      seed={1307}
    />
  </EffectSafeFrame>
);

const ReadabilityVeil: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `
        linear-gradient(180deg, rgba(5,10,16,0.72) 0%, rgba(5,10,16,0.34) 28%, rgba(5,10,16,0.18) 52%, rgba(5,10,16,0.72) 100%),
        radial-gradient(ellipse at 50% 48%, rgba(5,10,16,0) 0%, rgba(5,10,16,0.2) 78%)
      `,
    }}
  />
);

const BackgroundImageLayer: React.FC<{
  coverSrc: string | null;
  fromLayoutId: BackgroundImageLayoutId;
  toLayoutId: BackgroundImageLayoutId;
  progress: number;
  overscanPercent: number;
  panTravelPercent: number;
}> = ({coverSrc, fromLayoutId, toLayoutId, progress, overscanPercent, panTravelPercent}) => {
  if (!coverSrc || toLayoutId === "gradient-default") {
    return null;
  }

  const config =
    fromLayoutId === toLayoutId
      ? getCoverLayoutConfig(toLayoutId, panTravelPercent)
      : getInterpolatedCoverLayoutConfig({fromLayoutId, toLayoutId, progress, panTravelPercent});
  const overscan = `${100 + overscanPercent}%`;
  const offset = `${-(overscanPercent / 2)}%`;
  return (
    <AbsoluteFill style={{overflow: "hidden"}}>
      <Img
        src={coverSrc}
        style={{
          width: overscan,
          height: overscan,
          left: offset,
          top: offset,
          position: "absolute",
          objectFit: "cover",
          objectPosition: "center center",
          opacity: config.opacity,
          filter: `blur(${config.blurPx}px) saturate(${config.saturation}) brightness(${config.brightness})`,
          transform: `translate(${config.translateX}%, ${config.translateY}%) scale(${config.scale})`,
        }}
      />
      <AbsoluteFill style={{background: config.shade}} />
    </AbsoluteFill>
  );
};

const BackgroundEffectLayer: React.FC<{
  effectId: BackgroundEffectId;
  sceneFrame: number;
  absoluteFrame: number;
  activationFrame: number;
  interactionFrame: number;
  effectStartFrame: number;
  continuousEffectId: BackgroundEffectId;
  themeId: string;
  seed: number;
  modules?: RenderManifest["modules"];
}> = ({effectId, sceneFrame, absoluteFrame, activationFrame, interactionFrame, effectStartFrame, continuousEffectId, themeId, seed, modules}) => {
  const palette = getThemePalette(themeId);
  const {width, height} = useVideoConfig();
  const layerConfig = getEffectLayerConfig(effectId);
  const effectWidth = Math.max(1, Math.round(width * layerConfig.renderScale));
  const effectHeight = Math.max(1, Math.round(height * layerConfig.renderScale));
  const safeModules = getConstrainedEffectModules(effectId, modules);

  if (effectId === "none") {
    return null;
  }

  if (
    effectId === "cellular-life" ||
    effectId === "cellular-launch" ||
    effectId === "snake-grid" ||
    effectId === "particle-orbit" ||
    effectId === "donut-spin" ||
    effectId === "lights-launch" ||
    effectId === "lights-beams" ||
    effectId === "rubiks-launch" ||
    effectId === "rubiks-auto-solve"
  ) {
    return (
      <PaperEffectSafeFrame effectId={effectId}>
        <EffectRuntimeAdapter
          absoluteFrame={absoluteFrame}
          activationFrame={activationFrame}
          continuousEffectId={
            continuousEffectId === "snake-grid"
              ? "snake-grid"
              : continuousEffectId === "particle-orbit"
                ? "particle-orbit"
                : continuousEffectId === "donut-spin"
                  ? "donut-spin"
                : continuousEffectId === "lights-beams"
                  ? "lights-beams"
                : continuousEffectId === "rubiks-auto-solve"
                  ? "rubiks-auto-solve"
                  : "cellular-life"
          }
          interactionFrame={interactionFrame}
          effectStartFrame={effectStartFrame}
          effectId={effectId}
          height={effectHeight}
          mode="render"
          modules={safeModules}
          seed={seed}
          width={effectWidth}
        />
      </PaperEffectSafeFrame>
    );
  }

  if (effectId === "grid-drift") {
    return (
      <PaperEffectSafeFrame effectId={effectId}>
        <AbsoluteFill
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(87,216,196,0.14) 0%, transparent 40%, rgba(255,255,255,0.08) 100%)
            `,
            backgroundSize: "44px 44px, 44px 44px, 100% 100%",
            backgroundPosition: `${(sceneFrame * 0.8) % 44}px ${(sceneFrame * 0.3) % 44}px, ${(sceneFrame * 0.8) % 44}px ${(sceneFrame * 0.3) % 44}px, 0 0`,
          }}
        />
      </PaperEffectSafeFrame>
    );
  }

  if (effectId === "noise-bloom") {
    return (
      <PaperEffectSafeFrame effectId={effectId}>
        <AbsoluteFill
          style={{
            background: `
              radial-gradient(circle at ${22 + (sceneFrame % 24)}% 24%, rgba(87,216,196,0.18) 0%, transparent 24%),
              radial-gradient(circle at 80% ${68 + (sceneFrame % 16) * 0.4}%, rgba(255,255,255,0.12) 0%, transparent 18%)
            `,
          }}
        />
      </PaperEffectSafeFrame>
    );
  }

  if (effectId === "aurora") {
    return (
      <PaperEffectSafeFrame effectId={effectId}>
        <AbsoluteFill
          style={{
            background: `
              radial-gradient(circle at 18% 22%, ${palette.accent}22 0%, transparent 22%),
              radial-gradient(circle at 82% 76%, rgba(255,255,255,0.10) 0%, transparent 18%)
            `,
          }}
        />
      </PaperEffectSafeFrame>
    );
  }

  return (
    <PaperEffectSafeFrame effectId={effectId}>
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0))",
        }}
      />
    </PaperEffectSafeFrame>
  );
};

const Background: React.FC<{
  themeId: string;
  sceneFrame: number;
  absoluteFrame: number;
  scene: RenderScene;
  previousLayoutId: BackgroundImageLayoutId;
  activationFrame: number;
  interactionFrame: number;
  effectStartFrame: number;
  continuousEffectId: BackgroundEffectId;
  coverImage?: CoverImageAsset;
  seed: number;
  modules?: RenderManifest["modules"];
}> = ({themeId, sceneFrame, absoluteFrame, scene, previousLayoutId, activationFrame, interactionFrame, effectStartFrame, continuousEffectId, coverImage, seed, modules}) => {
  const palette = getThemePalette(themeId);
  const glowX = 15 + (sceneFrame % 160) * 0.38;
  const glowY = 18 + (sceneFrame % 220) * 0.18;
  const accentAlpha = sceneFrame % 120 < 60 ? "88" : "66";
  const coverSrc = resolveCoverImageSrc(coverImage);
  const {backgroundImageLayoutId, backgroundEffectId} = getSceneVisualIds(scene);
  const usesCoverImage = backgroundImageLayoutId !== "gradient-default";
  const motionProgress = Math.min(1, Math.max(0, sceneFrame / Math.max(1, scene.durationInFrames - 1)));
  const backgroundMotion = resolveBackgroundMotionConfig(modules);

  return (
    <AbsoluteFill
      style={{
        background:
          usesCoverImage
            ? "linear-gradient(180deg, #050c13 0%, #071019 100%)"
            : `
                linear-gradient(115deg, rgba(255,255,255,0.04) 0%, transparent 30%),
                radial-gradient(circle at ${glowX}% ${glowY}%, ${palette.accent}${accentAlpha} 0%, transparent 24%),
                radial-gradient(circle at 78% 82%, rgba(255,255,255,0.06) 0%, transparent 18%),
                linear-gradient(135deg, ${palette.bg}, #10253a 48%, #081018)
              `,
      }}
    >
      <BackgroundImageLayer
        coverSrc={coverSrc}
        fromLayoutId={previousLayoutId}
        toLayoutId={backgroundImageLayoutId}
        progress={motionProgress}
        overscanPercent={backgroundMotion.overscanPercent}
        panTravelPercent={backgroundMotion.panTravelPercent}
      />
      <BackgroundEffectLayer
        effectId={backgroundEffectId}
        sceneFrame={sceneFrame}
        absoluteFrame={absoluteFrame}
        activationFrame={activationFrame}
        interactionFrame={interactionFrame}
        effectStartFrame={effectStartFrame}
        continuousEffectId={continuousEffectId}
        themeId={themeId}
        seed={seed}
        modules={modules}
      />
      <ReadabilityVeil />
    </AbsoluteFill>
  );
};

const SceneCard: React.FC<{
  creativeEffect?: PaperCreativeEffect;
  scene: RenderScene;
  manifest: RenderManifest;
}> = ({creativeEffect, scene, manifest}) => {
  const KUAISHOU_SAFE_INSET = {
    top: 96,
    right: 128,
    bottom: 392,
    left: 128,
    primaryOffsetY: 92,
  } as const;
  const localFrame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const theme = getThemePalette(manifest.theme.id);
  const sceneFrame = localFrame;
  const absoluteFrame = scene.fromFrame + localFrame;
  const textMotion = resolveTextMotionConfig(scene.motionPresetId, manifest.modules);
  const subtitle = findSubtitle(
    manifest.subtitleSegments.filter((segment) => segment.sceneId === scene.id),
    absoluteFrame,
  );
  const coverSrc = resolveCoverImageSrc(manifest.coverImage);
  const isHero = scene.type === "hero";
  const sceneIndex = manifest.scenes.findIndex((item) => item.id === scene.id);
  const previousScene = sceneIndex > 0 ? manifest.scenes[sceneIndex - 1] : null;
  const previousLayoutId = previousScene
    ? getSceneVisualIds(previousScene).backgroundImageLayoutId
    : "cover-full";
  const activationFrame = resolveLifeGameActivationFrame(manifest);
  const interactionFrame = resolveLifeGameInteractionFrame(manifest);
  const continuousEffectId = resolveContinuousEffectId(manifest);
  const primaryNodes = renderTemplateZone({
    zone: "primary",
    context: {
      manifest,
      scene,
      coverSrc,
      subtitleText: subtitle?.text ?? null,
    },
  });
  const secondaryNodes = renderTemplateZone({
    zone: "secondary",
    context: {
      manifest,
      scene,
      coverSrc,
      subtitleText: subtitle?.text ?? null,
    },
  });

  return (
    <AbsoluteFill>
      <Background
        themeId={manifest.theme.id}
        sceneFrame={sceneFrame}
        absoluteFrame={absoluteFrame}
        scene={scene}
        previousLayoutId={previousLayoutId}
        activationFrame={activationFrame}
        interactionFrame={interactionFrame}
        effectStartFrame={activationFrame}
        continuousEffectId={continuousEffectId}
        coverImage={manifest.coverImage}
        seed={manifest.seed}
        modules={manifest.modules}
      />
      {creativeEffect ? <CreativeEffectLayer creativeEffect={creativeEffect} /> : null}
      <AbsoluteFill
        style={{
          padding: `${KUAISHOU_SAFE_INSET.top}px ${KUAISHOU_SAFE_INSET.right}px ${KUAISHOU_SAFE_INSET.bottom}px ${KUAISHOU_SAFE_INSET.left}px`,
          color: theme.fg,
          justifyContent: "space-between",
          fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            marginTop: KUAISHOU_SAFE_INSET.primaryOffsetY,
            maxWidth: "min(100%, 54rem)",
          }}
        >
          {primaryNodes.map((node, index) => {
            const state = getTextMotionState({
              frame: sceneFrame,
              durationInFrames: scene.durationInFrames,
              delayFrames: index === 0 ? 0 : textMotion.bodyDelayFrames + (index - 1) * textMotion.bulletsStaggerFrames,
              config: textMotion,
            });

            return (
              <div
                key={`primary-node-${index}`}
                style={{
                  opacity: state.opacity,
                  transform: `translateY(${state.translateY}px)`,
                }}
              >
                {node}
              </div>
            );
          })}
        </div>
        {secondaryNodes.length > 0 ? (
          <div
            style={{
              maxWidth: "min(100%, 54rem)",
              alignSelf: "flex-start",
            }}
          >
            {secondaryNodes[0]}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SceneAudio: React.FC<{audioAssets: AudioAsset[]; scenes: RenderScene[]}> = ({
  audioAssets,
  scenes,
}) => {
  const playableAssets = audioAssets.filter((asset) => asset.filePath);

  return (
    <>
      {playableAssets.map((asset) => (
        <Sequence
          key={asset.id}
          from={
            (scenes.find((scene) => scene.id === asset.sceneId)?.fromFrame ?? 0) +
            (scenes.find((scene) => scene.id === asset.sceneId)?.timing.audioOffsetFrames ?? 0)
          }
        >
          <Audio src={resolveAssetSrc(asset.filePath) ?? ""} />
        </Sequence>
      ))}
    </>
  );
};

export const PaperVideo: React.FC<{creativeEffect?: PaperCreativeEffect; manifest: RenderManifest}> = ({
  creativeEffect,
  manifest,
}) => {
  return (
    <AbsoluteFill style={{backgroundColor: "#050a10"}}>
      {manifest.audioAssets.some((asset) => asset.filePath) ? (
        <SceneAudio audioAssets={manifest.audioAssets} scenes={manifest.scenes} />
      ) : null}
      {manifest.scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.fromFrame} durationInFrames={scene.durationInFrames}>
          <SceneCard creativeEffect={creativeEffect} scene={scene} manifest={manifest} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
