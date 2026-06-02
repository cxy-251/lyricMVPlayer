import {spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const mode = process.argv[2] ?? "queue";
const modeArgs = process.argv.slice(3);
const songDirName = modeArgs.join(" ").trim();
const playlistId = modeArgs[0] ?? "";

const scriptPath = path.join(
  projectRoot,
  "modules",
  "background-generation",
  "run_background_generation.py"
);

const args =
  mode === "song"
    ? ["run", "-n", "kwai", "python", scriptPath, "song", projectRoot, songDirName]
    : mode === "playlist"
      ? ["run", "-n", "kwai", "python", scriptPath, "playlist", projectRoot, playlistId]
    : ["run", "-n", "kwai", "python", scriptPath, mode, projectRoot, ...modeArgs];

if (mode === "song" && !songDirName) {
  throw new Error('Usage: node tools/generate-backgrounds.mjs song "<song-folder-name>"');
}

if (mode === "playlist" && !playlistId) {
  throw new Error('Usage: node tools/generate-backgrounds.mjs playlist "<playlist-id>"');
}

const result = spawnSync("conda", args, {
  cwd: projectRoot,
  stdio: "inherit",
});

const generationStatus = result.status ?? 1;

const currentSongConfigPath = path.join(projectRoot, "src", "remotion", "current-song.json");
const selectSongScriptPath = path.join(projectRoot, "tools", "select-song-for-preview.mjs");
const buildWebPublicScriptPath = path.join(projectRoot, "tools", "build-web-public.mjs");

if (generationStatus === 0 && fs.existsSync(currentSongConfigPath)) {
  try {
    const currentSongConfig = JSON.parse(fs.readFileSync(currentSongConfigPath, "utf-8"));
    const currentSongDirName = currentSongConfig?.songDirName;
    if (typeof currentSongDirName === "string" && currentSongDirName.trim()) {
      const refreshResult = spawnSync(
        "node",
        [selectSongScriptPath, currentSongDirName],
        {
          cwd: projectRoot,
          stdio: "inherit",
        }
      );
      if ((refreshResult.status ?? 1) !== 0) {
        process.exit(generationStatus || (refreshResult.status ?? 1));
      }
    }
  } catch (error) {
    console.error("Failed to refresh preview props after background generation:", error);
    process.exit(generationStatus || 1);
  }
}

const webRefreshResult = spawnSync(
  "node",
  [buildWebPublicScriptPath],
  {
    cwd: projectRoot,
    stdio: "inherit",
  }
);
if ((webRefreshResult.status ?? 1) !== 0) {
  process.exit(generationStatus || (webRefreshResult.status ?? 1));
}

process.exit(generationStatus);
