import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const songsRoot = path.join(projectRoot, "artifacts", "songs");
const queueCsvPath = path.join(projectRoot, "artifacts", "common", "production-queue.csv");
const libraryStatePath = path.join(projectRoot, "artifacts", "common", "library-state.json");
const currentSongConfigPath = path.join(projectRoot, "src", "remotion", "current-song.json");
const previewManifestPath = path.join(projectRoot, "src", "remotion", "preview-library-manifest.json");
const previewAssetMapPath = path.join(projectRoot, "src", "remotion", "preview-asset-map.ts");
const previewPropsPath = path.join(projectRoot, "src", "remotion", "preview-composition-props.ts");

const requested = process.argv.slice(2).join(" ").trim();

if (!requested) {
  throw new Error('Usage: node tools/select-song-for-preview.mjs "<song-folder-name>"');
}

const absoluteCandidate = path.isAbsolute(requested) ? requested : path.join(songsRoot, requested);
const selectedSongDirPath = path.resolve(absoluteCandidate);

if (!fs.existsSync(selectedSongDirPath) || !fs.statSync(selectedSongDirPath).isDirectory()) {
  throw new Error(`Song directory not found: ${selectedSongDirPath}`);
}

const selectedSongDirName = path.basename(selectedSongDirPath);

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};

const parseCsv = (csvText) => {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length <= 1) {
    return [];
  }
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
};

const queueRows = fs.existsSync(queueCsvPath)
  ? parseCsv(fs.readFileSync(queueCsvPath, "utf-8")).filter((row) => row.song_dir)
  : [];

const libraryState = fs.existsSync(libraryStatePath)
  ? JSON.parse(fs.readFileSync(libraryStatePath, "utf-8"))
  : null;

const uniqueSongDirNames = Array.from(
  new Set([selectedSongDirName, ...queueRows.map((row) => row.song_dir).filter(Boolean)])
).filter((songDirName) => {
  const songDirPath = path.join(songsRoot, songDirName);
  return fs.existsSync(songDirPath) && fs.statSync(songDirPath).isDirectory();
});

const supportedBackgrounds = ["background.png", "background.jpg", "background.jpeg", "background.webp"];

const normalizePoetryFrame = (poetryFrame) =>
  poetryFrame
    ? {
        nickname: poetryFrame.nickname ?? "CleanKsen",
        topLabel: poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
        leftVertical: poetryFrame.leftVertical ?? "",
        rightVertical: poetryFrame.rightVertical ?? "",
        bottomLine: poetryFrame.bottomLine ?? ""
      }
    : undefined;

const buildSongEntry = (songDirName, index) => {
  const songDirPath = path.join(songsRoot, songDirName);
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

  const renderInput = JSON.parse(fs.readFileSync(renderInputPath, "utf-8"));
  const backgroundFileName = supportedBackgrounds.find((candidate) =>
    fs.existsSync(path.join(songDirPath, candidate))
  );

  const songImportBase = `../../artifacts/songs/${songDirName}`;

  return {
    id: songDirName,
    index,
    audioImport: `import audioSrc${index} from "${songImportBase}/audio.mp3";`,
    audioFeaturesImport: `import rawAudioFeatures${index} from "${songImportBase}/audio-features.json";`,
    backgroundImport: backgroundFileName
      ? `import backgroundSrc${index} from "${songImportBase}/${backgroundFileName}";`
      : "",
    audioVar: `audioSrc${index}`,
    audioFeaturesVar: `rawAudioFeatures${index}`,
    backgroundVar: backgroundFileName ? `backgroundSrc${index}` : null,
    song: {
      id: songDirName,
      title: renderInput.title,
      artist: renderInput.artist,
      lyricOffsetMs: renderInput.lyricOffsetMs ?? 0,
      renderTrimStartMs: renderInput.renderTrimStartMs ?? 0,
      renderDurationInFrames: renderInput.renderDurationInFrames ?? renderInput.durationInFrames,
      durationInFrames: renderInput.durationInFrames,
      fps: renderInput.fps,
      background: {
        kind: backgroundFileName ? "image" : renderInput.background?.kind ?? "color",
        color: renderInput.background?.color ?? "#101828"
      },
      poetryFrame: normalizePoetryFrame(renderInput.poetryFrame),
      lyrics: renderInput.lyrics
    }
  };
};

const songEntries = uniqueSongDirNames.map(buildSongEntry);

const queue = songEntries.map((entry) => ({
  id: entry.id,
  title: entry.song.title,
  artist: entry.song.artist,
  accent: "rgba(163, 206, 255, 0.7)"
}));

const playlists = [
  {
    id: "liked",
    name: "Liked Songs",
    count: Array.isArray(libraryState?.likedTrackIds) ? libraryState.likedTrackIds.length : 0,
    accent: "rgba(255, 196, 170, 0.78)"
  },
  ...((Array.isArray(libraryState?.customPlaylists) ? libraryState.customPlaylists : []).map((playlist) => {
    const trackIds =
      playlist.trackIds === "__ALL__"
        ? queue.map((track) => track.id)
        : Array.isArray(playlist.trackIds)
          ? playlist.trackIds
          : [];

    return {
      id: playlist.id,
      name: playlist.name,
      count: trackIds.length,
      accent: "rgba(255,255,255,0.58)",
      trackIds
    };
  }))
];

const manifestPayload = {
  selectedSongDirName,
  songs: songEntries.map((entry) => entry.song),
  queue,
  playlists
};

const assetImports = songEntries.flatMap((entry) =>
  [entry.audioImport, entry.audioFeaturesImport, entry.backgroundImport].filter(Boolean)
);

const assetMapEntries = songEntries
  .map((entry) => {
    const backgroundLine = entry.backgroundVar ? `backgroundSrc: ${entry.backgroundVar},` : "";
    return `  ${JSON.stringify(entry.id)}: {
    audioSrc: ${entry.audioVar},
    audioFeatures: ${entry.audioFeaturesVar} as AudioFeatureTrack,
    ${backgroundLine}
  }`;
  })
  .join(",\n");

const assetMapSource = `import type {AudioFeatureTrack} from "../../modules/render-core/src";

${assetImports.join("\n")}

export const previewAssetMap: Record<string, {audioSrc: string; audioFeatures: AudioFeatureTrack; backgroundSrc?: string}> = {
${assetMapEntries}
};
`;

const previewPropsSource = `import type {
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
`;

fs.writeFileSync(currentSongConfigPath, `${JSON.stringify({songDirName: selectedSongDirName}, null, 2)}\n`, "utf-8");
fs.writeFileSync(previewManifestPath, `${JSON.stringify(manifestPayload, null, 2)}\n`, "utf-8");
fs.writeFileSync(previewAssetMapPath, assetMapSource, "utf-8");
fs.writeFileSync(previewPropsPath, previewPropsSource, "utf-8");

console.log(selectedSongDirName);
