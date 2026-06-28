import type {SummaryModeId} from "@paper-to-video/shared-types";

export type SummaryDraft = {
  titleZh: string;
  hook: string;
  problem: string;
  method: string;
  value: string;
  ending: string;
  bullets: string[];
};

export type DisplaySceneDraft = {
  body: string;
  bullets: string[];
};

export type DisplayScriptDraft = {
  hook: DisplaySceneDraft;
  problem: DisplaySceneDraft;
  method: DisplaySceneDraft;
  value: DisplaySceneDraft;
  ending: DisplaySceneDraft;
};

export type NarrationScriptDraft = {
  hook: string;
  problem: string;
  method: string;
  value: string;
  ending: string;
};

export type SourcePaperForSummary = {
  arxivId: string;
  title: string;
  summary: string;
  categories: string[];
  publishedAt: string;
};

export type PaperMode = "survey" | "theory" | "method";

export type PaperSummaryContext = {
  rawText: string;
  abstractSentences: string[];
  sectionHeadings: string[];
};

export type LmStudioSummaryConfig = {
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxOutputTokens: number;
  maxInputChars: number;
  compactInputChars: number;
};

export type SummaryResult = {
  summaryMode: SummaryModeId;
  scriptDraft: SummaryDraft;
  abstractSentences: string[];
  sectionHeadings: string[];
  modelName?: string;
};
