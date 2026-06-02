import path from "node:path";
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

const workspaceRoot = path.resolve(__dirname, "../..");
const artifactRoot = path.resolve(
  process.env.PAPER_VIDEO_ARTIFACT_ROOT ??
    path.join(workspaceRoot, "..", "..", "artifacts", "paper-video", "output"),
);

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  define: {
    __WORKSPACE_ROOT__: JSON.stringify(workspaceRoot),
    __LATEST_RUN_FILE__: JSON.stringify(path.resolve(artifactRoot, "latest-run.json")),
    __DEFAULT_PRODUCTION_MANIFEST__: JSON.stringify(
      path.resolve(workspaceRoot, "data/manifests/demo-paper.json"),
    ),
    __DEFAULT_RENDER_MANIFEST__: JSON.stringify(
      path.resolve(workspaceRoot, "data/manifests/demo-paper.render.json"),
    ),
    __CONTENT_PROFILE_REGISTRY__: JSON.stringify(
      path.resolve(workspaceRoot, "data/content-profiles/index.json"),
    ),
  },
  server: {
    port: 3100,
    fs: {
      allow: [workspaceRoot],
    },
  },
  resolve: {
    alias: {
      "@paper-to-video/shared-types": path.resolve(__dirname, "../../packages/shared-types/src/index.ts"),
      "@paper-to-video/content-pipeline": path.resolve(
        __dirname,
        "../../packages/content-pipeline/src/index.ts",
      ),
      "@paper-to-video/atomic-ui": path.resolve(__dirname, "../../packages/atomic-ui/src/index.tsx"),
      "@paper-to-video/timeline-engine": path.resolve(
        __dirname,
        "../../packages/timeline-engine/src/index.tsx",
      ),
    },
  },
});
