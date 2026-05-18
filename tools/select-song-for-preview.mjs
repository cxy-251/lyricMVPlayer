import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const songsRoot = path.join(projectRoot, "artifacts", "songs");
const currentSongConfigPath = path.join(projectRoot, "src", "remotion", "current-song.json");
const previewPropsPath = path.join(projectRoot, "src", "remotion", "preview-composition-props.ts");

const requested = process.argv.slice(2).join(" ").trim();

if (!requested) {
  throw new Error("Usage: node tools/select-song-for-preview.mjs \"<song-folder-name>\"");
}

const absoluteCandidate = path.isAbsolute(requested) ? requested : path.join(songsRoot, requested);
const songDirPath = path.resolve(absoluteCandidate);

if (!fs.existsSync(songDirPath) || !fs.statSync(songDirPath).isDirectory()) {
  throw new Error(`Song directory not found: ${songDirPath}`);
}

const songDirName = path.basename(songDirPath);
const renderInputPath = path.join(songDirPath, "render-input.json");
const audioFeaturesPath = path.join(songDirPath, "audio-features.json");
const audioPath = path.join(songDirPath, "audio.mp3");

if (!fs.existsSync(renderInputPath)) {
  throw new Error(`Missing render-input.json in ${songDirPath}`);
}
if (!fs.existsSync(audioFeaturesPath)) {
  throw new Error(`Missing audio-features.json in ${songDirPath}`);
}
if (!fs.existsSync(audioPath)) {
  throw new Error(`Missing audio.mp3 in ${songDirPath}`);
}

const supportedBackgrounds = [
  "background.png",
  "background.jpg",
  "background.jpeg",
  "background.webp",
];

const backgroundFileName = supportedBackgrounds.find((candidate) =>
  fs.existsSync(path.join(songDirPath, candidate))
);

const songImportBase = `../../artifacts/songs/${songDirName}`;
const backgroundImportLine = backgroundFileName
  ? `import previewBackgroundSrc from "${songImportBase}/${backgroundFileName}";`
  : "";
const backgroundSrcExpression = backgroundFileName
  ? `input.background.kind === "image" ? previewBackgroundSrc : undefined`
  : "undefined";

const previewPropsSource = `import type {
  AudioFeatureTrack,
  LyricVideoCompositionProps,
  TimedLyricLine
} from "../../modules/render-core/src";

import previewAudioSrc from "${songImportBase}/audio.mp3";
import rawAudioFeatures from "${songImportBase}/audio-features.json";
${backgroundImportLine}
import rawRenderInput from "${songImportBase}/render-input.json";

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
  poetryFrame?: {
    nickname?: string | null;
    topLabel?: string | null;
    leftVertical?: string | null;
    rightVertical?: string | null;
    bottomLine?: string | null;
  };
  lyrics: RawTimedLyricLine[];
};

type RawAudioFeatureFrame = {
  timeMs: number;
  bass: number;
  mid: number;
  high: number;
  energy: number;
  beat: number;
  onset: number;
};

type RawAudioFeatureTrack = {
  frameRate: number;
  durationMs: number;
  frames: RawAudioFeatureFrame[];
};

const normalizeLyrics = (lyrics: RawTimedLyricLine[]): TimedLyricLine[] => {
  return lyrics.map((line) => ({
    startMs: line.startMs,
    endMs: line.endMs,
    text: line.text
  }));
};

const input = rawRenderInput as RawRenderInput;
const audioFeatures = rawAudioFeatures as RawAudioFeatureTrack;

export const previewCompositionProps: LyricVideoCompositionProps = {
  title: input.title,
  artist: input.artist,
  audioSrc: previewAudioSrc,
  lyricOffsetMs: input.lyricOffsetMs ?? 0,
  durationInFrames: input.durationInFrames,
  fps: input.fps,
  background: {
    kind: input.background.kind ?? "color",
    src: ${backgroundSrcExpression},
    color: input.background.color ?? "#101828"
  },
  poetryFrame: input.poetryFrame
    ? {
        nickname: input.poetryFrame.nickname ?? "@xcai43323",
        topLabel: input.poetryFrame.topLabel ?? "@xcai43323 · AUDIO DIARY",
        leftVertical: input.poetryFrame.leftVertical ?? "",
        rightVertical: input.poetryFrame.rightVertical ?? "",
        bottomLine: input.poetryFrame.bottomLine ?? ""
      }
    : undefined,
  lyrics: normalizeLyrics(input.lyrics),
  audioFeatures: audioFeatures as AudioFeatureTrack,
  queue: [
    {
      id: "${songDirName}",
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
`;

fs.writeFileSync(currentSongConfigPath, JSON.stringify({songDirName}, null, 2) + "\n", "utf-8");
fs.writeFileSync(previewPropsPath, previewPropsSource, "utf-8");

console.log(songDirName);
