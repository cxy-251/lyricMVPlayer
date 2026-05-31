import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const projectRoot = process.cwd();
const currentSongConfigPath = path.join(projectRoot, "src", "remotion", "current-song.json");

if (!fs.existsSync(currentSongConfigPath)) {
  throw new Error(`Missing current song config: ${currentSongConfigPath}`);
}

const currentSongConfig = JSON.parse(fs.readFileSync(currentSongConfigPath, "utf-8"));
const songDirName = currentSongConfig.songDirName;

if (!songDirName) {
  throw new Error("current-song.json does not contain songDirName");
}

const songDir = path.join(projectRoot, "artifacts", "songs", songDirName);
if (!fs.existsSync(songDir)) {
  throw new Error(`Song directory not found: ${songDir}`);
}

const songsOutDir = path.join(projectRoot, "artifacts", "songsout");
const finalOutputPath = path.join(songsOutDir, `${songDirName}.mp4`);
const remotionBin = path.join(projectRoot, "node_modules", ".bin", "remotion");
const selectSongScriptPath = path.join(projectRoot, "tools", "select-song-for-preview.mjs");
const renderConcurrency = process.env.REMOTION_CONCURRENCY ?? "3";
fs.mkdirSync(songsOutDir, {recursive: true});

const selectResult = spawnSync(
  "node",
  [selectSongScriptPath, "--render-only", songDirName],
  {
    cwd: projectRoot,
    stdio: "inherit",
  }
);

if (selectResult.status !== 0) {
  process.exit(selectResult.status ?? 1);
}

const renderResult = spawnSync(
  remotionBin,
  ["render", "src/remotion/RenderRoot.tsx", "MusicVideo", finalOutputPath, `--concurrency=${renderConcurrency}`],
  {
    cwd: projectRoot,
    stdio: "inherit",
  }
);

if (renderResult.status !== 0) {
  process.exit(renderResult.status ?? 1);
}
