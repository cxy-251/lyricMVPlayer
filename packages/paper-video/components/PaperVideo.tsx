import React from "react";
import {AbsoluteFill, Html5Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {getThemePalette} from "@paper-to-video/content-pipeline";
import {renderTemplateZone} from "@paper-to-video/ui";
import type {
  AudioAsset,
  CoverImageAsset,
  RenderManifest,
  RenderScene,
  SubtitleSegment,
} from "@paper-to-video/shared-types";

declare const __WORKSPACE_ROOT__: string | undefined;

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

  const normalizedPath = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
  return staticFile(normalizedPath);
};

const resolveCoverImageSrc = (coverImage?: CoverImageAsset) => {
  return coverImage?.source === "remote" ? coverImage.path : resolveAssetSrc(coverImage?.path);
};

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
}> = ({coverSrc}) => {
  if (!coverSrc) {
    return null;
  }

  return (
    <AbsoluteFill style={{overflow: "hidden"}}>
      <Img
        src={coverSrc}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          objectFit: "cover",
          objectPosition: "center center",
        }}
      />
    </AbsoluteFill>
  );
};

const Background: React.FC<{
  themeId: string;
  coverImage?: CoverImageAsset;
}> = ({themeId, coverImage}) => {
  const palette = getThemePalette(themeId);
  const fallbackCover = {
    source: "local",
    path: "artifacts/paper-video/images/cover-orbit.svg",
    alt: "Abstract orbit cover"
  } as CoverImageAsset;
  const coverSrc = resolveCoverImageSrc(coverImage || fallbackCover);
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #050c13 0%, #071019 100%)",
      }}
    >
      <BackgroundImageLayer coverSrc={coverSrc} />
      <ReadabilityVeil />
    </AbsoluteFill>
  );
};

const SceneCard: React.FC<{
  scene: RenderScene;
  manifest: RenderManifest;
}> = ({scene, manifest}) => {
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
  const absoluteFrame = scene.fromFrame + localFrame;
  const subtitle = findSubtitle(
    manifest.subtitleSegments.filter((segment) => segment.sceneId === scene.id),
    absoluteFrame,
  );
  const coverSrc = resolveCoverImageSrc(manifest.coverImage);
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
        coverImage={manifest.coverImage}
      />
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
          {primaryNodes.map((node, index) => (
            <div key={`primary-node-${index}`}>{node}</div>
          ))}
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
          <Html5Audio src={resolveAssetSrc(asset.filePath) ?? ""} />
        </Sequence>
      ))}
    </>
  );
};

export const PaperVideo: React.FC<{manifest: RenderManifest}> = ({
  manifest,
}) => {
  return (
    <AbsoluteFill style={{backgroundColor: "#050a10"}}>
      {manifest.audioAssets.some((asset) => asset.filePath) ? (
        <SceneAudio audioAssets={manifest.audioAssets} scenes={manifest.scenes} />
      ) : null}
      {manifest.scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.fromFrame} durationInFrames={scene.durationInFrames}>
          <SceneCard scene={scene} manifest={manifest} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
