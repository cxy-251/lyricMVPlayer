import {spawnSync} from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const batchValue = process.argv[2] ?? "0";

const renderQueueScript = path.join(projectRoot, "backend", "render-queue", "render_queue.py");
const selectSongScript = path.join(projectRoot, "tools", "select-song-for-preview.mjs");
const listResult = spawnSync(
  "uv",
  ["run", "python", renderQueueScript, "list-runnable", projectRoot, batchValue],
  {
    cwd: projectRoot,
    encoding: "utf-8",
  }
);

if (listResult.status !== 0) {
  process.stderr.write(listResult.stderr || "");
  process.exit(listResult.status ?? 1);
}

const rows = JSON.parse(listResult.stdout || "[]");
for (const row of rows) {
  const songDirName = row.song_dir;
  if (!songDirName) {
    continue;
  }

  const useSongResult = spawnSync(
    "node",
    [selectSongScript, "--render-only", songDirName],
    {
      cwd: projectRoot,
      stdio: "inherit",
    }
  );
  if (useSongResult.status !== 0) {
    process.exit(useSongResult.status ?? 1);
  }

  const renderResult = spawnSync(
    "npm",
    ["run", "render"],
    {
      cwd: projectRoot,
      stdio: "inherit",
    }
  );
  if (renderResult.status !== 0) {
    process.exit(renderResult.status ?? 1);
  }

  const markResult = spawnSync(
    "uv",
    ["run", "python", renderQueueScript, "mark", projectRoot, songDirName, "rendered"],
    {
      cwd: projectRoot,
      stdio: "inherit",
    }
  );
  if (markResult.status !== 0) {
    process.exit(markResult.status ?? 1);
  }
}
