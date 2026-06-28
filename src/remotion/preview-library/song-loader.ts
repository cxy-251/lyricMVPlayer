import type {SongLibraryItem} from "@lyric-mv/lyric-video";

import manifestJson from "../preview-library-manifest.json";
import {previewAssetMap} from "../preview-asset-map";
import {createSongFromRenderInput} from "./song-adapter";
import type {PreviewLibraryManifest} from "./types";

const manifest = manifestJson as PreviewLibraryManifest;
const seedById = new Map(manifest.songs.map((song) => [song.id, song]));
const songCache = new Map<string, Promise<SongLibraryItem | null>>();

export const loadPreviewSong = (songId: string): Promise<SongLibraryItem | null> => {
  const cached = songCache.get(songId);
  if (cached) {
    return cached;
  }

  const assets = previewAssetMap[songId];
  if (!assets) {
    return Promise.resolve(null);
  }

  const promise = Promise.all([assets.loadRenderInput(), assets.loadAudioFeatures()])
    .then(([renderInput, audioFeatures]) =>
      createSongFromRenderInput({
        id: songId,
        renderInput,
        audioFeatures,
        assets,
        seed: seedById.get(songId),
      })
    )
    .catch(() => null);

  songCache.set(songId, promise);
  return promise;
};
