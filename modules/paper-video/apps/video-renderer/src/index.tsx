import React from "react";
import {Composition, registerRoot} from "remotion";
import type {RenderManifest} from "@paper-to-video/shared-types";
import {Video} from "./Video";

const fallbackManifest: RenderManifest = {
  projectId: "fallback",
  seed: 1,
  fps: 30,
  width: 1080,
  height: 1920,
  totalFrames: 150,
  template: {
    id: "paper-digest-v1",
    path: "data/templates/paper-digest-v1.json",
  },
  templateDocument: {
    id: "paper-digest-v1",
    version: "1.0.0",
    sceneTemplates: [
      {
        sceneType: "default",
        nodes: [
          {id: "fallback-kicker", componentId: "scene-kicker", zone: "primary"},
          {id: "fallback-title", componentId: "scene-title", zone: "primary"},
          {id: "fallback-body", componentId: "scene-body", zone: "primary"},
          {id: "fallback-subtitle", componentId: "subtitle-panel", zone: "secondary"},
        ],
      },
    ],
  },
  paper: {
    source: "arxiv",
    paperId: "fallback",
    title: "Fallback Paper",
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
  scenes: [
    {
      id: "fallback-scene",
      type: "hero",
      fromFrame: 0,
      durationInFrames: 150,
      backgroundPresetId: "aurora",
      backgroundImageLayoutId: "cover-full",
      backgroundEffectId: "aurora",
      motionPresetId: "fade-up",
      imageAssetIds: [],
      audioSegmentIds: [],
      subtitleSegmentIds: [],
      content: {
        title: "PaperToVideo",
        body: "等待载入 render manifest",
      },
      timing: {
        enterFrames: 12,
        holdFrames: 126,
        exitFrames: 12,
        audioOffsetFrames: 0,
        interactionFrameOffset: 20,
        effectStartFrameOffset: 28,
      },
    },
  ],
  audioAssets: [],
  imageAssets: [],
  subtitleSegments: [],
};

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PaperToVideo"
      component={Video}
      durationInFrames={fallbackManifest.totalFrames}
      fps={fallbackManifest.fps}
      width={fallbackManifest.width}
      height={fallbackManifest.height}
      defaultProps={{manifest: fallbackManifest}}
      calculateMetadata={({props}) => {
        const manifest = (props as {manifest?: RenderManifest}).manifest ?? fallbackManifest;

        return {
          durationInFrames: manifest.totalFrames,
          fps: manifest.fps,
          width: manifest.width,
          height: manifest.height,
          props: {
            manifest,
          },
        };
      }}
    />
  );
};

registerRoot(RemotionRoot);
