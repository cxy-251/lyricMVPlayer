import {useEffect, useMemo, useState} from "react";

import {
  ALL_TRACKS_SENTINEL,
  LIBRARY_STATE_SYNC_URL,
  STORAGE_KEY,
  buildCustomPlaylists,
  createInitialCustomPlaylists,
  type StoredLibraryState,
} from "../domain/playlists";
import {createSingleSongLibraryItem, DEFAULT_NICKNAME} from "../domain/songs";
import type {
  LyricVideoCompositionProps,
  PlaylistSummary,
  QueueTrack,
  SongLibraryItem,
} from "../types";

type UseSongLibraryOptions = {
  props: LyricVideoCompositionProps;
  isInteractiveAudio: boolean;
};

export const useSongLibrary = ({props, isInteractiveAudio}: UseSongLibraryOptions) => {
  const initialLibrary = useMemo<SongLibraryItem[]>(() => {
    if (props.library && props.library.length > 0) {
      return props.library;
    }

    return [createSingleSongLibraryItem(props)];
  }, [
    props.artist,
    props.audioFeatures,
    props.audioSrc,
    props.background,
    props.durationInFrames,
    props.fps,
    props.library,
    props.lyricOffsetMs,
    props.lyrics,
    props.poetryFrame,
    props.renderDurationInFrames,
    props.renderTrimStartMs,
    props.title,
  ]);

  const initialTrackIndex = useMemo(() => {
    if (!props.initialTrackId) {
      return 0;
    }
    const foundIndex = initialLibrary.findIndex((item) => item.id === props.initialTrackId);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [initialLibrary, props.initialTrackId]);

  const initialCustomPlaylists = useMemo(
    () => createInitialCustomPlaylists(props.playlists),
    [props.playlists]
  );

  const canSyncLibraryState =
    isInteractiveAudio && (props.playlists?.length ?? 0) > 0 && (props.queue?.length ?? initialLibrary.length) > 1;

  const initialStoredState = useMemo<StoredLibraryState>(() => {
    if (!canSyncLibraryState) {
      return {
        likedTrackIds: [],
        customPlaylists: initialCustomPlaylists,
        selectedPlaylistId: "all",
      };
    }

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<StoredLibraryState>;
          const playlistSeedMap = new Map(initialCustomPlaylists.map((playlist) => [playlist.id, playlist]));
          const storedTrackMap = new Map(
            Array.isArray(parsed.customPlaylists)
              ? parsed.customPlaylists
                  .filter((playlist): playlist is {id: string; name: string; trackIds: string[]} =>
                    Boolean(playlist && playlist.id && Array.isArray(playlist.trackIds))
                  )
                  .map((playlist) => [playlist.id, playlist.trackIds])
              : []
          );

          return {
            likedTrackIds: Array.isArray(parsed.likedTrackIds) ? parsed.likedTrackIds : [],
            customPlaylists: initialCustomPlaylists.map((playlist) => {
              const storedTrackIds = storedTrackMap.get(playlist.id);
              return {
                id: playlist.id,
                name: playlist.name,
                trackIds: (storedTrackIds ?? playlist.trackIds).filter((trackId) =>
                  initialLibrary.some((item) => item.id === trackId)
                ),
              };
            }),
            selectedPlaylistId:
              typeof parsed.selectedPlaylistId === "string" &&
              (parsed.selectedPlaylistId === "all" ||
                parsed.selectedPlaylistId === "liked" ||
                playlistSeedMap.has(parsed.selectedPlaylistId))
                ? parsed.selectedPlaylistId
                : null,
          };
        }
      } catch {
        // ignore malformed local state and fall back to defaults
      }
    }

    return {
      likedTrackIds: [],
      customPlaylists: initialCustomPlaylists,
      selectedPlaylistId: "new-downloads",
    };
  }, [canSyncLibraryState, initialCustomPlaylists, initialLibrary]);

  const [currentTrackIndex, setCurrentTrackIndex] = useState(initialTrackIndex);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    canSyncLibraryState ? initialStoredState.selectedPlaylistId ?? "new-downloads" : "all"
  );
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>(initialStoredState.likedTrackIds);
  const [customPlaylists, setCustomPlaylists] = useState<Array<{id: string; name: string; trackIds: string[]}>>(
    initialStoredState.customPlaylists
  );
  const [libraryStateReady, setLibraryStateReady] = useState(false);
  const [loadedSongsById, setLoadedSongsById] = useState<Record<string, SongLibraryItem>>({});

  const queue = useMemo<QueueTrack[]>(
    () =>
      props.queue ??
      initialLibrary.map((item) => ({
        id: item.id,
        title: item.title,
        artist: item.artist,
        accent: item.accent,
      })),
    [initialLibrary, props.queue]
  );
  const library = useMemo(
    () => initialLibrary.map((song) => loadedSongsById[song.id] ?? song),
    [initialLibrary, loadedSongsById]
  );
  const currentTrack = queue[currentTrackIndex] ?? queue[0];
  const currentSong = library[currentTrackIndex] ?? library[0];
  const isCurrentLiked = likedTrackIds.includes(currentSong.id);

  const filteredQueue = useMemo(() => {
    if (!selectedPlaylistId || selectedPlaylistId === "all") {
      return queue;
    }
    if (selectedPlaylistId === "liked") {
      return queue.filter((track) => likedTrackIds.includes(track.id));
    }
    const playlist = customPlaylists.find((item) => item.id === selectedPlaylistId);
    if (!playlist) {
      return queue;
    }
    return queue.filter((track) => playlist.trackIds.includes(track.id));
  }, [customPlaylists, likedTrackIds, queue, selectedPlaylistId]);

  const playlists: PlaylistSummary[] = useMemo(() => {
    return [
      {id: "all", name: "All Songs", count: queue.length},
      {id: "liked", name: "Liked Songs", count: likedTrackIds.length},
      ...customPlaylists.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        count: playlist.trackIds.length,
      })),
    ];
  }, [customPlaylists, likedTrackIds.length, queue.length]);

  const trackPlaylistIds = useMemo(() => {
    const ids: string[] = [];
    if (likedTrackIds.includes(currentSong.id)) {
      ids.push("liked");
    }
    customPlaylists.forEach((playlist) => {
      if (playlist.trackIds.includes(currentSong.id)) {
        ids.push(playlist.id);
      }
    });
    return ids;
  }, [currentSong.id, customPlaylists, likedTrackIds]);

  useEffect(() => {
    setLoadedSongsById({});
  }, [initialLibrary]);

  useEffect(() => {
    const loadLibraryItem = props.loadLibraryItem;
    if (!isInteractiveAudio || !loadLibraryItem || !currentTrack?.id || currentSong.audioFeatures) {
      return;
    }

    let cancelled = false;
    void loadLibraryItem(currentTrack.id).then((loadedSong) => {
      if (cancelled || !loadedSong) {
        return;
      }
      setLoadedSongsById((current) => ({
        ...current,
        [loadedSong.id]: loadedSong,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [currentSong.audioFeatures, currentTrack?.id, isInteractiveAudio, props.loadLibraryItem]);

  useEffect(() => {
    if (!canSyncLibraryState) {
      return;
    }

    let cancelled = false;

    const hydrateLibraryState = async () => {
      try {
        const response = await fetch(LIBRARY_STATE_SYNC_URL);
        if (!response.ok) {
          throw new Error(`library-state sync failed: ${response.status}`);
        }

        const parsed = (await response.json()) as Partial<{
          likedTrackIds: string[];
          customPlaylists: Array<{id: string; name: string; trackIds: string[] | "__ALL__"}>;
          selectedPlaylistId: string | null;
        }>;

        if (cancelled) {
          return;
        }

        const libraryIds = initialLibrary.map((item) => item.id);
        const nextCustomPlaylists = buildCustomPlaylists(initialCustomPlaylists, libraryIds, parsed.customPlaylists);
        const playlistIds = new Set(nextCustomPlaylists.map((playlist) => playlist.id));
        const nextSelectedPlaylistId =
          typeof parsed.selectedPlaylistId === "string" &&
          (parsed.selectedPlaylistId === "all" ||
            parsed.selectedPlaylistId === "liked" ||
            playlistIds.has(parsed.selectedPlaylistId))
            ? parsed.selectedPlaylistId
            : "all";

        setLikedTrackIds(
          Array.isArray(parsed.likedTrackIds)
            ? Array.from(new Set(parsed.likedTrackIds.filter((trackId) => libraryIds.includes(trackId))))
            : []
        );
        setCustomPlaylists(nextCustomPlaylists);
        setSelectedPlaylistId(nextSelectedPlaylistId);
      } catch {
        // fall back to localStorage/default seed state
      } finally {
        if (!cancelled) {
          setLibraryStateReady(true);
        }
      }
    };

    void hydrateLibraryState();

    return () => {
      cancelled = true;
    };
  }, [canSyncLibraryState, initialCustomPlaylists, initialLibrary]);

  useEffect(() => {
    if (!canSyncLibraryState || !libraryStateReady || typeof window === "undefined") {
      return;
    }

    const payload: StoredLibraryState = {
      likedTrackIds,
      customPlaylists,
      selectedPlaylistId,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    const libraryIds = initialLibrary.map((item) => item.id);
    const syncPayload = {
      nickname: DEFAULT_NICKNAME,
      likedTrackIds,
      selectedPlaylistId,
      customPlaylists: customPlaylists.map((playlist) => {
        const coversAllSongs =
          playlist.id === "night-drive" &&
          playlist.trackIds.length === libraryIds.length &&
          libraryIds.every((trackId) => playlist.trackIds.includes(trackId));

        return {
          id: playlist.id,
          name: playlist.name,
          trackIds: coversAllSongs ? ALL_TRACKS_SENTINEL : playlist.trackIds,
        };
      }),
    };

    void fetch(LIBRARY_STATE_SYNC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(syncPayload),
    }).catch(() => undefined);
  }, [canSyncLibraryState, customPlaylists, initialLibrary, libraryStateReady, likedTrackIds, selectedPlaylistId]);

  useEffect(() => {
    setCurrentTrackIndex(initialTrackIndex);
  }, [initialTrackIndex]);

  const toggleCurrentLike = () => {
    setLikedTrackIds((value) =>
      value.includes(currentSong.id) ? value.filter((id) => id !== currentSong.id) : [...value, currentSong.id]
    );
  };

  const toggleCurrentSongInPlaylist = (playlistId: string) => {
    if (playlistId === "liked") {
      toggleCurrentLike();
      return;
    }

    setCustomPlaylists((value) =>
      value.map((playlist) =>
        playlist.id === playlistId
          ? {
              ...playlist,
              trackIds: playlist.trackIds.includes(currentSong.id)
                ? playlist.trackIds.filter((trackId) => trackId !== currentSong.id)
                : [...playlist.trackIds, currentSong.id],
            }
          : playlist
      )
    );
  };

  return {
    currentSong,
    currentTrack,
    currentTrackIndex,
    customPlaylists,
    filteredQueue,
    initialTrackIndex,
    isCurrentLiked,
    library,
    likedTrackIds,
    playlists,
    queue,
    selectedPlaylistId,
    setCurrentTrackIndex,
    setSelectedPlaylistId,
    setCustomPlaylists,
    setLikedTrackIds,
    toggleCurrentLike,
    toggleCurrentSongInPlaylist,
    trackPlaylistIds,
  };
};
