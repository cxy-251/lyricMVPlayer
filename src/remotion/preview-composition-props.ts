import type {
  AudioFeatureTrack,
  BackgroundAsset,
  LyricVideoCompositionProps,
  PlaylistSummary,
  QueueTrack,
  SongLibraryItem,
  TimedLyricLine
} from "../../modules/render-core/src";

import currentSongConfig from "./current-song.json";
import manifest from "./preview-library-manifest.json";
import {previewAssetMap} from "./preview-asset-map";

type RawTimedLyricLine = {
  startMs: number;
  endMs: number;
  text: string;
};

type ManifestSong = {
  id: string;
  title: string;
  artist: string;
  lyricOffsetMs?: number;
  renderTrimStartMs?: number;
  renderDurationInFrames?: number;
  durationInFrames: number;
  fps: number;
  background: {
    kind?: "image" | "video" | "color";
    color?: string | null;
  };
  poetryFrame?: {
    nickname?: string | null;
    topLabel?: string | null;
    leftVertical?: string | null;
    rightVertical?: string | null;
    bottomLine?: string | null;
  };
  lyrics: RawTimedLyricLine[];
};

type PreviewManifest = {
  selectedSongDirName: string;
  songs: ManifestSong[];
  queue: QueueTrack[];
  playlists: PlaylistSummary[];
};

const previewManifest = manifest as PreviewManifest;

const normalizeLyrics = (lyrics: RawTimedLyricLine[]): TimedLyricLine[] =>
  lyrics.map((line) => ({
    startMs: line.startMs,
    endMs: line.endMs,
    text: line.text
  }));

const library: SongLibraryItem[] = previewManifest.songs.map((song) => {
  const assets = previewAssetMap[song.id];
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    audioSrc: assets.audioSrc,
    lyricOffsetMs: song.lyricOffsetMs ?? 0,
    renderTrimStartMs: song.renderTrimStartMs ?? 0,
    renderDurationInFrames: song.renderDurationInFrames ?? song.durationInFrames,
    durationInFrames: song.durationInFrames,
    fps: song.fps,
    background: {
      kind: assets.backgroundSrc ? "image" : (song.background.kind ?? "color"),
      src: assets.backgroundSrc,
      color: song.background.color ?? "#101828"
    } as BackgroundAsset,
    poetryFrame: song.poetryFrame
      ? {
          nickname: song.poetryFrame.nickname ?? "CleanKsen",
          topLabel: song.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: song.poetryFrame.leftVertical ?? "",
          rightVertical: song.poetryFrame.rightVertical ?? "",
          bottomLine: song.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(song.lyrics),
    audioFeatures: assets.audioFeatures as AudioFeatureTrack
  };
});

const queue: QueueTrack[] = previewManifest.queue;
const playlists: PlaylistSummary[] = previewManifest.playlists;

const initialSongId = currentSongConfig.songDirName;
const initialSong = library.find((item) => item.id === initialSongId) ?? library[0];

export const previewCompositionProps: LyricVideoCompositionProps = {
  title: initialSong.title,
  artist: initialSong.artist,
  audioSrc: initialSong.audioSrc,
  lyricOffsetMs: initialSong.lyricOffsetMs ?? 0,
  renderTrimStartMs: initialSong.renderTrimStartMs ?? 0,
  renderDurationInFrames: initialSong.renderDurationInFrames ?? initialSong.durationInFrames,
  durationInFrames: initialSong.durationInFrames,
  fps: initialSong.fps,
  background: initialSong.background,
  poetryFrame: initialSong.poetryFrame,
  lyrics: initialSong.lyrics,
  audioFeatures: initialSong.audioFeatures,
  library,
  initialTrackId: initialSongId,
  queue,
  playlists
};
