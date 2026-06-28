import type { ProductionManifest } from "./manifest.types";
import type { CoverImageAsset } from "./asset.types";

export type PaperSource = {
  id: string;
  source: "arxiv";
  arxivId: string;
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  pdfUrl?: string;
  publishedAt?: string;
  fetchedAt: string;
};

export type ContentSection = {
  id: string;
  heading: string;
  narration: string;
  slideBullets: string[];
  imagePrompt: string;
};

export type ContentBrief = {
  projectId: string;
  sourcePaperId: string;
  language: "zh-CN";
  summary: {
    oneLiner: string;
    shortSummary: string;
    keyTakeaways: string[];
  };
  script: {
    hook: string;
    sections: ContentSection[];
    ending: string;
  };
};

export type ContentProfileSceneEntry = {
  narrationText: string;
  content?: Record<string, unknown>;
  imagePrompt?: string;
  imageAssetId?: string;
};

export type ContentProfileDocument = {
  id: string;
  paper?: Partial<ProductionManifest["paper"]>;
  coverImage?: CoverImageAsset;
  scenes: Record<string, ContentProfileSceneEntry>;
};

export type ContentProfileRegistryDocument = {
  profiles: Array<{
    id: string;
    path: string;
    label?: string;
  }>;
};

export type CoverProfileRegistryDocument = {
  assets: Array<
    CoverImageAsset & {
      id: string;
      label?: string;
    }
  >;
};

export type ContentProfileConfig = {
  id: string;
  path?: string;
};

export type CoverProfileConfig = {
  id: string;
  path?: string;
};

