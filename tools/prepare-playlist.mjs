import {spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const playlistUrl = process.argv[2];
const defaultRenderBatch = process.argv[3] ?? "0";
const recentDownloadsPath = path.join(projectRoot, "artifacts", "common", "recent-downloads.json");
const playlistPipelineResultPath = path.join(projectRoot, "artifacts", "common", "playlist-pipeline.json");
const libraryStatePath = path.join(projectRoot, "artifacts", "common", "library-state.json");
const NEW_DOWNLOADS_PLAYLIST_ID = "new-downloads";
const NEW_DOWNLOADS_PLAYLIST_NAME = "New Downloads";

if (!playlistUrl) {
  throw new Error('Usage: npm run prepare:playlist -- "<playlist-url>" [default-render-batch]');
}

const scriptPath = path.join(projectRoot, "modules", "playlist-pipeline", "playlist_pipeline.py");
const result = spawnSync(
  "conda",
  ["run", "-n", "kwai", "python", scriptPath, playlistUrl, projectRoot, defaultRenderBatch],
  {
    cwd: projectRoot,
    stdio: "inherit",
  }
);

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

try {
  if (fs.existsSync(playlistPipelineResultPath)) {
    const pipelineResult = JSON.parse(fs.readFileSync(playlistPipelineResultPath, "utf-8"));
    const downloaded = Array.isArray(pipelineResult.results)
      ? pipelineResult.results
      .map((entry) => {
        const source = entry?.source ?? {};
        return {
          video_id: source.video_id ?? null,
          source_url: source.watch_url ?? entry?.source_url ?? null,
          song_dir: entry?.song_dir ? path.basename(entry.song_dir) : null,
          ok: Boolean(entry?.ok),
        };
      })
      .filter((entry) => entry.video_id || entry.song_dir)
      : [];

    fs.writeFileSync(
      recentDownloadsPath,
      JSON.stringify(
        {
          playlist_url: playlistUrl,
          generated_at: new Date().toISOString(),
          count: downloaded.length,
          items: downloaded,
        },
        null,
        2
      ) + "\n",
      "utf-8"
    );

    if (fs.existsSync(libraryStatePath)) {
      const libraryState = JSON.parse(fs.readFileSync(libraryStatePath, "utf-8"));
      const customPlaylists = Array.isArray(libraryState.customPlaylists) ? libraryState.customPlaylists : [];
      const newSongDirs = downloaded.map((entry) => entry.song_dir).filter(Boolean);

      const updatedPlaylists = (() => {
        const playlistIndex = customPlaylists.findIndex((playlist) => playlist?.id === NEW_DOWNLOADS_PLAYLIST_ID);
        const nextTrackIds = Array.from(
          new Set([
            ...(playlistIndex >= 0 && Array.isArray(customPlaylists[playlistIndex]?.trackIds)
              ? customPlaylists[playlistIndex].trackIds
              : []),
            ...newSongDirs,
          ])
        );

        if (playlistIndex >= 0) {
          return customPlaylists.map((playlist, index) =>
            index === playlistIndex
              ? {
                  ...playlist,
                  name: NEW_DOWNLOADS_PLAYLIST_NAME,
                  trackIds: nextTrackIds,
                }
              : playlist
          );
        }

        return [
          ...customPlaylists,
          {
            id: NEW_DOWNLOADS_PLAYLIST_ID,
            name: NEW_DOWNLOADS_PLAYLIST_NAME,
            trackIds: nextTrackIds,
          },
        ];
      })();

      fs.writeFileSync(
        libraryStatePath,
        JSON.stringify(
          {
            ...libraryState,
            customPlaylists: updatedPlaylists,
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
    }
  }
} catch {
  // ignore recent-downloads write failure; main pipeline already succeeded
}

const currentSongConfigPath = path.join(projectRoot, "src", "remotion", "current-song.json");
if (fs.existsSync(currentSongConfigPath)) {
  const currentSongConfig = JSON.parse(fs.readFileSync(currentSongConfigPath, "utf-8"));
  const songDirName = currentSongConfig.songDirName;
  if (songDirName) {
    const refreshResult = spawnSync("node", ["tools/select-song-for-preview.mjs", songDirName], {
      cwd: projectRoot,
      stdio: "inherit",
    });
    if ((refreshResult.status ?? 1) !== 0) {
      process.exit(refreshResult.status ?? 1);
    }
  }
}

process.exit(0);
