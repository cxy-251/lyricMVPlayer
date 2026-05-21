import {spawn} from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const syncServerPath = path.join(projectRoot, "tools", "library-state-sync-server.mjs");
const startedAt = Date.now();
let remotionHandledAsExisting = false;

const syncServer = spawn(process.execPath, [syncServerPath], {
  cwd: projectRoot,
  stdio: "inherit",
});

const remotion = spawn("npx", ["remotion", "studio", "src/remotion/Root.tsx"], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});

const shutdown = (code = 0) => {
  if (!syncServer.killed) {
    syncServer.kill("SIGTERM");
  }
  if (!remotion.killed) {
    remotion.kill("SIGTERM");
  }
  process.exit(code);
};

syncServer.on("exit", (code) => {
  if (code && code !== 0) {
    shutdown(code);
  }
});

remotion.on("exit", (code) => {
  const livedMs = Date.now() - startedAt;
  if ((code ?? 0) === 0 && livedMs < 10_000) {
    remotionHandledAsExisting = true;
    process.stdout.write("[dev-with-sync] Remotion is already running on port 3000; keeping library-state sync server alive.\n");
    return;
  }

  shutdown(code ?? 0);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (remotionHandledAsExisting) {
  process.stdin.resume();
}
