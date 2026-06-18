import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const artifactsRoot = path.join(projectRoot, "artifacts");
const songsRoot = path.join(artifactsRoot, "songs");
const commonRoot = path.join(artifactsRoot, "common");
const paperOutputRoot = path.join(artifactsRoot, "paper-video", "output");
const publicRoot = path.join(projectRoot, "public-web");
const currentSongConfigPath = path.join(projectRoot, "src", "remotion", "current-song.json");
const libraryStatePath = path.join(commonRoot, "library-state.json");
const queueCsvPath = path.join(commonRoot, "production-queue.csv");
const demoSongsPath = path.join(projectRoot, "config", "demo-songs.json");
const demoOnly = process.argv.includes("--demo");

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

const collectFiles = (rootDir, fileName) => {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const found = [];
  const walk = (dirPath) => {
    for (const entry of fs.readdirSync(dirPath, {withFileTypes: true})) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.isFile() && entry.name === fileName) {
        found.push(entryPath);
      }
    }
  };
  walk(rootDir);
  return found;
};

const buildPaperLibrary = () => {
  const runsRoot = path.join(paperOutputRoot, "runs");
  const manifests = collectFiles(runsRoot, "render-manifest.json");
  const latestByProject = new Map();

  for (const manifestPath of manifests) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (!manifest.paper?.title || !Array.isArray(manifest.scenes)) {
        continue;
      }

      const relativeParts = path.relative(runsRoot, manifestPath).split(path.sep);
      const projectId = manifest.projectId || relativeParts[0];
      const runId = relativeParts[1] || "default";
      const item = {
        id: `${projectId}__${runId}`.replace(/[^a-zA-Z0-9_.-]+/g, "-"),
        projectId,
        runId,
        label: manifest.paper.paperId || projectId,
        title: manifest.paper.title,
        source: path.relative(projectRoot, manifestPath),
        renderManifestPath: manifestPath,
        sceneCount: manifest.scenes.length,
        durationSeconds: Math.round((manifest.totalFrames / manifest.fps) * 10) / 10,
        themeId: manifest.theme?.id ?? "",
      };
      const previous = latestByProject.get(projectId);
      if (!previous || String(runId).localeCompare(String(previous.runId)) > 0) {
        latestByProject.set(projectId, item);
      }
    } catch {
      // Ignore stale or malformed paper artifacts.
    }
  }

  return Array.from(latestByProject.values()).sort((a, b) => {
    const left = `${a.runId}-${a.projectId}`;
    const right = `${b.runId}-${b.projectId}`;
    return right.localeCompare(left);
  });
};

const backgroundAssetPattern = /^background(?:[-_].*)?\.(png|jpg|jpeg|webp)$/i;

const findBackgroundFileName = (songDirPath) => {
  const candidates = fs
    .readdirSync(songDirPath, {withFileTypes: true})
    .filter((entry) => entry.isFile() && backgroundAssetPattern.test(entry.name))
    .map((entry) => entry.name);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((left, right) => {
    const leftStats = fs.statSync(path.join(songDirPath, left));
    const rightStats = fs.statSync(path.join(songDirPath, right));
    return rightStats.mtimeMs - leftStats.mtimeMs;
  })[0];
};

const parseSongDirName = (songDirName) => {
  const parts = songDirName.split(" - ");
  if (parts.length >= 3) {
    return {
      title: parts.slice(0, -2).join(" - "),
      artist: parts[parts.length - 2],
    };
  }

  return {
    title: songDirName,
    artist: "Unknown Artist",
  };
};

const readJsonIfExists = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
};

const createFallbackRenderInput = ({
  audioFeatures,
  backgroundFileName,
  songDirName,
  source,
}) => {
  const parsed = parseSongDirName(songDirName);
  const title = typeof source?.title === "string" && source.title.trim() ? source.title : parsed.title;
  const artist =
    typeof source?.channel === "string" && source.channel.trim()
      ? source.channel
      : typeof source?.uploader === "string" && source.uploader.trim()
        ? source.uploader
        : parsed.artist;
  const durationMs =
    typeof audioFeatures?.durationMs === "number"
      ? audioFeatures.durationMs
      : typeof source?.duration === "number"
        ? source.duration * 1000
        : 1000;
  const fps = 30;
  const durationInFrames = Math.max(1, Math.ceil((durationMs / 1000) * fps));

  return {
    title,
    artist,
    lyricOffsetMs: 0,
    renderTrimStartMs: 0,
    renderDurationInFrames: durationInFrames,
    durationInFrames,
    fps,
    background: backgroundFileName
      ? {kind: "image", color: null}
      : {kind: "color", color: "#101828"},
    poetryFrame: {
      nickname: libraryState.nickname ?? "CleanKsen",
      topLabel: `${(libraryState.nickname ?? "CleanKsen").toUpperCase()} · AUDIO DIARY`,
      leftVertical: "",
      rightVertical: "",
      bottomLine: "LYRICS NEED REVIEW",
      sonnetLines: [],
    },
    lyrics: [],
  };
};

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
const demoConfig = demoOnly ? readJsonIfExists(demoSongsPath) : null;
const demoSongIds = Array.isArray(demoConfig?.songIds)
  ? demoConfig.songIds.filter((songId) => typeof songId === "string" && songId.trim())
  : [];

if (demoOnly && demoSongIds.length !== 10) {
  throw new Error(`Demo build requires exactly 10 song IDs in ${demoSongsPath}`);
}

const songDirNames = demoOnly
  ? demoSongIds
  : Array.from(
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
  const sourcePath = path.join(songDirPath, "source.json");

  if (!fs.existsSync(songDirPath) || !fs.statSync(songDirPath).isDirectory()) {
    continue;
  }
  if (!fs.existsSync(audioFeaturesPath) || !fs.existsSync(audioPath)) {
    continue;
  }

  const backgroundFileName = findBackgroundFileName(songDirPath);
  const publicSongDir = path.join(publicRoot, "songs", songDirName);
  ensureDir(publicSongDir);

  fs.copyFileSync(audioPath, path.join(publicSongDir, "audio.mp3"));
  fs.copyFileSync(audioFeaturesPath, path.join(publicSongDir, "audio-features.json"));

  if (backgroundFileName) {
    fs.copyFileSync(path.join(songDirPath, backgroundFileName), path.join(publicSongDir, backgroundFileName));
  }

  const source = readJsonIfExists(sourcePath);
  const audioFeatures = readJsonIfExists(audioFeaturesPath);
  const hasRenderInput = fs.existsSync(renderInputPath);
  const renderInput = hasRenderInput
    ? JSON.parse(fs.readFileSync(renderInputPath, "utf-8"))
    : createFallbackRenderInput({audioFeatures, backgroundFileName, songDirName, source});
  const hasLyrics = Array.isArray(renderInput.lyrics) && renderInput.lyrics.length > 0;
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
    assetStatus: {
      audio: true,
      audioFeatures: true,
      background: Boolean(backgroundFileName),
      lyrics: hasLyrics,
      renderInput: hasRenderInput,
    },
  });
}

const availableSongIds = new Set(songs.map((song) => song.id));
const filterTrackIds = (trackIds) => {
  if (trackIds === "__ALL__") {
    return trackIds;
  }
  return Array.isArray(trackIds) ? trackIds.filter((trackId) => availableSongIds.has(trackId)) : [];
};
const filteredPlaylists = Array.isArray(libraryState.customPlaylists)
  ? libraryState.customPlaylists.map((playlist) => ({
      ...playlist,
      trackIds: filterTrackIds(playlist.trackIds),
    }))
  : [];
const currentSongDirName = availableSongIds.has(currentSongConfig.songDirName)
  ? currentSongConfig.songDirName
  : songs[0]?.id || "";

if (demoOnly && songs.length !== demoSongIds.length) {
  const missingSongIds = demoSongIds.filter((songId) => !availableSongIds.has(songId));
  throw new Error(`Demo assets are incomplete: ${missingSongIds.join(", ")}`);
}

const manifest = {
  nickname: libraryState.nickname ?? "CleanKsen",
  selectedPlaylistId: demoOnly ? "demo" : libraryState.selectedPlaylistId ?? "new-downloads",
  currentSongDirName,
  likedTrackIds: Array.isArray(libraryState.likedTrackIds)
    ? libraryState.likedTrackIds.filter((trackId) => availableSongIds.has(trackId))
    : [],
  customPlaylists: demoOnly
    ? [{id: "demo", name: "Demo", trackIds: "__ALL__"}]
    : filteredPlaylists,
  songs,
};

fs.writeFileSync(path.join(publicRoot, "library-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
fs.writeFileSync(path.join(publicRoot, "paper-library.json"), JSON.stringify({papers: buildPaperLibrary()}, null, 2) + "\n");
