import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const paperWorkspaceRoot = path.join(repoRoot, "modules", "paper-video");
const paperArtifactRoot = path.join(repoRoot, "artifacts", "paper-video", "output");

export default defineConfig({
  plugins: [react()],
  publicDir: "public-web",
  define: {
    __PROJECT_ROOT__: JSON.stringify(repoRoot),
    __WORKSPACE_ROOT__: JSON.stringify(paperWorkspaceRoot),
    __LATEST_RUN_FILE__: JSON.stringify(path.join(paperArtifactRoot, "latest-run.json")),
    __DEFAULT_PRODUCTION_MANIFEST__: JSON.stringify(
      path.join(paperWorkspaceRoot, "data", "manifests", "demo-paper.json"),
    ),
    __DEFAULT_RENDER_MANIFEST__: JSON.stringify(
      path.join(paperWorkspaceRoot, "data", "manifests", "demo-paper.render.json"),
    ),
    __CONTENT_PROFILE_REGISTRY__: JSON.stringify(
      path.join(paperWorkspaceRoot, "data", "content-profiles", "index.json"),
    ),
  },
  server: {
    host: "127.0.0.1",
    port: 3212,
    fs: {
      allow: [repoRoot],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 3212
  },
  build: {
    outDir: "dist"
  }
});
