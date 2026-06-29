import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import glsl from "vite-plugin-glsl";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const paperWorkspaceRoot = path.join(repoRoot, "packages", "paper-video");
const paperArtifactRoot = path.join(repoRoot, "artifacts", "paper-video", "output");

export default defineConfig({
  plugins: [react(), glsl()],
  publicDir: "public-web",
  resolve: {
    dedupe: ["react", "react-dom", "react-router"],
    alias: {
      "@paper-to-video/ui": path.join(repoRoot, "packages/paper-video/ui/index.ts"),
      "@paper-to-video/components": path.join(repoRoot, "packages/paper-video/index.ts"),
      "@paper-to-video/content-pipeline": path.join(repoRoot, "packages/paper-video/content-pipeline/index.ts"),
      "@paper-to-video/shared-types": path.join(repoRoot, "packages/paper-video/shared-types/index.ts"),
      "@lyric-mv/lyric-video": path.join(repoRoot, "packages/lyric-video/index.ts"),
      "@lyric-mv/web3dlab/runtime": path.join(repoRoot, "packages/web3dlab/runtime.ts"),
      "@lyric-mv/web3dlab": path.join(repoRoot, "packages/web3dlab/index.ts")
    }
  },
  define: {
    __PROJECT_ROOT__: JSON.stringify(repoRoot),
    __WORKSPACE_ROOT__: JSON.stringify(repoRoot),
    __LATEST_RUN_FILE__: JSON.stringify(path.join(paperArtifactRoot, "latest-run.json")),
    __DEFAULT_PRODUCTION_MANIFEST__: JSON.stringify(
      path.join(repoRoot, "artifacts", "paper-video", "manifests", "demo-paper.json"),
    ),
    __DEFAULT_RENDER_MANIFEST__: JSON.stringify(
      path.join(repoRoot, "artifacts", "paper-video", "manifests", "demo-paper.render.json"),
    ),
    __CONTENT_PROFILE_REGISTRY__: JSON.stringify(
      path.join(repoRoot, "artifacts", "paper-video", "content-profiles", "index.json"),
    ),
  },
  server: {
    host: "127.0.0.1",
    port: 3212,
    watch: {
      ignored: ["**/artifacts/**", "**/backend/**", "**/.conda/**"]
    },
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
