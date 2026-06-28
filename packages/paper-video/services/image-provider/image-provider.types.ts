export type CoverSelectionModeId =
  | "none"
  | "local-folder-random"
  | "local-folder-cycle"
  | "ai-generated-cover"
  | "licensed-source";

export type BackgroundImageAsset = {
  id: string;
  localPath: string;
};

export type BackgroundImageSelection = {
  mode: CoverSelectionModeId;
  sourceDir: string | null;
  backgroundImages: BackgroundImageAsset[];
};
