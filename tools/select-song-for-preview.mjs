import fs from "node:fs";
import path from "node:path";

import {generatePreviewAssetMapSource} from "./preview-library/codegen.mjs";
import {createPreviewLibraryPaths} from "./preview-library/paths.mjs";
import {buildPreviewLibrary} from "./preview-library/song-index.mjs";

const projectRoot = process.cwd();
const {currentSongConfigPath, previewAssetMapPath, previewManifestPath, songsRoot} =
  createPreviewLibraryPaths(projectRoot);

const args = process.argv.slice(2);
const renderOnly = args.includes("--render-only");
const requested = args.filter((arg) => arg !== "--render-only").join(" ").trim();

if (!requested) {
  throw new Error('Usage: node tools/select-song-for-preview.mjs [--render-only] "<song-folder-name>"');
}

const selectedSongDirPath = path.resolve(path.isAbsolute(requested) ? requested : path.join(songsRoot, requested));

if (!fs.existsSync(selectedSongDirPath) || !fs.statSync(selectedSongDirPath).isDirectory()) {
  throw new Error(`Song directory not found: ${selectedSongDirPath}`);
}

const selectedSongDirName = path.basename(selectedSongDirPath);
const previewLibrary = buildPreviewLibrary({
  projectRoot,
  selectedSongDirName,
  renderOnly,
});

fs.writeFileSync(
  currentSongConfigPath,
  `${JSON.stringify({songDirName: selectedSongDirName}, null, 2)}\n`,
  "utf-8"
);
fs.writeFileSync(previewManifestPath, `${JSON.stringify(previewLibrary.manifest, null, 2)}\n`, "utf-8");
fs.writeFileSync(
  previewAssetMapPath,
  generatePreviewAssetMapSource({
    assets: previewLibrary.assets,
    selectedSongDirName,
  }),
  "utf-8"
);

console.log(selectedSongDirName);
