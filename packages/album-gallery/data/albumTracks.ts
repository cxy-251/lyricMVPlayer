import type {AlbumGalleryTrack, PublicLibraryManifest, PublicRenderInput} from "../types";

const palette = [
  "#83b7ff",
  "#ff8fb3",
  "#e8c86f",
  "#8fd8c2",
  "#c5a7ff",
  "#ff9f6e",
  "#9bd7ff",
  "#ffd1e5",
  "#b7ef8a",
  "#d5d9ff",
];

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load album gallery data: ${response.status} ${url}`);
  }
  return (await response.json()) as T;
};

const fallbackTitleFromId = (id: string) => {
  const parts = id.split(" - ");
  if (parts.length >= 3) {
    return {
      title: parts.slice(0, -2).join(" - "),
      artist: parts[parts.length - 2],
    };
  }
  return {title: id, artist: "Unknown Artist"};
};

export const createAlbumTrack = ({
  id,
  index,
  renderInput,
  title,
  artist,
}: {
  id: string;
  index: number;
  renderInput: PublicRenderInput;
  title?: string;
  artist?: string;
}): AlbumGalleryTrack => {
  const parsed = fallbackTitleFromId(id);
  const fps = renderInput.fps ?? 30;
  return {
    id,
    title: renderInput.title || title || parsed.title,
    artist: renderInput.artist || artist || parsed.artist,
    audioSrc: renderInput.audioSrc || `/songs/${encodeURIComponent(id)}/audio.mp3`,
    coverSrc: renderInput.background?.src,
    durationInFrames: Math.max(1, renderInput.durationInFrames ?? Math.round(fps * 30)),
    fps,
    themeColor: palette[index % palette.length],
  };
};

export const loadAlbumTracksFromPublicManifest = async (): Promise<{
  currentSongDirName: string;
  tracks: AlbumGalleryTrack[];
}> => {
  let manifest: PublicLibraryManifest;
  try {
    manifest = await fetchJson<PublicLibraryManifest>("/library-manifest.json");
  } catch (err: any) {
    throw new Error(`Failed to fetch /library-manifest.json: ${err?.message || err}`);
  }

  let gallerySongs = manifest.songs;
  const demoPlaylist = manifest.customPlaylists?.find(p => p.id === "demo");
  if (demoPlaylist) {
    if (demoPlaylist.trackIds === "__ALL__") {
      gallerySongs = manifest.songs;
    } else if (Array.isArray(demoPlaylist.trackIds)) {
      const demoSet = new Set(demoPlaylist.trackIds);
      gallerySongs = manifest.songs.filter(s => demoSet.has(s.id));
    }
  } else {
    // Fallback to first 10 if no demo playlist is found
    gallerySongs = manifest.songs.slice(0, 10);
  }

  // Fetch all, but catch errors and return null for failed ones
  const renderInputsOrNull = await Promise.all(
    gallerySongs.map(async (song) => {
      try {
        return await fetchJson<PublicRenderInput>(song.renderInputUrl);
      } catch (err: any) {
        console.error(`Failed to fetch ${song.renderInputUrl}: ${err?.message || err}`);
        return null; // Return null instead of throwing to avoid crashing the whole gallery
      }
    })
  );

  const tracks: AlbumGalleryTrack[] = [];
  gallerySongs.forEach((song, index) => {
    const renderInput = renderInputsOrNull[index];
    if (renderInput) {
      try {
        tracks.push(
          createAlbumTrack({
            id: song.id,
            index: tracks.length,
            title: song.title,
            artist: song.artist,
            renderInput,
          })
        );
      } catch (err) {
        console.error("Failed to create track for", song.id, err);
      }
    }
  });

  return {currentSongDirName: manifest.currentSongDirName, tracks};
};
