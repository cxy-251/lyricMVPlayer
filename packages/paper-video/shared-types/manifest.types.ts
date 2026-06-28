import type { BackgroundImageLayoutId, BackgroundEffectId, TextMotionId, VisualModuleConfig, EffectProfileConfig } from "./effect.types";
import type { ContentProfileConfig, CoverProfileConfig } from "./content.types";
import type { CoverImageAsset, ImageAsset, AudioAsset, SubtitleSegment } from "./asset.types";
import type { TemplateDocument } from "./template.types";

export type SummaryModeId = "rule-based" | "lm-studio";

export type ProductionScene = {
  id: string;
  type:
    | "hero"
    | "paper-intro"
    | "summary"
    | "bullet"
    | "image-focus"
    | "quote"
    | "ending";
  contentRef: string;
  narrationText?: string;
  content?: Record<string, unknown>;
  imagePrompt?: string;
  imageAssetId?: string;
  backgroundPresetId: string;
  backgroundImageLayoutId?: BackgroundImageLayoutId;
  backgroundEffectId?: BackgroundEffectId;
  motionPresetId: TextMotionId;
  durationStrategy: "auto-by-audio" | "fixed";
  fixedDurationMs?: number;
};

export type ProductionManifest = {
  projectId: string;
  seed: number;
  locale: "zh-CN";
  template: {
    id: string;
    path: string;
  };
  contentProfile?: ContentProfileConfig;
  coverProfile?: CoverProfileConfig;
  coverImage?: {
    source: "local" | "remote";
    path: string;
    alt?: string;
  };
  output: {
    width: number;
    height: number;
    fps: number;
    platform: "douyin" | "xiaohongshu" | "bilibili-short";
  };
  paper: {
    source: "arxiv";
    paperId: string;
    title: string;
    pdfUrl?: string;
    localPdfPath?: string;
    categories?: string[];
    publishedAt?: string;
  };
  theme: {
    id: string;
    paletteId: string;
    fontPackId: string;
  };
  voice: {
    provider: "edge-tts";
    name: string;
    rate: string;
    pitch: string;
    volume?: string;
  };
  effectProfile?: EffectProfileConfig;
  modules?: VisualModuleConfig;
  scenes: ProductionScene[];
};

export type SceneTiming = {
  enterFrames: number;
  holdFrames: number;
  exitFrames: number;
  audioOffsetFrames: number;
  interactionFrameOffset: number;
  effectStartFrameOffset: number;
};

export type RenderScene = {
  id: string;
  type: ProductionScene["type"];
  fromFrame: number;
  durationInFrames: number;
  backgroundPresetId: string;
  backgroundImageLayoutId: BackgroundImageLayoutId;
  backgroundEffectId: BackgroundEffectId;
  motionPresetId: TextMotionId;
  imageAssetIds: string[];
  audioSegmentIds: string[];
  subtitleSegmentIds: string[];
  content: Record<string, unknown>;
  timing: SceneTiming;
};

export type RenderManifest = {
  projectId: string;
  seed: number;
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  template: ProductionManifest["template"];
  templateDocument: TemplateDocument;
  coverImage?: CoverImageAsset;
  paper: ProductionManifest["paper"];
  theme: ProductionManifest["theme"];
  voice: ProductionManifest["voice"];
  effectProfile?: EffectProfileConfig;
  modules?: VisualModuleConfig;
  scenes: RenderScene[];
  audioAssets: AudioAsset[];
  imageAssets: ImageAsset[];
  subtitleSegments: SubtitleSegment[];
};


