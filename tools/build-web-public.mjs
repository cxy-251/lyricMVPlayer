import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const artifactsRoot = path.join(projectRoot, "artifacts");
const songsRoot = path.join(artifactsRoot, "songs");
const commonRoot = path.join(artifactsRoot, "common");
const publicRoot = path.join(projectRoot, "public-web");
const currentSongConfigPath = path.join(projectRoot, "src", "remotion", "current-song.json");
const libraryStatePath = path.join(commonRoot, "library-state.json");
const queueCsvPath = path.join(commonRoot, "production-queue.csv");

const ensureDir = (targetPath) => {
  fs.mkdirSync(targetPath, {recursive: true});
};

const resetDir = (targetPath) => {
  fs.rmSync(targetPath, {recursive: true, force: true});
  ensureDir(targetPath);
};

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
  const trimmed = csvText.trim();
  if (!trimmed) {
    return [];
  }
  const lines = trimmed.split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
};

const supportedBackgrounds = ["background.png", "background.jpg", "background.jpeg", "background.webp"];

const currentSongConfig = fs.existsSync(currentSongConfigPath)
  ? JSON.parse(fs.readFileSync(currentSongConfigPath, "utf-8"))
  : {songDirName: ""};

const libraryState = fs.existsSync(libraryStatePath)
  ? JSON.parse(fs.readFileSync(libraryStatePath, "utf-8"))
  : {
      nickname: "CleanKsen",
      selectedPlaylistId: "new-downloads",
      likedTrackIds: [],
      customPlaylists: [
        {id: "new-downloads", name: "New Downloads", trackIds: []},
        {id: "lyrics-review", name: "Lyrics Review", trackIds: []},
        {id: "alignment-error", name: "Alignment Error", trackIds: []},
      ],
    };

const queueRows = fs.existsSync(queueCsvPath)
  ? parseCsv(fs.readFileSync(queueCsvPath, "utf-8")).filter((row) => row.song_dir)
  : [];

const queueSongIds = queueRows.map((row) => row.song_dir).filter(Boolean);
const songDirNames = Array.from(
  new Set([
    currentSongConfig.songDirName,
    ...queueSongIds,
    ...fs
      .readdirSync(songsRoot, {withFileTypes: true})
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  ].filter(Boolean))
);

resetDir(publicRoot);
ensureDir(path.join(publicRoot, "songs"));

const songs = [];

for (const songDirName of songDirNames) {
  const songDirPath = path.join(songsRoot, songDirName);
  const renderInputPath = path.join(songDirPath, "render-input.json");
  const audioFeaturesPath = path.join(songDirPath, "audio-features.json");
  const audioPath = path.join(songDirPath, "audio.mp3");

  if (!fs.existsSync(songDirPath) || !fs.statSync(songDirPath).isDirectory()) {
    continue;
  }
  if (!fs.existsSync(renderInputPath) || !fs.existsSync(audioFeaturesPath) || !fs.existsSync(audioPath)) {
    continue;
  }

  const backgroundFileName = supportedBackgrounds.find((candidate) => fs.existsSync(path.join(songDirPath, candidate)));
  const publicSongDir = path.join(publicRoot, "songs", songDirName);
  ensureDir(publicSongDir);

  fs.copyFileSync(audioPath, path.join(publicSongDir, "audio.mp3"));
  fs.copyFileSync(audioFeaturesPath, path.join(publicSongDir, "audio-features.json"));

  if (backgroundFileName) {
    fs.copyFileSync(path.join(songDirPath, backgroundFileName), path.join(publicSongDir, backgroundFileName));
  }

  const renderInput = JSON.parse(fs.readFileSync(renderInputPath, "utf-8"));
  const rewrittenRenderInput = {
    ...renderInput,
    audioSrc: `/songs/${encodeURIComponent(songDirName)}/audio.mp3`,
    background: {
      ...renderInput.background,
      kind: backgroundFileName ? "image" : renderInput.background?.kind ?? "color",
      src: backgroundFileName ? `/songs/${encodeURIComponent(songDirName)}/${backgroundFileName}` : undefined,
    },
    songDir: songDirName,
  };

  fs.writeFileSync(
    path.join(publicSongDir, "render-input.json"),
    JSON.stringify(rewrittenRenderInput, null, 2) + "\n"
  );

  songs.push({
    id: songDirName,
    title: renderInput.title,
    artist: renderInput.artist,
    renderInputUrl: `/songs/${encodeURIComponent(songDirName)}/render-input.json`,
    audioFeaturesUrl: `/songs/${encodeURIComponent(songDirName)}/audio-features.json`,
  });
}

const manifest = {
  nickname: libraryState.nickname ?? "CleanKsen",
  selectedPlaylistId: libraryState.selectedPlaylistId ?? "new-downloads",
  currentSongDirName: currentSongConfig.songDirName || songs[0]?.id || "",
  likedTrackIds: Array.isArray(libraryState.likedTrackIds) ? libraryState.likedTrackIds : [],
  customPlaylists: Array.isArray(libraryState.customPlaylists) ? libraryState.customPlaylists : [],
  songs,
};

fs.writeFileSync(path.join(publicRoot, "library-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
