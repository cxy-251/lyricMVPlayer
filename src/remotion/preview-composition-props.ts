import type {
  LyricVideoCompositionProps,
  TimedLyricLine
} from "../../modules/render-core/src";

import previewAudioSrc from "../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/audio.mp3";
import previewBackgroundSrc from "../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/background.png";
import rawRenderInput from "../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/render-input.json";

type RawTimedLyricLine = {
  startMs: number;
  endMs: number;
  text: string;
};

type RawRenderInput = {
  title: string;
  artist: string;
  audioSrc?: string | null;
  lyricOffsetMs?: number | null;
  durationInFrames: number;
  fps: number;
  background: {
    kind?: "image" | "video" | "color" | null;
    src?: string | null;
    color?: string | null;
  };
  lyrics: RawTimedLyricLine[];
};

const normalizeLyrics = (lyrics: RawTimedLyricLine[]): TimedLyricLine[] => {
  return lyrics.map((line) => ({
    startMs: line.startMs,
    endMs: line.endMs,
    text: line.text
  }));
};

const input = rawRenderInput as RawRenderInput;

export const previewCompositionProps: LyricVideoCompositionProps = {
  title: input.title,
  artist: input.artist,
  audioSrc: previewAudioSrc,
  lyricOffsetMs: input.lyricOffsetMs ?? 0,
  durationInFrames: input.durationInFrames,
  fps: input.fps,
  background: {
    kind: input.background.kind ?? "color",
    src: input.background.kind === "image" ? previewBackgroundSrc : undefined,
    color: input.background.color ?? "#101828"
  },
  lyrics: normalizeLyrics(input.lyrics),
  queue: [
    {
      id: "dQw4w9WgXcQ",
      title: input.title,
      artist: input.artist,
      accent: "rgba(163, 206, 255, 0.7)"
    }
  ],
  playlists: [
    {id: "liked", name: "赞过的音乐", count: 1, accent: "rgba(255, 196, 170, 0.78)"},
    {id: "night-drive", name: "夜路收藏", count: 1, accent: "rgba(163, 206, 255, 0.72)"},
    {id: "drafts", name: "灵感备忘", count: 0, accent: "rgba(255,255,255,0.58)"}
  ]
};
