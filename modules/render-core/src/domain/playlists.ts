import type {PlaylistSummary} from "../types";

export type RepeatMode = "none" | "one" | "list";

export type StoredLibraryState = {
  likedTrackIds: string[];
  customPlaylists: Array<{id: string; name: string; trackIds: string[]}>;
  selectedPlaylistId: string | null;
};

export const STORAGE_KEY = "lyricMVPlayer.libraryState.v1";
export const LIBRARY_STATE_SYNC_URL = "http://127.0.0.1:3210/api/library-state";
export const ALL_TRACKS_SENTINEL = "__ALL__";

export const DEFAULT_CUSTOM_PLAYLISTS = [
  {id: "new-downloads", name: "New Downloads", trackIds: [] as string[]},
  {id: "lyrics-review", name: "Lyrics Review", trackIds: [] as string[]},
  {id: "alignment-error", name: "Alignment Error", trackIds: [] as string[]},
];

export const normalizeTrackIds = (trackIds: unknown, libraryIds: string[]): string[] => {
  if (trackIds === ALL_TRACKS_SENTINEL) {
    return libraryIds;
  }

  if (!Array.isArray(trackIds)) {
    return [];
  }

  return Array.from(
    new Set(trackIds.filter((trackId): trackId is string => typeof trackId === "string" && trackId.length > 0))
  );
};

export const buildCustomPlaylists = (
  basePlaylists: Array<{id: string; name: string; trackIds: string[]}>,
  libraryIds: string[],
  persistedPlaylists: unknown
): Array<{id: string; name: string; trackIds: string[]}> => {
  const baseMap = new Map(basePlaylists.map((playlist) => [playlist.id, playlist]));
  const persistedList = Array.isArray(persistedPlaylists)
    ? persistedPlaylists.filter(
        (playlist): playlist is {id: string; name: string; trackIds: string[] | "__ALL__"} =>
          Boolean(playlist && typeof playlist === "object" && "id" in playlist && "name" in playlist)
      )
    : [];

  const mergedIds = Array.from(
    new Set([...basePlaylists.map((playlist) => playlist.id), ...persistedList.map((playlist) => playlist.id)])
  );

  return mergedIds.map((playlistId) => {
    const base = baseMap.get(playlistId);
    const persisted = persistedList.find((playlist) => playlist.id === playlistId);
    const baseTrackIds = normalizeTrackIds(base?.trackIds ?? [], libraryIds);
    const persistedTrackIds =
      persisted && "trackIds" in persisted ? normalizeTrackIds(persisted.trackIds, libraryIds) : [];
    const libraryIdSet = new Set(libraryIds);
    const protectedBaseTrackIds = baseTrackIds.filter((trackId) => !libraryIdSet.has(trackId));
    return {
      id: playlistId,
      name: persisted?.name ?? base?.name ?? playlistId,
      trackIds: persisted
        ? Array.from(new Set([...protectedBaseTrackIds, ...persistedTrackIds]))
        : baseTrackIds,
    };
  });
};

export const createInitialCustomPlaylists = (
  playlists: PlaylistSummary[] | undefined
): Array<{id: string; name: string; trackIds: string[]}> => {
  const defaults = (playlists ?? []).filter((playlist) => playlist.id !== "liked");
  if (defaults.length > 0) {
    return defaults.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      trackIds: playlist.trackIds ?? [],
    }));
  }

  return DEFAULT_CUSTOM_PLAYLISTS.map((playlist) => ({
    ...playlist,
    trackIds: [...playlist.trackIds],
  }));
};
