import type {
  AudioFeatureTrack,
  LyricVideoCompositionProps,
  TimedLyricLine
} from "../../modules/render-core/src";

import audioSrc0 from "../../artifacts/songs/Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY/audio.mp3";
import rawAudioFeatures0 from "../../artifacts/songs/Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY/audio-features.json";
import rawRenderInput0 from "../../artifacts/songs/Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY/render-input.json";
import backgroundSrc0 from "../../artifacts/songs/Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY/background.png";
import audioSrc1 from "../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/audio.mp3";
import rawAudioFeatures1 from "../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/audio-features.json";
import rawRenderInput1 from "../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/render-input.json";
import backgroundSrc1 from "../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/background.png";
import audioSrc2 from "../../artifacts/songs/Take On Me (Official Video) [4K] - a-ha - djV11Xbc914/audio.mp3";
import rawAudioFeatures2 from "../../artifacts/songs/Take On Me (Official Video) [4K] - a-ha - djV11Xbc914/audio-features.json";
import rawRenderInput2 from "../../artifacts/songs/Take On Me (Official Video) [4K] - a-ha - djV11Xbc914/render-input.json";
import backgroundSrc2 from "../../artifacts/songs/Take On Me (Official Video) [4K] - a-ha - djV11Xbc914/background.png";
import audioSrc3 from "../../artifacts/songs/I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg/audio.mp3";
import rawAudioFeatures3 from "../../artifacts/songs/I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg/audio-features.json";
import rawRenderInput3 from "../../artifacts/songs/I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg/render-input.json";
import backgroundSrc3 from "../../artifacts/songs/I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg/background.png";
import audioSrc4 from "../../artifacts/songs/Hey There Delilah - Plain White Ts - oEeet9t--tI/audio.mp3";
import rawAudioFeatures4 from "../../artifacts/songs/Hey There Delilah - Plain White Ts - oEeet9t--tI/audio-features.json";
import rawRenderInput4 from "../../artifacts/songs/Hey There Delilah - Plain White Ts - oEeet9t--tI/render-input.json";
import backgroundSrc4 from "../../artifacts/songs/Hey There Delilah - Plain White Ts - oEeet9t--tI/background.png";
import audioSrc5 from "../../artifacts/songs/From The Start (Official Music Video) - Laufey - lSD_L-xic9o/audio.mp3";
import rawAudioFeatures5 from "../../artifacts/songs/From The Start (Official Music Video) - Laufey - lSD_L-xic9o/audio-features.json";
import rawRenderInput5 from "../../artifacts/songs/From The Start (Official Music Video) - Laufey - lSD_L-xic9o/render-input.json";
import backgroundSrc5 from "../../artifacts/songs/From The Start (Official Music Video) - Laufey - lSD_L-xic9o/background.png";
import audioSrc6 from "../../artifacts/songs/Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY/audio.mp3";
import rawAudioFeatures6 from "../../artifacts/songs/Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY/audio-features.json";
import rawRenderInput6 from "../../artifacts/songs/Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY/render-input.json";
import backgroundSrc6 from "../../artifacts/songs/Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY/background.png";
import audioSrc7 from "../../artifacts/songs/24 - sundial - Topic - wlg7dhAJkrA/audio.mp3";
import rawAudioFeatures7 from "../../artifacts/songs/24 - sundial - Topic - wlg7dhAJkrA/audio-features.json";
import rawRenderInput7 from "../../artifacts/songs/24 - sundial - Topic - wlg7dhAJkrA/render-input.json";
import backgroundSrc7 from "../../artifacts/songs/24 - sundial - Topic - wlg7dhAJkrA/background.png";
import audioSrc8 from "../../artifacts/songs/If We Ever Broke Up (Official Video) - Mae Stephens - TbGT3d0pHgo/audio.mp3";
import rawAudioFeatures8 from "../../artifacts/songs/If We Ever Broke Up (Official Video) - Mae Stephens - TbGT3d0pHgo/audio-features.json";
import rawRenderInput8 from "../../artifacts/songs/If We Ever Broke Up (Official Video) - Mae Stephens - TbGT3d0pHgo/render-input.json";
import backgroundSrc8 from "../../artifacts/songs/If We Ever Broke Up (Official Video) - Mae Stephens - TbGT3d0pHgo/background.png";
import audioSrc9 from "../../artifacts/songs/Rema - Selena Gomez - Calm Down (Official Music Video) - Selena Gomez - WcIcVapfqXw/audio.mp3";
import rawAudioFeatures9 from "../../artifacts/songs/Rema - Selena Gomez - Calm Down (Official Music Video) - Selena Gomez - WcIcVapfqXw/audio-features.json";
import rawRenderInput9 from "../../artifacts/songs/Rema - Selena Gomez - Calm Down (Official Music Video) - Selena Gomez - WcIcVapfqXw/render-input.json";
import backgroundSrc9 from "../../artifacts/songs/Rema - Selena Gomez - Calm Down (Official Music Video) - Selena Gomez - WcIcVapfqXw/background.png";
import audioSrc10 from "../../artifacts/songs/blue - yung kai - MHCsrKA9gh8/audio.mp3";
import rawAudioFeatures10 from "../../artifacts/songs/blue - yung kai - MHCsrKA9gh8/audio-features.json";
import rawRenderInput10 from "../../artifacts/songs/blue - yung kai - MHCsrKA9gh8/render-input.json";
import backgroundSrc10 from "../../artifacts/songs/blue - yung kai - MHCsrKA9gh8/background.png";
import audioSrc11 from "../../artifacts/songs/I Got Better - Morgan Wallen - Xc-dEsMbQJM/audio.mp3";
import rawAudioFeatures11 from "../../artifacts/songs/I Got Better - Morgan Wallen - Xc-dEsMbQJM/audio-features.json";
import rawRenderInput11 from "../../artifacts/songs/I Got Better - Morgan Wallen - Xc-dEsMbQJM/render-input.json";
import backgroundSrc11 from "../../artifacts/songs/I Got Better - Morgan Wallen - Xc-dEsMbQJM/background.png";
import audioSrc12 from "../../artifacts/songs/Towards The Sun (From The -Home- Soundtrack) - Rihanna - mhPDe4IyqeU/audio.mp3";
import rawAudioFeatures12 from "../../artifacts/songs/Towards The Sun (From The -Home- Soundtrack) - Rihanna - mhPDe4IyqeU/audio-features.json";
import rawRenderInput12 from "../../artifacts/songs/Towards The Sun (From The -Home- Soundtrack) - Rihanna - mhPDe4IyqeU/render-input.json";
import backgroundSrc12 from "../../artifacts/songs/Towards The Sun (From The -Home- Soundtrack) - Rihanna - mhPDe4IyqeU/background.png";
import audioSrc13 from "../../artifacts/songs/Made You Look (Official Music Video) - Meghan Trainor - gPCCYMeXin0/audio.mp3";
import rawAudioFeatures13 from "../../artifacts/songs/Made You Look (Official Music Video) - Meghan Trainor - gPCCYMeXin0/audio-features.json";
import rawRenderInput13 from "../../artifacts/songs/Made You Look (Official Music Video) - Meghan Trainor - gPCCYMeXin0/render-input.json";
import backgroundSrc13 from "../../artifacts/songs/Made You Look (Official Music Video) - Meghan Trainor - gPCCYMeXin0/background.png";
import audioSrc14 from "../../artifacts/songs/Price Tag - Jessie J - 5rcmr-eX2-Y/audio.mp3";
import rawAudioFeatures14 from "../../artifacts/songs/Price Tag - Jessie J - 5rcmr-eX2-Y/audio-features.json";
import rawRenderInput14 from "../../artifacts/songs/Price Tag - Jessie J - 5rcmr-eX2-Y/render-input.json";
import backgroundSrc14 from "../../artifacts/songs/Price Tag - Jessie J - 5rcmr-eX2-Y/background.png";
import audioSrc15 from "../../artifacts/songs/Without Me - Halsey - Tk7WFyHUr1E/audio.mp3";
import rawAudioFeatures15 from "../../artifacts/songs/Without Me - Halsey - Tk7WFyHUr1E/audio-features.json";
import rawRenderInput15 from "../../artifacts/songs/Without Me - Halsey - Tk7WFyHUr1E/render-input.json";
import backgroundSrc15 from "../../artifacts/songs/Without Me - Halsey - Tk7WFyHUr1E/background.png";

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
const input8 = rawRenderInput8 as RawRenderInput;
const input9 = rawRenderInput9 as RawRenderInput;
const input10 = rawRenderInput10 as RawRenderInput;
const input11 = rawRenderInput11 as RawRenderInput;
const input12 = rawRenderInput12 as RawRenderInput;
const input13 = rawRenderInput13 as RawRenderInput;
const input14 = rawRenderInput14 as RawRenderInput;
const input15 = rawRenderInput15 as RawRenderInput;

const library: import("../../modules/render-core/src").SongLibraryItem[] = [
  {
    id: "Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY",
    title: input0.title,
    artist: input0.artist,
    audioSrc: audioSrc0,
    lyricOffsetMs: input0.lyricOffsetMs ?? 0,
    renderTrimStartMs: input0.renderTrimStartMs ?? 0,
    renderDurationInFrames: input0.renderDurationInFrames ?? input0.durationInFrames,
    durationInFrames: input0.durationInFrames,
    fps: input0.fps,
    background: {
      kind: "image",
      src: backgroundSrc0,
      color: input0.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
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
      kind: "image",
      src: backgroundSrc1,
      color: input1.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
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
    id: "Take On Me (Official Video) [4K] - a-ha - djV11Xbc914",
    title: input2.title,
    artist: input2.artist,
    audioSrc: audioSrc2,
    lyricOffsetMs: input2.lyricOffsetMs ?? 0,
    renderTrimStartMs: input2.renderTrimStartMs ?? 0,
    renderDurationInFrames: input2.renderDurationInFrames ?? input2.durationInFrames,
    durationInFrames: input2.durationInFrames,
    fps: input2.fps,
    background: {
      kind: "image",
      src: backgroundSrc2,
      color: input2.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
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
      kind: "image",
      src: backgroundSrc3,
      color: input3.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
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
    id: "Hey There Delilah - Plain White Ts - oEeet9t--tI",
    title: input4.title,
    artist: input4.artist,
    audioSrc: audioSrc4,
    lyricOffsetMs: input4.lyricOffsetMs ?? 0,
    renderTrimStartMs: input4.renderTrimStartMs ?? 0,
    renderDurationInFrames: input4.renderDurationInFrames ?? input4.durationInFrames,
    durationInFrames: input4.durationInFrames,
    fps: input4.fps,
    background: {
      kind: "image",
      src: backgroundSrc4,
      color: input4.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
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
    id: "From The Start (Official Music Video) - Laufey - lSD_L-xic9o",
    title: input5.title,
    artist: input5.artist,
    audioSrc: audioSrc5,
    lyricOffsetMs: input5.lyricOffsetMs ?? 0,
    renderTrimStartMs: input5.renderTrimStartMs ?? 0,
    renderDurationInFrames: input5.renderDurationInFrames ?? input5.durationInFrames,
    durationInFrames: input5.durationInFrames,
    fps: input5.fps,
    background: {
      kind: "image",
      src: backgroundSrc5,
      color: input5.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
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
    id: "Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY",
    title: input6.title,
    artist: input6.artist,
    audioSrc: audioSrc6,
    lyricOffsetMs: input6.lyricOffsetMs ?? 0,
    renderTrimStartMs: input6.renderTrimStartMs ?? 0,
    renderDurationInFrames: input6.renderDurationInFrames ?? input6.durationInFrames,
    durationInFrames: input6.durationInFrames,
    fps: input6.fps,
    background: {
      kind: "image",
      src: backgroundSrc6,
      color: input6.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
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
    id: "24 - sundial - Topic - wlg7dhAJkrA",
    title: input7.title,
    artist: input7.artist,
    audioSrc: audioSrc7,
    lyricOffsetMs: input7.lyricOffsetMs ?? 0,
    renderTrimStartMs: input7.renderTrimStartMs ?? 0,
    renderDurationInFrames: input7.renderDurationInFrames ?? input7.durationInFrames,
    durationInFrames: input7.durationInFrames,
    fps: input7.fps,
    background: {
      kind: "image",
      src: backgroundSrc7,
      color: input7.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
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
  },
  {
    id: "If We Ever Broke Up (Official Video) - Mae Stephens - TbGT3d0pHgo",
    title: input8.title,
    artist: input8.artist,
    audioSrc: audioSrc8,
    lyricOffsetMs: input8.lyricOffsetMs ?? 0,
    renderTrimStartMs: input8.renderTrimStartMs ?? 0,
    renderDurationInFrames: input8.renderDurationInFrames ?? input8.durationInFrames,
    durationInFrames: input8.durationInFrames,
    fps: input8.fps,
    background: {
      kind: "image",
      src: backgroundSrc8,
      color: input8.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
    poetryFrame: input8.poetryFrame
      ? {
          nickname: input8.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input8.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input8.poetryFrame.leftVertical ?? "",
          rightVertical: input8.poetryFrame.rightVertical ?? "",
          bottomLine: input8.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input8.lyrics),
    audioFeatures: rawAudioFeatures8 as AudioFeatureTrack
  },
  {
    id: "Rema - Selena Gomez - Calm Down (Official Music Video) - Selena Gomez - WcIcVapfqXw",
    title: input9.title,
    artist: input9.artist,
    audioSrc: audioSrc9,
    lyricOffsetMs: input9.lyricOffsetMs ?? 0,
    renderTrimStartMs: input9.renderTrimStartMs ?? 0,
    renderDurationInFrames: input9.renderDurationInFrames ?? input9.durationInFrames,
    durationInFrames: input9.durationInFrames,
    fps: input9.fps,
    background: {
      kind: "image",
      src: backgroundSrc9,
      color: input9.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
    poetryFrame: input9.poetryFrame
      ? {
          nickname: input9.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input9.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input9.poetryFrame.leftVertical ?? "",
          rightVertical: input9.poetryFrame.rightVertical ?? "",
          bottomLine: input9.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input9.lyrics),
    audioFeatures: rawAudioFeatures9 as AudioFeatureTrack
  },
  {
    id: "blue - yung kai - MHCsrKA9gh8",
    title: input10.title,
    artist: input10.artist,
    audioSrc: audioSrc10,
    lyricOffsetMs: input10.lyricOffsetMs ?? 0,
    renderTrimStartMs: input10.renderTrimStartMs ?? 0,
    renderDurationInFrames: input10.renderDurationInFrames ?? input10.durationInFrames,
    durationInFrames: input10.durationInFrames,
    fps: input10.fps,
    background: {
      kind: "image",
      src: backgroundSrc10,
      color: input10.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
    poetryFrame: input10.poetryFrame
      ? {
          nickname: input10.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input10.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input10.poetryFrame.leftVertical ?? "",
          rightVertical: input10.poetryFrame.rightVertical ?? "",
          bottomLine: input10.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input10.lyrics),
    audioFeatures: rawAudioFeatures10 as AudioFeatureTrack
  },
  {
    id: "I Got Better - Morgan Wallen - Xc-dEsMbQJM",
    title: input11.title,
    artist: input11.artist,
    audioSrc: audioSrc11,
    lyricOffsetMs: input11.lyricOffsetMs ?? 0,
    renderTrimStartMs: input11.renderTrimStartMs ?? 0,
    renderDurationInFrames: input11.renderDurationInFrames ?? input11.durationInFrames,
    durationInFrames: input11.durationInFrames,
    fps: input11.fps,
    background: {
      kind: "image",
      src: backgroundSrc11,
      color: input11.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
    poetryFrame: input11.poetryFrame
      ? {
          nickname: input11.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input11.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input11.poetryFrame.leftVertical ?? "",
          rightVertical: input11.poetryFrame.rightVertical ?? "",
          bottomLine: input11.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input11.lyrics),
    audioFeatures: rawAudioFeatures11 as AudioFeatureTrack
  },
  {
    id: "Towards The Sun (From The -Home- Soundtrack) - Rihanna - mhPDe4IyqeU",
    title: input12.title,
    artist: input12.artist,
    audioSrc: audioSrc12,
    lyricOffsetMs: input12.lyricOffsetMs ?? 0,
    renderTrimStartMs: input12.renderTrimStartMs ?? 0,
    renderDurationInFrames: input12.renderDurationInFrames ?? input12.durationInFrames,
    durationInFrames: input12.durationInFrames,
    fps: input12.fps,
    background: {
      kind: "image",
      src: backgroundSrc12,
      color: input12.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
    poetryFrame: input12.poetryFrame
      ? {
          nickname: input12.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input12.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input12.poetryFrame.leftVertical ?? "",
          rightVertical: input12.poetryFrame.rightVertical ?? "",
          bottomLine: input12.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input12.lyrics),
    audioFeatures: rawAudioFeatures12 as AudioFeatureTrack
  },
  {
    id: "Made You Look (Official Music Video) - Meghan Trainor - gPCCYMeXin0",
    title: input13.title,
    artist: input13.artist,
    audioSrc: audioSrc13,
    lyricOffsetMs: input13.lyricOffsetMs ?? 0,
    renderTrimStartMs: input13.renderTrimStartMs ?? 0,
    renderDurationInFrames: input13.renderDurationInFrames ?? input13.durationInFrames,
    durationInFrames: input13.durationInFrames,
    fps: input13.fps,
    background: {
      kind: "image",
      src: backgroundSrc13,
      color: input13.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
    poetryFrame: input13.poetryFrame
      ? {
          nickname: input13.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input13.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input13.poetryFrame.leftVertical ?? "",
          rightVertical: input13.poetryFrame.rightVertical ?? "",
          bottomLine: input13.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input13.lyrics),
    audioFeatures: rawAudioFeatures13 as AudioFeatureTrack
  },
  {
    id: "Price Tag - Jessie J - 5rcmr-eX2-Y",
    title: input14.title,
    artist: input14.artist,
    audioSrc: audioSrc14,
    lyricOffsetMs: input14.lyricOffsetMs ?? 0,
    renderTrimStartMs: input14.renderTrimStartMs ?? 0,
    renderDurationInFrames: input14.renderDurationInFrames ?? input14.durationInFrames,
    durationInFrames: input14.durationInFrames,
    fps: input14.fps,
    background: {
      kind: "image",
      src: backgroundSrc14,
      color: input14.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
    poetryFrame: input14.poetryFrame
      ? {
          nickname: input14.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input14.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input14.poetryFrame.leftVertical ?? "",
          rightVertical: input14.poetryFrame.rightVertical ?? "",
          bottomLine: input14.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input14.lyrics),
    audioFeatures: rawAudioFeatures14 as AudioFeatureTrack
  },
  {
    id: "Without Me - Halsey - Tk7WFyHUr1E",
    title: input15.title,
    artist: input15.artist,
    audioSrc: audioSrc15,
    lyricOffsetMs: input15.lyricOffsetMs ?? 0,
    renderTrimStartMs: input15.renderTrimStartMs ?? 0,
    renderDurationInFrames: input15.renderDurationInFrames ?? input15.durationInFrames,
    durationInFrames: input15.durationInFrames,
    fps: input15.fps,
    background: {
      kind: "image",
      src: backgroundSrc15,
      color: input15.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
    poetryFrame: input15.poetryFrame
      ? {
          nickname: input15.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input15.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input15.poetryFrame.leftVertical ?? "",
          rightVertical: input15.poetryFrame.rightVertical ?? "",
          bottomLine: input15.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input15.lyrics),
    audioFeatures: rawAudioFeatures15 as AudioFeatureTrack
  }
];

const queue: import("../../modules/render-core/src").QueueTrack[] = [
  {
    id: "Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY",
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
    id: "Take On Me (Official Video) [4K] - a-ha - djV11Xbc914",
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
    id: "Hey There Delilah - Plain White Ts - oEeet9t--tI",
    title: input4.title,
    artist: input4.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "From The Start (Official Music Video) - Laufey - lSD_L-xic9o",
    title: input5.title,
    artist: input5.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY",
    title: input6.title,
    artist: input6.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "24 - sundial - Topic - wlg7dhAJkrA",
    title: input7.title,
    artist: input7.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "If We Ever Broke Up (Official Video) - Mae Stephens - TbGT3d0pHgo",
    title: input8.title,
    artist: input8.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "Rema - Selena Gomez - Calm Down (Official Music Video) - Selena Gomez - WcIcVapfqXw",
    title: input9.title,
    artist: input9.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "blue - yung kai - MHCsrKA9gh8",
    title: input10.title,
    artist: input10.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "I Got Better - Morgan Wallen - Xc-dEsMbQJM",
    title: input11.title,
    artist: input11.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "Towards The Sun (From The -Home- Soundtrack) - Rihanna - mhPDe4IyqeU",
    title: input12.title,
    artist: input12.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "Made You Look (Official Music Video) - Meghan Trainor - gPCCYMeXin0",
    title: input13.title,
    artist: input13.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "Price Tag - Jessie J - 5rcmr-eX2-Y",
    title: input14.title,
    artist: input14.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  },
  {
    id: "Without Me - Halsey - Tk7WFyHUr1E",
    title: input15.title,
    artist: input15.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  }
];

const initialSongId = "Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY";
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
    {id: "night-drive", name: "Night Drive", count: 2, accent: "rgba(255,255,255,0.58)", trackIds: ["Take On Me (Official Video) [4K] - a-ha - djV11Xbc914","Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ"]},
    {id: "city-echoes", name: "City Echoes", count: 0, accent: "rgba(255,255,255,0.58)", trackIds: []},
    {id: "neon-pulse", name: "Neon Pulse", count: 0, accent: "rgba(255,255,255,0.58)", trackIds: []},
    {id: "soft-pages", name: "Soft Pages", count: 0, accent: "rgba(255,255,255,0.58)", trackIds: []},
    {id: "afterglow", name: "Afterglow", count: 1, accent: "rgba(255,255,255,0.58)", trackIds: ["Take On Me (Official Video) [4K] - a-ha - djV11Xbc914"]},
    {id: "new-downloads", name: "New Downloads", count: 1, accent: "rgba(255,255,255,0.58)", trackIds: ["Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY"]}
  ]
};
