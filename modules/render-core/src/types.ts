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

export type QueueTrack = {
  id: string;
  title: string;
  artist: string;
  accent?: string;
};

export type PlaylistSummary = {
  id: string;
  name: string;
  count: number;
  accent?: string;
};

export type LyricVideoCompositionProps = {
  title: string;
  artist: string;
  audioSrc?: string;
  lyricOffsetMs?: number;
  durationInFrames: number;
  fps: number;
  background: BackgroundAsset;
  lyrics: TimedLyricLine[];
  queue?: QueueTrack[];
  playlists?: PlaylistSummary[];
};
