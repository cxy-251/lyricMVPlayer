import {spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const playlistUrl = process.argv[2];
const defaultRenderBatch = process.argv[3] ?? "0";

if (!playlistUrl) {
  throw new Error('Usage: npm run prepare:playlist -- "<playlist-url>" [default-render-batch]');
}

const scriptPath = path.join(projectRoot, "modules", "playlist-pipeline", "playlist_pipeline.py");
const result = spawnSync(
  "conda",
  ["run", "-n", "kwai", "python", scriptPath, playlistUrl, projectRoot, defaultRenderBatch],
  {
    cwd: projectRoot,
    stdio: "inherit",
  }
);

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

const currentSongConfigPath = path.join(projectRoot, "src", "remotion", "current-song.json");
if (fs.existsSync(currentSongConfigPath)) {
  const currentSongConfig = JSON.parse(fs.readFileSync(currentSongConfigPath, "utf-8"));
  const songDirName = currentSongConfig.songDirName;
  if (songDirName) {
    const refreshResult = spawnSync("node", ["tools/select-song-for-preview.mjs", songDirName], {
      cwd: projectRoot,
      stdio: "inherit",
    });
    if ((refreshResult.status ?? 1) !== 0) {
      process.exit(refreshResult.status ?? 1);
    }
  }
}

process.exit(0);
