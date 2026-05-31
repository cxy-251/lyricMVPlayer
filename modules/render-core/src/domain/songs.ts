import type {LyricVideoCompositionProps, SongLibraryItem} from "../types";

export const DEFAULT_NICKNAME = "CleanKsen";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const formatDisplayTitle = (title: string, artist: string): string => {
  const strippedArtist = title.replace(new RegExp(`^${escapeRegExp(artist)}\\s*-\\s*`, "i"), "");
  return strippedArtist.replace(/\s*\([^)]*\)/g, "").trim();
};

export const createSingleSongLibraryItem = (props: LyricVideoCompositionProps): SongLibraryItem => ({
  id: `${props.title}-${props.artist}`,
  title: props.title,
  artist: props.artist,
  audioSrc: props.audioSrc,
  lyricOffsetMs: props.lyricOffsetMs,
  renderTrimStartMs: props.renderTrimStartMs,
  renderDurationInFrames: props.renderDurationInFrames,
  durationInFrames: props.durationInFrames,
  fps: props.fps,
  background: props.background,
  poetryFrame: props.poetryFrame,
  lyrics: props.lyrics,
  audioFeatures: props.audioFeatures,
});
