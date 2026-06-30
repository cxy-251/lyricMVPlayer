import type {AlbumGalleryTimeline, AlbumGalleryTrack} from "./types";

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const easeInOutCubic = (value: number) => {
  const t = clamp(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export const easeOutExpo = (value: number) => {
  const t = clamp(value);
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

export const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

export const buildAlbumGalleryTimeline = (track: AlbumGalleryTrack, fps = track.fps): AlbumGalleryTimeline => {
  const galleryIntroFrames = Math.round(fps * 2.1);
  const slideToTrackFrames = Math.round(fps * 2.2);
  const enterPlayerFrames = Math.round(fps * 2.2);
  const returnGalleryFrames = Math.round(fps * 2.4);
  const audioFrames = Math.max(1, Math.round((track.durationInFrames / track.fps) * fps));
  const audioStartFrame = galleryIntroFrames + slideToTrackFrames + enterPlayerFrames;
  const returnStartFrame = audioStartFrame + audioFrames;
  return {
    galleryIntroFrames,
    slideToTrackFrames,
    enterPlayerFrames,
    audioFrames,
    returnGalleryFrames,
    audioStartFrame,
    returnStartFrame,
    totalFrames: returnStartFrame + returnGalleryFrames,
  };
};

export const formatDuration = (frame: number, fps: number) => {
  const totalSeconds = Math.max(0, Math.floor(frame / Math.max(1, fps)));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const normalizeTrackIndex = (tracks: AlbumGalleryTrack[], selectedTrackId: string) => (
  Math.max(0, tracks.findIndex((track) => track.id === selectedTrackId))
);
