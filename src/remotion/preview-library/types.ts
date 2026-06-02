import type {
  AudioFeatureTrack,
  BackgroundAsset,
  PlaylistSummary,
  QueueTrack,
} from "../../../modules/render-core/src";

export type RawTimedLyricLine = {
  startMs?: number;
  endMs?: number;
  text?: string;
};

export type RawRenderInput = {
  title?: string;
  artist?: string;
  lyricOffsetMs?: number;
  renderTrimStartMs?: number;
  renderDurationInFrames?: number;
  durationInFrames?: number;
  fps?: number;
  background?: {
    kind?: BackgroundAsset["kind"];
    src?: string | null;
    color?: string | null;
  };
  poetryFrame?: {
    nickname?: string | null;
    topLabel?: string | null;
    leftVertical?: string | null;
    rightVertical?: string | null;
    bottomLine?: string | null;
    sonnetLines?: string[] | null;
  };
  lyrics?: RawTimedLyricLine[];
};

export type PreviewSongIndex = {
  id: string;
  title: string;
  artist: string;
  lyricOffsetMs?: number;
  renderTrimStartMs?: number;
  renderDurationInFrames?: number;
  durationInFrames: number;
  fps: number;
};

export type PreviewLibraryManifest = {
  selectedSongDirName: string;
  songs: PreviewSongIndex[];
  queue: QueueTrack[];
  playlists: PlaylistSummary[];
};

export type PreviewSongAssets = {
  audioSrc: string;
  backgroundSrc?: string;
  loadRenderInput: () => Promise<RawRenderInput>;
  loadAudioFeatures: () => Promise<AudioFeatureTrack>;
};

export type PreviewAssetMap = Record<string, PreviewSongAssets>;

export type SelectedPreviewSongData = {
  id: string;
  renderInput: RawRenderInput;
  audioFeatures: AudioFeatureTrack;
};
