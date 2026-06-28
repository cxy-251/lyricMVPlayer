import type {LyricVideoCompositionProps, SongLibraryItem} from "@lyric-mv/lyric-video";

import type {PreviewAssetMap, PreviewLibraryManifest, SelectedPreviewSongData} from "./types";
import {createSeedSong, createSongFromRenderInput, songToCompositionProps} from "./song-adapter";

export const buildPreviewCompositionProps = ({
  manifest,
  assets,
  selectedSongData,
}: {
  manifest: PreviewLibraryManifest;
  assets: PreviewAssetMap;
  selectedSongData: SelectedPreviewSongData;
}): LyricVideoCompositionProps => {
  const selectedSongId = selectedSongData.id || manifest.selectedSongDirName;
  const library: SongLibraryItem[] = manifest.songs
    .map((song) => {
      const songAssets = assets[song.id];
      if (!songAssets) {
        return null;
      }

      if (song.id === selectedSongId) {
        return createSongFromRenderInput({
          id: song.id,
          renderInput: selectedSongData.renderInput,
          audioFeatures: selectedSongData.audioFeatures,
          assets: songAssets,
          seed: song,
        });
      }

      return createSeedSong(song, songAssets);
    })
    .filter((song): song is SongLibraryItem => Boolean(song));

  if (library.length === 0) {
    throw new Error("Preview library is empty");
  }

  const initialSong = library.find((song) => song.id === selectedSongId) ?? library[0];

  return songToCompositionProps(initialSong, library, {
    initialTrackId: initialSong.id,
    queue: manifest.queue,
    playlists: manifest.playlists,
  });
};
