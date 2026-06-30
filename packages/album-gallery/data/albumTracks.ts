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
  const manifest = await fetchJson<PublicLibraryManifest>("/library-manifest.json");
  const renderInputs = await Promise.all(
    manifest.songs.map((song) => fetchJson<PublicRenderInput>(song.renderInputUrl)),
  );
  const tracks = manifest.songs.map((song, index) =>
    createAlbumTrack({
      id: song.id,
      index,
      title: song.title,
      artist: song.artist,
      renderInput: renderInputs[index],
    }),
  );
  return {currentSongDirName: manifest.currentSongDirName, tracks};
};
