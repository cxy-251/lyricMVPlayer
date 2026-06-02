export type TimedLyricLine = {
  startMs: number;
  endMs: number;
  text: string;
};

export type BackgroundAsset = {
  kind: "image" | "video" | "color";
  src?: string;
  color?: string;
};

export type PoetryFrame = {
  nickname: string;
  topLabel: string;
  leftVertical: string;
  rightVertical: string;
  bottomLine: string;
};

export type QueueTrack = {
  id: string;
  title: string;
  artist: string;
  accent?: string;
  available?: boolean;
  assetStatus?: {
    audio: boolean;
    audioFeatures: boolean;
    background: boolean;
    lyrics: boolean;
    renderInput: boolean;
  };
};

export type SongLibraryItem = {
  id: string;
  title: string;
  artist: string;
  audioSrc?: string;
  lyricOffsetMs?: number;
  renderTrimStartMs?: number;
  renderDurationInFrames?: number;
  durationInFrames: number;
  fps: number;
  background: BackgroundAsset;
  poetryFrame?: PoetryFrame;
  lyrics: TimedLyricLine[];
  audioFeatures?: AudioFeatureTrack;
  accent?: string;
  assetStatus?: QueueTrack["assetStatus"];
};

export type SongLibraryItemLoader = (songId: string) => Promise<SongLibraryItem | null>;

export type PlaylistSummary = {
  id: string;
  name: string;
  count: number;
  accent?: string;
  trackIds?: string[];
};

export type AudioFeatureFrame = {
  timeMs: number;
  bass: number;
  mid: number;
  high: number;
  energy: number;
  beat: number;
  onset: number;
};

export type AudioFeatureTrack = {
  frameRate: number;
  durationMs: number;
  frames: AudioFeatureFrame[];
};

export type LyricVideoCompositionProps = {
  title: string;
  artist: string;
  audioSrc?: string;
  interactivePreview?: boolean;
  lyricOffsetMs?: number;
  renderTrimStartMs?: number;
  renderDurationInFrames?: number;
  durationInFrames: number;
  fps: number;
  background: BackgroundAsset;
  poetryFrame?: PoetryFrame;
  lyrics: TimedLyricLine[];
  audioFeatures?: AudioFeatureTrack;
  queue?: QueueTrack[];
  library?: SongLibraryItem[];
  loadLibraryItem?: SongLibraryItemLoader;
  initialTrackId?: string;
  playlists?: PlaylistSummary[];
};
