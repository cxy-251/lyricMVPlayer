import path from "node:path";

export const createPreviewLibraryPaths = (projectRoot) => {
  const artifactsRoot = path.join(projectRoot, "artifacts");
  const commonRoot = path.join(artifactsRoot, "common");
  const remotionRoot = path.join(projectRoot, "src", "remotion");

  return {
    artifactsRoot,
    commonRoot,
    songsRoot: path.join(artifactsRoot, "songs"),
    queueCsvPath: path.join(commonRoot, "production-queue.csv"),
    libraryStatePath: path.join(commonRoot, "library-state.json"),
    currentSongConfigPath: path.join(remotionRoot, "current-song.json"),
    previewManifestPath: path.join(remotionRoot, "preview-library-manifest.json"),
    previewAssetMapPath: path.join(remotionRoot, "preview-asset-map.ts"),
  };
};
