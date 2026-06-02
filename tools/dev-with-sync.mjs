import {spawn, spawnSync} from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const syncServerPath = path.join(projectRoot, "tools", "library-state-sync-server.mjs");
const buildPublicPath = path.join(projectRoot, "tools", "build-web-public.mjs");
const viteCommand = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vite.cmd" : "vite",
);

const buildResult = spawnSync(process.execPath, [buildPublicPath], {
  cwd: projectRoot,
  stdio: "inherit",
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const syncServer = spawn(process.execPath, [syncServerPath], {
  cwd: projectRoot,
  stdio: "inherit",
});

const webApp = spawn(viteCommand, ["--host", "127.0.0.1", "--port", "3212"], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});

const shutdown = (code = 0) => {
  if (!syncServer.killed) {
    syncServer.kill("SIGTERM");
  }
  if (!webApp.killed) {
    webApp.kill("SIGTERM");
  }
  process.exit(code);
};

syncServer.on("exit", (code) => {
  if (code && code !== 0) {
    shutdown(code);
  }
});

webApp.on("exit", (code) => {
  shutdown(code ?? 0);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
