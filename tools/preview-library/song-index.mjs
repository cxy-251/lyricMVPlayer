import fs from "node:fs";
import path from "node:path";

import {parseCsv} from "./csv.mjs";
import {createPreviewLibraryPaths} from "./paths.mjs";

const supportedBackgrounds = ["background.png", "background.jpg", "background.jpeg", "background.webp"];

const readJsonIfExists = (filePath, fallback = null) => {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};

const assertRequiredSongFile = (songDirPath, fileName) => {
  const filePath = path.join(songDirPath, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${fileName} in ${songDirPath}`);
  }
  return filePath;
};

const buildSongIndexEntry = ({songDirName, songsRoot, index}) => {
  const songDirPath = path.join(songsRoot, songDirName);
  const renderInputPath = path.join(songDirPath, "render-input.json");
  const audioFeaturesPath = assertRequiredSongFile(songDirPath, "audio-features.json");
  assertRequiredSongFile(songDirPath, "audio.mp3");

  const renderInput = readJsonIfExists(renderInputPath);
  const audioFeatures = readJsonIfExists(audioFeaturesPath, {});
  const source = readJsonIfExists(path.join(songDirPath, "source.json"), {});
  const fps = renderInput?.fps ?? audioFeatures.frameRate ?? 60;
  const durationMs = audioFeatures.durationMs ?? (Number(source.duration) || 0) * 1000;
  const durationInFrames = renderInput?.durationInFrames ?? Math.max(1, Math.ceil((durationMs / 1000) * fps));
  const backgroundFileName = supportedBackgrounds.find((candidate) =>
    fs.existsSync(path.join(songDirPath, candidate))
  );

  return {
    asset: {
      id: songDirName,
      index,
      backgroundFileName,
      hasRenderInput: fs.existsSync(renderInputPath),
    },
    song: {
      id: songDirName,
      title: renderInput?.title ?? source.title ?? songDirName,
      artist: renderInput?.artist ?? source.channel ?? source.uploader ?? "Unknown Artist",
      lyricOffsetMs: renderInput?.lyricOffsetMs ?? 0,
      renderTrimStartMs: renderInput?.renderTrimStartMs ?? 0,
      renderDurationInFrames: renderInput?.renderDurationInFrames ?? durationInFrames,
      durationInFrames,
      fps,
    },
  };
};

export const buildPreviewLibrary = ({projectRoot, selectedSongDirName, renderOnly}) => {
  const {songsRoot, queueCsvPath, libraryStatePath} = createPreviewLibraryPaths(projectRoot);

  const queueRows = fs.existsSync(queueCsvPath)
    ? parseCsv(fs.readFileSync(queueCsvPath, "utf-8")).filter((row) => row.song_dir)
    : [];
  const libraryState = readJsonIfExists(libraryStatePath);

  const songDirNames = Array.from(
    new Set([
      selectedSongDirName,
      ...(renderOnly ? [] : queueRows.map((row) => row.song_dir).filter(Boolean)),
    ])
  ).filter((songDirName) => {
    const songDirPath = path.join(songsRoot, songDirName);
    return fs.existsSync(songDirPath) && fs.statSync(songDirPath).isDirectory();
  });

  const entries = songDirNames.map((songDirName, index) =>
    buildSongIndexEntry({songDirName, songsRoot, index})
  );

  const queue = entries.map((entry) => ({
    id: entry.song.id,
    title: entry.song.title,
    artist: entry.song.artist,
    accent: "rgba(163, 206, 255, 0.7)",
  }));

  const playlists = renderOnly
    ? []
    : [
        {
          id: "liked",
          name: "Liked Songs",
          count: Array.isArray(libraryState?.likedTrackIds) ? libraryState.likedTrackIds.length : 0,
          accent: "rgba(255, 196, 170, 0.78)",
        },
        ...((Array.isArray(libraryState?.customPlaylists) ? libraryState.customPlaylists : []).map((playlist) => {
          const trackIds =
            playlist.trackIds === "__ALL__"
              ? queue.map((track) => track.id)
              : Array.isArray(playlist.trackIds)
                ? playlist.trackIds
                : [];

          return {
            id: playlist.id,
            name: playlist.name,
            count: trackIds.length,
            accent: "rgba(255,255,255,0.58)",
            trackIds,
          };
        }))
      ];

  return {
    manifest: {
      selectedSongDirName,
      songs: entries.map((entry) => entry.song),
      queue,
      playlists,
    },
    assets: entries.map((entry) => entry.asset),
  };
};
