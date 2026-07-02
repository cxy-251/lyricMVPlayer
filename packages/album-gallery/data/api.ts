// @ts-ignore
const PROJECT_ROOT = __PROJECT_ROOT__;

export interface LibraryAlbum {
  id: string;
  artist: string;
  album: string;
  representativeCover: string;
  trackCount: number;
}

export interface LibraryIndex {
  albums: LibraryAlbum[];
}

export interface AlbumManifestTrack {
  filename: string;
  title: string;
  duration: number;
  cover: string | null;
}

export interface AlbumManifest {
  artist: string;
  album: string;
  representativeCover: string | null;
  tracks: AlbumManifestTrack[];
}

export async function fetchLibraryIndex(): Promise<LibraryIndex> {
  try {
    const res = await fetch(`/@fs${PROJECT_ROOT}/artifacts/album/library_index.json`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Local library_index.json not found, falling back to demo index.");
  }
  
  // Fallback to demo index for github repo consumers
  const res = await fetch(`/@fs${PROJECT_ROOT}/artifacts/album/library_index.demo.json`);
  if (!res.ok) throw new Error("Failed to fetch library index");
  return res.json();
}

export async function fetchAlbumManifest(albumId: string): Promise<AlbumManifest> {
  const res = await fetch(`/@fs${PROJECT_ROOT}/artifacts/album/${encodeURIComponent(albumId)}/album_manifest.json`);
  if (!res.ok) throw new Error("Failed to fetch album manifest");
  return res.json();
}

export function getAlbumCoverUrl(albumId: string, coverName: string): string {
  return `/@fs${PROJECT_ROOT}/artifacts/album/${encodeURIComponent(albumId)}/${encodeURIComponent(coverName)}`;
}

export function getTrackAudioUrl(albumId: string, trackFilename: string): string {
  return `/@fs${PROJECT_ROOT}/artifacts/album/${encodeURIComponent(albumId)}/${encodeURIComponent(trackFilename)}`;
}
