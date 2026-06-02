import type {ContentProfileDocument} from "@paper-to-video/shared-types";

export type LooseSummaryRecord = Record<string, unknown>;

export type ImportedSummaryMetadata = {
  profileId: string;
  label: string;
  preferredEffectId: string | null;
  coverImageKeywords: string[];
  tone: string | null;
  warnings: string[];
};

export type ImportedSummaryBundle = {
  contentProfile: ContentProfileDocument;
  metadata: ImportedSummaryMetadata;
};
