import {spawnSync} from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const batchValue = process.argv[2] ?? "0";

const renderQueueScript = path.join(projectRoot, "modules", "render-queue", "render_queue.py");
const listResult = spawnSync(
  "conda",
  ["run", "-n", "kwai", "python", renderQueueScript, "list-runnable", projectRoot, batchValue],
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
  const songDirName = row["资源文件夹"];
  if (!songDirName) {
    continue;
  }

  const useSongResult = spawnSync(
    "npm",
    ["run", "use:song", "--", songDirName],
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
    "conda",
    ["run", "-n", "kwai", "python", renderQueueScript, "mark", projectRoot, songDirName, "已渲染"],
    {
      cwd: projectRoot,
      stdio: "inherit",
    }
  );
  if (markResult.status !== 0) {
    process.exit(markResult.status ?? 1);
  }
}
