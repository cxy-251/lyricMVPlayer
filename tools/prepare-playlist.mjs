import {spawnSync} from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const playlistUrl = process.argv[2];
const defaultRenderBatch = process.argv[3] ?? "";

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

process.exit(result.status ?? 1);
