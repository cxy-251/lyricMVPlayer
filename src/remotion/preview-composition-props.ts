import type {
  AudioFeatureTrack,
  LyricVideoCompositionProps,
  TimedLyricLine
} from "../../modules/render-core/src";

import audioSrc0 from "../../artifacts/songs/Take On Me (Official Video) [4K] - a-ha - djV11Xbc914/audio.mp3";
import rawAudioFeatures0 from "../../artifacts/songs/Take On Me (Official Video) [4K] - a-ha - djV11Xbc914/audio-features.json";
import rawRenderInput0 from "../../artifacts/songs/Take On Me (Official Video) [4K] - a-ha - djV11Xbc914/render-input.json";
import backgroundSrc0 from "../../artifacts/songs/Take On Me (Official Video) [4K] - a-ha - djV11Xbc914/background.png";
import audioSrc1 from "../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/audio.mp3";
import rawAudioFeatures1 from "../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/audio-features.json";
import rawRenderInput1 from "../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/render-input.json";
import backgroundSrc1 from "../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/background.png";
import audioSrc2 from "../../artifacts/songs/The Final Countdown (Official Video) - Europe - 9jK-NcRmVcw/audio.mp3";
import rawAudioFeatures2 from "../../artifacts/songs/The Final Countdown (Official Video) - Europe - 9jK-NcRmVcw/audio-features.json";
import rawRenderInput2 from "../../artifacts/songs/The Final Countdown (Official Video) - Europe - 9jK-NcRmVcw/render-input.json";
import backgroundSrc2 from "../../artifacts/songs/The Final Countdown (Official Video) - Europe - 9jK-NcRmVcw/background.png";
import audioSrc3 from "../../artifacts/songs/I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg/audio.mp3";
import rawAudioFeatures3 from "../../artifacts/songs/I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg/audio-features.json";
import rawRenderInput3 from "../../artifacts/songs/I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg/render-input.json";
import backgroundSrc3 from "../../artifacts/songs/I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg/background.png";
import audioSrc4 from "../../artifacts/songs/Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY/audio.mp3";
import rawAudioFeatures4 from "../../artifacts/songs/Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY/audio-features.json";
import rawRenderInput4 from "../../artifacts/songs/Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY/render-input.json";
import backgroundSrc4 from "../../artifacts/songs/Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY/background.png";
import audioSrc5 from "../../artifacts/songs/Hey There Delilah - Plain White Ts - oEeet9t--tI/audio.mp3";
import rawAudioFeatures5 from "../../artifacts/songs/Hey There Delilah - Plain White Ts - oEeet9t--tI/audio-features.json";
import rawRenderInput5 from "../../artifacts/songs/Hey There Delilah - Plain White Ts - oEeet9t--tI/render-input.json";
import backgroundSrc5 from "../../artifacts/songs/Hey There Delilah - Plain White Ts - oEeet9t--tI/background.png";
import audioSrc6 from "../../artifacts/songs/From The Start (Official Music Video) - Laufey - lSD_L-xic9o/audio.mp3";
import rawAudioFeatures6 from "../../artifacts/songs/From The Start (Official Music Video) - Laufey - lSD_L-xic9o/audio-features.json";
import rawRenderInput6 from "../../artifacts/songs/From The Start (Official Music Video) - Laufey - lSD_L-xic9o/render-input.json";
import backgroundSrc6 from "../../artifacts/songs/From The Start (Official Music Video) - Laufey - lSD_L-xic9o/background.png";
import audioSrc7 from "../../artifacts/songs/Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY/audio.mp3";
import rawAudioFeatures7 from "../../artifacts/songs/Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY/audio-features.json";
import rawRenderInput7 from "../../artifacts/songs/Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY/render-input.json";
import backgroundSrc7 from "../../artifacts/songs/Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY/background.png";

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
  renderTrimStartMs?: number | null;
  renderDurationInFrames?: number | null;
  durationInFrames: number;
  fps: number;
  background: {
    kind?: "image" | "video" | "color" | null;
    src?: string | null;
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

const normalizeLyrics = (lyrics: RawTimedLyricLine[]): TimedLyricLine[] => {
  return lyrics.map((line) => ({
    startMs: line.startMs,
    endMs: line.endMs,
    text: line.text
  }));
};

const input0 = rawRenderInput0 as RawRenderInput;
const input1 = rawRenderInput1 as RawRenderInput;
const input2 = rawRenderInput2 as RawRenderInput;
const input3 = rawRenderInput3 as RawRenderInput;
const input4 = rawRenderInput4 as RawRenderInput;
const input5 = rawRenderInput5 as RawRenderInput;
const input6 = rawRenderInput6 as RawRenderInput;
const input7 = rawRenderInput7 as RawRenderInput;

const library = [
  {
    id: "Take On Me (Official Video) [4K] - a-ha - djV11Xbc914",
    title: input0.title,
    artist: input0.artist,
    audioSrc: audioSrc0,
    lyricOffsetMs: input0.lyricOffsetMs ?? 0,
    renderTrimStartMs: input0.renderTrimStartMs ?? 0,
    renderDurationInFrames: input0.renderDurationInFrames ?? input0.durationInFrames,
    durationInFrames: input0.durationInFrames,
    fps: input0.fps,
    background: {
      kind: (input0.background.kind ?? "color") as "image" | "video" | "color",
      src: rawRenderInput0.background.kind === "image" ? backgroundSrc0 : undefined,
      color: input0.background.color ?? "#101828"
    },
    poetryFrame: input0.poetryFrame
      ? {
          nickname: input0.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input0.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input0.poetryFrame.leftVertical ?? "",
          rightVertical: input0.poetryFrame.rightVertical ?? "",
          bottomLine: input0.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input0.lyrics),
    audioFeatures: rawAudioFeatures0 as AudioFeatureTrack
  },
  {
    id: "Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ",
    title: input1.title,
    artist: input1.artist,
    audioSrc: audioSrc1,
    lyricOffsetMs: input1.lyricOffsetMs ?? 0,
    renderTrimStartMs: input1.renderTrimStartMs ?? 0,
    renderDurationInFrames: input1.renderDurationInFrames ?? input1.durationInFrames,
    durationInFrames: input1.durationInFrames,
    fps: input1.fps,
    background: {
      kind: (input1.background.kind ?? "color") as "image" | "video" | "color",
      src: rawRenderInput1.background.kind === "image" ? backgroundSrc1 : undefined,
      color: input1.background.color ?? "#101828"
    },
    poetryFrame: input1.poetryFrame
      ? {
          nickname: input1.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input1.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input1.poetryFrame.leftVertical ?? "",
          rightVertical: input1.poetryFrame.rightVertical ?? "",
          bottomLine: input1.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input1.lyrics),
    audioFeatures: rawAudioFeatures1 as AudioFeatureTrack
  },
  {
    id: "The Final Countdown (Official Video) - Europe - 9jK-NcRmVcw",
    title: input2.title,
    artist: input2.artist,
    audioSrc: audioSrc2,
    lyricOffsetMs: input2.lyricOffsetMs ?? 0,
    renderTrimStartMs: input2.renderTrimStartMs ?? 0,
    renderDurationInFrames: input2.renderDurationInFrames ?? input2.durationInFrames,
    durationInFrames: input2.durationInFrames,
    fps: input2.fps,
    background: {
      kind: (input2.background.kind ?? "color") as "image" | "video" | "color",
      src: rawRenderInput2.background.kind === "image" ? backgroundSrc2 : undefined,
      color: input2.background.color ?? "#101828"
    },
    poetryFrame: input2.poetryFrame
      ? {
          nickname: input2.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input2.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input2.poetryFrame.leftVertical ?? "",
          rightVertical: input2.poetryFrame.rightVertical ?? "",
          bottomLine: input2.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input2.lyrics),
    audioFeatures: rawAudioFeatures2 as AudioFeatureTrack
  },
  {
    id: "I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg",
    title: input3.title,
    artist: input3.artist,
    audioSrc: audioSrc3,
    lyricOffsetMs: input3.lyricOffsetMs ?? 0,
    renderTrimStartMs: input3.renderTrimStartMs ?? 0,
    renderDurationInFrames: input3.renderDurationInFrames ?? input3.durationInFrames,
    durationInFrames: input3.durationInFrames,
    fps: input3.fps,
    background: {
      kind: (input3.background.kind ?? "color") as "image" | "video" | "color",
      src: rawRenderInput3.background.kind === "image" ? backgroundSrc3 : undefined,
      color: input3.background.color ?? "#101828"
    },
    poetryFrame: input3.poetryFrame
      ? {
          nickname: input3.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input3.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input3.poetryFrame.leftVertical ?? "",
          rightVertical: input3.poetryFrame.rightVertical ?? "",
          bottomLine: input3.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input3.lyrics),
    audioFeatures: rawAudioFeatures3 as AudioFeatureTrack
  },
  {
    id: "Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY",
    title: input4.title,
    artist: input4.artist,
    audioSrc: audioSrc4,
    lyricOffsetMs: input4.lyricOffsetMs ?? 0,
    renderTrimStartMs: input4.renderTrimStartMs ?? 0,
    renderDurationInFrames: input4.renderDurationInFrames ?? input4.durationInFrames,
    durationInFrames: input4.durationInFrames,
    fps: input4.fps,
    background: {
      kind: (input4.background.kind ?? "color") as "image" | "video" | "color",
      src: rawRenderInput4.background.kind === "image" ? backgroundSrc4 : undefined,
      color: input4.background.color ?? "#101828"
    },
    poetryFrame: input4.poetryFrame
      ? {
          nickname: input4.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input4.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input4.poetryFrame.leftVertical ?? "",
          rightVertical: input4.poetryFrame.rightVertical ?? "",
          bottomLine: input4.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input4.lyrics),
    audioFeatures: rawAudioFeatures4 as AudioFeatureTrack
  },
  {
    id: "Hey There Delilah - Plain White Ts - oEeet9t--tI",
    title: input5.title,
    artist: input5.artist,
    audioSrc: audioSrc5,
    lyricOffsetMs: input5.lyricOffsetMs ?? 0,
    renderTrimStartMs: input5.renderTrimStartMs ?? 0,
    renderDurationInFrames: input5.renderDurationInFrames ?? input5.durationInFrames,
    durationInFrames: input5.durationInFrames,
    fps: input5.fps,
    background: {
      kind: (input5.background.kind ?? "color") as "image" | "video" | "color",
      src: rawRenderInput5.background.kind === "image" ? backgroundSrc5 : undefined,
      color: input5.background.color ?? "#101828"
    },
    poetryFrame: input5.poetryFrame
      ? {
          nickname: input5.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input5.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input5.poetryFrame.leftVertical ?? "",
          rightVertical: input5.poetryFrame.rightVertical ?? "",
          bottomLine: input5.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input5.lyrics),
    audioFeatures: rawAudioFeatures5 as AudioFeatureTrack
  },
  {
    id: "From The Start (Official Music Video) - Laufey - lSD_L-xic9o",
    title: input6.title,
    artist: input6.artist,
    audioSrc: audioSrc6,
    lyricOffsetMs: input6.lyricOffsetMs ?? 0,
    renderTrimStartMs: input6.renderTrimStartMs ?? 0,
    renderDurationInFrames: input6.renderDurationInFrames ?? input6.durationInFrames,
    durationInFrames: input6.durationInFrames,
    fps: input6.fps,
    background: {
      kind: (input6.background.kind ?? "color") as "image" | "video" | "color",
      src: rawRenderInput6.background.kind === "image" ? backgroundSrc6 : undefined,
      color: input6.background.color ?? "#101828"
    },
    poetryFrame: input6.poetryFrame
      ? {
          nickname: input6.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input6.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input6.poetryFrame.leftVertical ?? "",
          rightVertical: input6.poetryFrame.rightVertical ?? "",
          bottomLine: input6.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input6.lyrics),
    audioFeatures: rawAudioFeatures6 as AudioFeatureTrack
  },
  {
    id: "Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY",
    title: input7.title,
    artist: input7.artist,
    audioSrc: audioSrc7,
    lyricOffsetMs: input7.lyricOffsetMs ?? 0,
    renderTrimStartMs: input7.renderTrimStartMs ?? 0,
    renderDurationInFrames: input7.renderDurationInFrames ?? input7.durationInFrames,
    durationInFrames: input7.durationInFrames,
    fps: input7.fps,
    background: {
      kind: (input7.background.kind ?? "color") as "image" | "video" | "color",
      src: rawRenderInput7.background.kind === "image" ? backgroundSrc7 : undefined,
      color: input7.background.color ?? "#101828"
    },
    poetryFrame: input7.poetryFrame
      ? {
          nickname: input7.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input7.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input7.poetryFrame.leftVertical ?? "",
          rightVertical: input7.poetryFrame.rightVertical ?? "",
          bottomLine: input7.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input7.lyrics),
    audioFeatures: rawAudioFeatures7 as AudioFeatureTrack
  }
];

const queue = [
  {
    id: "Take On Me (Official Video) [4K] - a-ha - djV11Xbc914",
    title: input0.title,
    artist: input0.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ",
    title: input1.title,
    artist: input1.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "The Final Countdown (Official Video) - Europe - 9jK-NcRmVcw",
    title: input2.title,
    artist: input2.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg",
    title: input3.title,
    artist: input3.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY",
    title: input4.title,
    artist: input4.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "Hey There Delilah - Plain White Ts - oEeet9t--tI",
    title: input5.title,
    artist: input5.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "From The Start (Official Music Video) - Laufey - lSD_L-xic9o",
    title: input6.title,
    artist: input6.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY",
    title: input7.title,
    artist: input7.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  }
];

const initialSongId = "Take On Me (Official Video) [4K] - a-ha - djV11Xbc914";
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
  playlists: [
    {id: "liked", name: "Liked Songs", count: 0, accent: "rgba(255, 196, 170, 0.78)"},
    {id: "night-drive", name: "Night Drive", count: queue.length, accent: "rgba(255,255,255,0.58)", trackIds: queue.map((track) => track.id)},
    {id: "city-echoes", name: "City Echoes", count: 0, accent: "rgba(255,255,255,0.58)", trackIds: []},
    {id: "neon-pulse", name: "Neon Pulse", count: 0, accent: "rgba(255,255,255,0.58)", trackIds: []},
    {id: "soft-pages", name: "Soft Pages", count: 0, accent: "rgba(255,255,255,0.58)", trackIds: []},
    {id: "afterglow", name: "Afterglow", count: 0, accent: "rgba(255,255,255,0.58)", trackIds: []}
  ]
};
