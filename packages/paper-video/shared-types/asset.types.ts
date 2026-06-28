export type CoverImageAsset = {
  source: "local" | "remote";
  path: string;
  alt?: string;
};

export type ImageAsset = {
  id: string;
  prompt: string;
  localPath: string;
  provider: string;
  width?: number;
  height?: number;
  styleTag?: string;
};

export type AudioSegment = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  role: "narration" | "subtitle";
};

export type AudioAsset = {
  id: string;
  filePath: string;
  durationMs: number;
  sceneId: string;
  segments: AudioSegment[];
};

export type SubtitleSegment = {
  id: string;
  sceneId: string;
  text: string;
  startFrame: number;
  endFrame: number;
  emphasisLevel?: number;
};

