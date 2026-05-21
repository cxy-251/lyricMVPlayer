import {spawnSync} from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const songDirName = process.argv.slice(2).join(" ").trim();

if (!songDirName) {
  throw new Error('Usage: npm run apply:manual-lyrics -- "<song-folder-name>"');
}

const scriptPath = path.join(projectRoot, "modules", "audio-lyrics-alignment", "run_manual_lyrics.py");
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
