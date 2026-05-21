import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const songsRoot = path.join(projectRoot, "artifacts", "songs");
const queueCsvPath = path.join(projectRoot, "artifacts", "common", "production-queue.csv");
const libraryStatePath = path.join(projectRoot, "artifacts", "common", "library-state.json");
const currentSongConfigPath = path.join(projectRoot, "src", "remotion", "current-song.json");
const previewPropsPath = path.join(projectRoot, "src", "remotion", "preview-composition-props.ts");

const requested = process.argv.slice(2).join(" ").trim();

if (!requested) {
  throw new Error("Usage: node tools/select-song-for-preview.mjs \"<song-folder-name>\"");
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
  new Set([
    selectedSongDirName,
    ...queueRows.map((row) => row.song_dir).filter(Boolean),
  ])
).filter((songDirName) => {
  const songDirPath = path.join(songsRoot, songDirName);
  return fs.existsSync(songDirPath) && fs.statSync(songDirPath).isDirectory();
});

const supportedBackgrounds = ["background.png", "background.jpg", "background.jpeg", "background.webp"];

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

  const songImportBase = `../../artifacts/songs/${songDirName}`;
  const renderImport = `import rawRenderInput${index} from "${songImportBase}/render-input.json";`;
  const featuresImport = `import rawAudioFeatures${index} from "${songImportBase}/audio-features.json";`;
  const audioImport = `import audioSrc${index} from "${songImportBase}/audio.mp3";`;

  const backgroundFileName = supportedBackgrounds.find((candidate) =>
    fs.existsSync(path.join(songDirPath, candidate))
  );
  const backgroundImport = backgroundFileName
    ? `import backgroundSrc${index} from "${songImportBase}/${backgroundFileName}";`
    : "";

  return {
    songDirName,
    renderImport,
    featuresImport,
    audioImport,
    backgroundImport,
    backgroundExists: Boolean(backgroundFileName),
    backgroundSrcExpression: backgroundFileName ? `backgroundSrc${index}` : "undefined",
    renderVar: `rawRenderInput${index}`,
    featuresVar: `rawAudioFeatures${index}`,
    audioVar: `audioSrc${index}`,
  };
};

const songEntries = uniqueSongDirNames.map(buildSongEntry);

const importLines = songEntries.flatMap((entry) =>
  [entry.audioImport, entry.featuresImport, entry.renderImport, entry.backgroundImport].filter(Boolean)
);

const typedRenderInputsSource = songEntries
  .map((entry) => `const input${entry.renderVar.replace("rawRenderInput", "")} = ${entry.renderVar} as RawRenderInput;`)
  .join("\n");

const libraryItemsSource = songEntries
  .map((entry) => {
  return `  {
    id: ${JSON.stringify(entry.songDirName)},
    title: input${entry.renderVar.replace("rawRenderInput", "")}.title,
    artist: input${entry.renderVar.replace("rawRenderInput", "")}.artist,
    audioSrc: ${entry.audioVar},
    lyricOffsetMs: input${entry.renderVar.replace("rawRenderInput", "")}.lyricOffsetMs ?? 0,
    renderTrimStartMs: input${entry.renderVar.replace("rawRenderInput", "")}.renderTrimStartMs ?? 0,
    renderDurationInFrames: input${entry.renderVar.replace("rawRenderInput", "")}.renderDurationInFrames ?? input${entry.renderVar.replace("rawRenderInput", "")}.durationInFrames,
    durationInFrames: input${entry.renderVar.replace("rawRenderInput", "")}.durationInFrames,
    fps: input${entry.renderVar.replace("rawRenderInput", "")}.fps,
    background: {
      kind: ${entry.backgroundExists ? `"image"` : `(input${entry.renderVar.replace("rawRenderInput", "")}.background.kind ?? "color") as "image" | "video" | "color"`},
      src: ${entry.backgroundSrcExpression},
      color: input${entry.renderVar.replace("rawRenderInput", "")}.background.color ?? "#101828"
    } as import("../../modules/render-core/src").BackgroundAsset,
    poetryFrame: input${entry.renderVar.replace("rawRenderInput", "")}.poetryFrame
      ? {
          nickname: input${entry.renderVar.replace("rawRenderInput", "")}.poetryFrame.nickname ?? "CleanKsen",
          topLabel: input${entry.renderVar.replace("rawRenderInput", "")}.poetryFrame.topLabel ?? "CLEANKSEN · AUDIO DIARY",
          leftVertical: input${entry.renderVar.replace("rawRenderInput", "")}.poetryFrame.leftVertical ?? "",
          rightVertical: input${entry.renderVar.replace("rawRenderInput", "")}.poetryFrame.rightVertical ?? "",
          bottomLine: input${entry.renderVar.replace("rawRenderInput", "")}.poetryFrame.bottomLine ?? ""
        }
      : undefined,
    lyrics: normalizeLyrics(input${entry.renderVar.replace("rawRenderInput", "")}.lyrics),
    audioFeatures: ${entry.featuresVar} as AudioFeatureTrack
  }`;
  })
  .join(",\n");

const queueSource = songEntries
  .map(
    (entry) => `  {
    id: ${JSON.stringify(entry.songDirName)},
    title: input${entry.renderVar.replace("rawRenderInput", "")}.title,
    artist: input${entry.renderVar.replace("rawRenderInput", "")}.artist,
    accent: "rgba(163, 206, 255, 0.7)"
  }`
  )
  .join(",\n");

const playlistSeedSource = Array.isArray(libraryState?.customPlaylists)
  ? libraryState.customPlaylists
      .map((playlist) => {
        const trackIds =
          playlist.trackIds === "__ALL__"
            ? "queue.map((track) => track.id)"
            : JSON.stringify(Array.isArray(playlist.trackIds) ? playlist.trackIds : []);
        return `    {id: ${JSON.stringify(playlist.id)}, name: ${JSON.stringify(
          playlist.name
        )}, count: ${trackIds === "queue.map((track) => track.id)" ? "queue.length" : `${JSON.parse(trackIds).length}`}, accent: "rgba(255,255,255,0.58)", trackIds: ${trackIds}}`;
      })
      .join(",\n")
  : `    {id: "night-drive", name: "Night Drive", count: queue.length, accent: "rgba(163, 206, 255, 0.72)", trackIds: queue.map((track) => track.id)},
    {id: "drafts", name: "Drafts", count: 0, accent: "rgba(255,255,255,0.58)", trackIds: []}`;

const previewPropsSource = `import type {
  AudioFeatureTrack,
  LyricVideoCompositionProps,
  TimedLyricLine
} from "../../modules/render-core/src";

${importLines.join("\n")}

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

${typedRenderInputsSource}

const library: import("../../modules/render-core/src").SongLibraryItem[] = [
${libraryItemsSource}
];

const queue: import("../../modules/render-core/src").QueueTrack[] = [
${queueSource}
];

const initialSongId = ${JSON.stringify(selectedSongDirName)};
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
${playlistSeedSource}
  ]
};
`;

fs.writeFileSync(currentSongConfigPath, JSON.stringify({songDirName: selectedSongDirName}, null, 2) + "\n", "utf-8");
fs.writeFileSync(previewPropsPath, previewPropsSource, "utf-8");

console.log(selectedSongDirName);
