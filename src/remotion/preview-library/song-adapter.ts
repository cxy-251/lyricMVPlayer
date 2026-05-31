import type {
  AudioFeatureTrack,
  BackgroundAsset,
  LyricVideoCompositionProps,
  PoetryFrame,
  SongLibraryItem,
  TimedLyricLine,
} from "../../../modules/render-core/src";

import type {
  PreviewSongAssets,
  PreviewSongIndex,
  RawRenderInput,
  RawTimedLyricLine,
} from "./types";

const DEFAULT_BACKGROUND_COLOR = "#101828";
const DEFAULT_FPS = 60;

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizeLyrics = (lyrics: RawTimedLyricLine[] | undefined): TimedLyricLine[] =>
  Array.isArray(lyrics)
    ? lyrics
        .map((line) => ({
          startMs: numberOr(line.startMs, 0),
          endMs: numberOr(line.endMs, numberOr(line.startMs, 0) + 1),
          text: typeof line.text === "string" ? line.text : "",
        }))
        .filter((line) => line.endMs > line.startMs)
    : [];

const normalizePoetryFrame = (poetryFrame: RawRenderInput["poetryFrame"]): PoetryFrame | undefined =>
  poetryFrame
    ? {
        nickname: poetryFrame.nickname ?? "CleanKsen",
        topLabel: poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
        leftVertical: poetryFrame.leftVertical ?? "",
        rightVertical: poetryFrame.rightVertical ?? "",
        bottomLine: poetryFrame.bottomLine ?? "",
      }
    : undefined;

const buildBackground = (
  rawBackground: RawRenderInput["background"] | undefined,
  assets: Pick<PreviewSongAssets, "backgroundSrc">
): BackgroundAsset => ({
  kind: assets.backgroundSrc ? "image" : rawBackground?.kind ?? "color",
  src: assets.backgroundSrc,
  color: rawBackground?.color ?? DEFAULT_BACKGROUND_COLOR,
});

export const createSeedSong = (song: PreviewSongIndex, assets: PreviewSongAssets): SongLibraryItem => ({
  id: song.id,
  title: song.title,
  artist: song.artist,
  audioSrc: assets.audioSrc,
  lyricOffsetMs: song.lyricOffsetMs ?? 0,
  renderTrimStartMs: song.renderTrimStartMs ?? 0,
  renderDurationInFrames: song.renderDurationInFrames ?? song.durationInFrames,
  durationInFrames: song.durationInFrames,
  fps: song.fps,
  background: buildBackground(undefined, assets),
  lyrics: [],
});

export const createSongFromRenderInput = ({
  id,
  renderInput,
  audioFeatures,
  assets,
  seed,
}: {
  id: string;
  renderInput: RawRenderInput;
  audioFeatures?: AudioFeatureTrack;
  assets: PreviewSongAssets;
  seed?: PreviewSongIndex;
}): SongLibraryItem => {
  const fps = numberOr(renderInput.fps, audioFeatures?.frameRate ?? seed?.fps ?? DEFAULT_FPS);
  const durationInFrames = numberOr(
    renderInput.durationInFrames,
    seed?.durationInFrames ?? Math.max(1, Math.ceil(((audioFeatures?.durationMs ?? 0) / 1000) * fps))
  );

  return {
    id,
    title: renderInput.title ?? seed?.title ?? id,
    artist: renderInput.artist ?? seed?.artist ?? "Unknown Artist",
    audioSrc: assets.audioSrc,
    lyricOffsetMs: renderInput.lyricOffsetMs ?? seed?.lyricOffsetMs ?? 0,
    renderTrimStartMs: renderInput.renderTrimStartMs ?? seed?.renderTrimStartMs ?? 0,
    renderDurationInFrames: renderInput.renderDurationInFrames ?? seed?.renderDurationInFrames ?? durationInFrames,
    durationInFrames,
    fps,
    background: buildBackground(renderInput.background, assets),
    poetryFrame: normalizePoetryFrame(renderInput.poetryFrame),
    lyrics: normalizeLyrics(renderInput.lyrics),
    audioFeatures,
  };
};

export const songToCompositionProps = (
  song: SongLibraryItem,
  library: SongLibraryItem[],
  extras: Pick<LyricVideoCompositionProps, "initialTrackId" | "queue" | "playlists">
): LyricVideoCompositionProps => ({
  title: song.title,
  artist: song.artist,
  audioSrc: song.audioSrc,
  lyricOffsetMs: song.lyricOffsetMs ?? 0,
  renderTrimStartMs: song.renderTrimStartMs ?? 0,
  renderDurationInFrames: song.renderDurationInFrames ?? song.durationInFrames,
  durationInFrames: song.durationInFrames,
  fps: song.fps,
  background: song.background,
  poetryFrame: song.poetryFrame,
  lyrics: song.lyrics,
  audioFeatures: song.audioFeatures,
  library,
  ...extras,
});
