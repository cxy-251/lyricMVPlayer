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
const LYRICS_REVIEW_PLAYLIST_ID = "lyrics-review";
const LYRICS_REVIEW_PLAYLIST_NAME = "Lyrics Review";
const ALIGNMENT_ERROR_PLAYLIST_ID = "alignment-error";
const ALIGNMENT_ERROR_PLAYLIST_NAME = "Alignment Error";

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

const getSourceRecord = (entry) => entry?.source?.record ?? {};

const getSourceVideoId = (entry) =>
  getSourceRecord(entry)?.source_identity?.video_id ??
  entry?.source?.source_identity?.video_id ??
  null;

const getSourceUrl = (entry) =>
  getSourceRecord(entry)?.watch_url ??
  getSourceRecord(entry)?.canonical_url ??
  entry?.source_url ??
  null;

const extractVideoIdFromText = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const matches = [...value.matchAll(/(?:v=|youtu\.be\/|->\s*)([A-Za-z0-9_-]{8,})/g)];
  return matches.length > 0 ? matches.at(-1)?.[1] ?? null : null;
};

const getLyricsReview = (entry) => {
  const songDir = entry?.song_dir ? path.basename(entry.song_dir) : null;
  if (!songDir) {
    return null;
  }

  if (!entry?.ok && entry?.stage === "lyrics") {
    return {
      song_dir: songDir,
      reason: "lyrics_resolution_failed",
      detail: entry?.error?.message ?? null,
    };
  }

  const document = entry?.timed_lyrics?.document;
  const lines = Array.isArray(document?.lines) ? document.lines : [];
  if (!document || lines.length === 0) {
    return {
      song_dir: songDir,
      reason: "lyrics_missing",
      detail: null,
    };
  }

  const sourceVideoId = getSourceVideoId(entry);
  const lyricVideoId = extractVideoIdFromText(document.source_detail);
  if (
    document.source === "youtube-music" &&
    sourceVideoId &&
    lyricVideoId &&
    sourceVideoId !== lyricVideoId
  ) {
    return {
      song_dir: songDir,
      reason: "lyrics_source_video_mismatch",
      expected_video_id: sourceVideoId,
      lyric_video_id: lyricVideoId,
      detail: document.source_detail,
    };
  }

  return null;
};

const normalizeTrackIds = (trackIds) =>
  Array.from(new Set(Array.isArray(trackIds) ? trackIds.filter((trackId) => typeof trackId === "string" && trackId) : []));

const ensurePlaylist = (playlists, playlistId, playlistName, trackIdsToAdd = []) => {
  const playlistIndex = playlists.findIndex((playlist) => playlist?.id === playlistId);
  const existingTrackIds = playlistIndex >= 0 ? playlists[playlistIndex]?.trackIds : [];
  const nextTrackIds = Array.from(new Set([...normalizeTrackIds(existingTrackIds), ...trackIdsToAdd]));

  if (playlistIndex >= 0) {
    return playlists.map((playlist, index) =>
      index === playlistIndex
        ? {
            ...playlist,
            name: playlistName,
            trackIds: nextTrackIds,
          }
        : playlist
    );
  }

  return [
    ...playlists,
    {
      id: playlistId,
      name: playlistName,
      trackIds: nextTrackIds,
    },
  ];
};

try {
  if (fs.existsSync(playlistPipelineResultPath)) {
    const pipelineResult = JSON.parse(fs.readFileSync(playlistPipelineResultPath, "utf-8"));
    const downloaded = Array.isArray(pipelineResult.results)
      ? pipelineResult.results
      .map((entry) => {
        const lyricsReview = getLyricsReview(entry);
        return {
          video_id: getSourceVideoId(entry),
          source_url: getSourceUrl(entry),
          song_dir: entry?.song_dir ? path.basename(entry.song_dir) : null,
          ok: Boolean(entry?.ok),
          lyrics_review: lyricsReview,
        };
      })
      .filter((entry) => entry.video_id || entry.song_dir)
      : [];
    const lyricsReviewItems = downloaded.map((entry) => entry.lyrics_review).filter(Boolean);

    fs.writeFileSync(
      recentDownloadsPath,
      JSON.stringify(
        {
          playlist_url: playlistUrl,
          generated_at: new Date().toISOString(),
          count: downloaded.length,
          lyrics_review_count: lyricsReviewItems.length,
          items: downloaded,
          lyrics_review_items: lyricsReviewItems,
        },
        null,
        2
      ) + "\n",
      "utf-8"
    );

    const libraryState = fs.existsSync(libraryStatePath)
      ? JSON.parse(fs.readFileSync(libraryStatePath, "utf-8"))
      : {
          nickname: "CleanKsen",
          selectedPlaylistId: NEW_DOWNLOADS_PLAYLIST_ID,
          likedTrackIds: [],
          customPlaylists: [],
        };
    const customPlaylists = Array.isArray(libraryState.customPlaylists) ? libraryState.customPlaylists : [];
    const newSongDirs = downloaded.map((entry) => entry.song_dir).filter(Boolean);
    const lyricsReviewSongDirs = lyricsReviewItems.map((entry) => entry.song_dir).filter(Boolean);
    let updatedPlaylists = ensurePlaylist(customPlaylists, NEW_DOWNLOADS_PLAYLIST_ID, NEW_DOWNLOADS_PLAYLIST_NAME, newSongDirs);
    updatedPlaylists = ensurePlaylist(updatedPlaylists, LYRICS_REVIEW_PLAYLIST_ID, LYRICS_REVIEW_PLAYLIST_NAME, lyricsReviewSongDirs);
    updatedPlaylists = ensurePlaylist(updatedPlaylists, ALIGNMENT_ERROR_PLAYLIST_ID, ALIGNMENT_ERROR_PLAYLIST_NAME, []);

    fs.writeFileSync(
      libraryStatePath,
      JSON.stringify(
        {
          ...libraryState,
          selectedPlaylistId: libraryState.selectedPlaylistId ?? NEW_DOWNLOADS_PLAYLIST_ID,
          customPlaylists: updatedPlaylists,
        },
        null,
        2
      ) + "\n",
      "utf-8"
    );
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
