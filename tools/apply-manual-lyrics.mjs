import {spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const songDirName = process.argv.slice(2).join(" ").trim();

if (!songDirName) {
  throw new Error('Usage: npm run apply:manual-lyrics -- "<song-folder-name>"');
}

const scriptPath = path.join(projectRoot, "backend", "audio-lyrics-alignment", "run_manual_lyrics.py");
const result = spawnSync(
  "conda",
  ["run", "-n", "kwai", "python", scriptPath, projectRoot, songDirName],
  {
    cwd: projectRoot,
    stdio: "inherit",
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const currentSongConfigPath = path.join(projectRoot, "src", "remotion", "current-song.json");
let refreshSongDirName = songDirName;

if (fs.existsSync(currentSongConfigPath)) {
  try {
    const currentSongConfig = JSON.parse(fs.readFileSync(currentSongConfigPath, "utf-8"));
    const candidate = currentSongConfig?.songDirName;
    if (typeof candidate === "string" && candidate.trim()) {
      const candidateSongDir = path.join(projectRoot, "artifacts", "songs", candidate);
      if (fs.existsSync(candidateSongDir)) {
        refreshSongDirName = candidate;
      }
    }
  } catch {
    refreshSongDirName = songDirName;
  }
}

const refreshScriptPath = path.join(projectRoot, "tools", "select-song-for-preview.mjs");
const refreshResult = spawnSync("node", [refreshScriptPath, refreshSongDirName], {
  cwd: projectRoot,
  stdio: "inherit",
});

if (refreshResult.status !== 0) {
  process.exit(refreshResult.status ?? 1);
}
