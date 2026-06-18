import fs from "node:fs";
import path from "node:path";

import {parseCsv} from "./preview-library/csv.mjs";

const projectRoot = process.cwd();
const songsRoot = path.join(projectRoot, "artifacts", "songs");
const trashRoot = path.join(projectRoot, "artifacts", "songsout", "trash");
const queuePath = path.join(projectRoot, "artifacts", "common", "production-queue.csv");
const apply = process.argv.includes("--apply");

if (!fs.existsSync(queuePath)) {
  throw new Error(`Missing production queue: ${queuePath}`);
}

const publishedSongIds = new Set(
  parseCsv(fs.readFileSync(queuePath, "utf8"))
    .filter((row) => row.video_status === "published" && row.song_dir)
    .map((row) => row.song_dir)
);
const candidates = [];

for (const songId of publishedSongIds) {
  const songRoot = path.join(songsRoot, songId);
  if (!fs.existsSync(path.join(songRoot, "render-input.json"))) {
    continue;
  }
  for (const fileName of ["vocals.wav", "no_vocals.wav"]) {
    const filePath = path.join(songRoot, "separated", fileName);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      candidates.push(filePath);
    }
  }
}

const collectFiles = (rootPath) => {
  if (!fs.existsSync(rootPath)) return [];
  const files = [];
  for (const entry of fs.readdirSync(rootPath, {withFileTypes: true})) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
};

candidates.push(...collectFiles(trashRoot));

const uniqueCandidates = Array.from(new Set(candidates));
const totalBytes = uniqueCandidates.reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0);

for (const filePath of uniqueCandidates) {
  process.stdout.write(`${apply ? "[delete]" : "[dry-run]"} ${path.relative(projectRoot, filePath)}\n`);
  if (apply) {
    fs.rmSync(filePath, {force: true});
  }
}

if (apply) {
  const removeEmptyDirectories = (rootPath) => {
    if (!fs.existsSync(rootPath)) return;
    for (const entry of fs.readdirSync(rootPath, {withFileTypes: true})) {
      if (entry.isDirectory()) removeEmptyDirectories(path.join(rootPath, entry.name));
    }
    if (rootPath !== songsRoot && fs.existsSync(rootPath) && fs.readdirSync(rootPath).length === 0) {
      fs.rmdirSync(rootPath);
    }
  };
  for (const songId of publishedSongIds) {
    removeEmptyDirectories(path.join(songsRoot, songId, "separated"));
  }
  removeEmptyDirectories(trashRoot);
}

process.stdout.write(
  `${apply ? "Deleted" : "Would delete"} ${uniqueCandidates.length} files (${(totalBytes / 1024 / 1024).toFixed(1)} MiB).\n`
);
if (!apply) {
  process.stdout.write("Dry run only. Re-run with --apply to delete these files.\n");
}
