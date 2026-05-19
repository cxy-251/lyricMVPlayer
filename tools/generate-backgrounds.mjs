import {spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const mode = process.argv[2] ?? "queue";
const songDirName = process.argv.slice(3).join(" ").trim();

const scriptPath = path.join(
  projectRoot,
  "modules",
  "background-generation",
  "run_background_generation.py"
);

const args =
  mode === "song"
    ? ["run", "-n", "kwai", "python", scriptPath, "song", projectRoot, songDirName]
    : ["run", "-n", "kwai", "python", scriptPath, mode, projectRoot];

if (mode === "song" && !songDirName) {
  throw new Error('Usage: node tools/generate-backgrounds.mjs song "<song-folder-name>"');
}

const result = spawnSync("conda", args, {
  cwd: projectRoot,
  stdio: "inherit",
});

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

const currentSongConfigPath = path.join(projectRoot, "src", "remotion", "current-song.json");
const selectSongScriptPath = path.join(projectRoot, "tools", "select-song-for-preview.mjs");

if (fs.existsSync(currentSongConfigPath)) {
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
        process.exit(refreshResult.status ?? 1);
      }
    }
  } catch (error) {
    console.error("Failed to refresh preview props after background generation:", error);
    process.exit(1);
  }
}

process.exit(0);
