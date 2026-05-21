import React, {useEffect, useMemo, useState} from "react";
import {Player} from "@remotion/player";

import {MusicVideoComposition} from "../../modules/render-core/src";
import type {
  AudioFeatureTrack,
  BackgroundAsset,
  LyricVideoCompositionProps,
  PlaylistSummary,
  QueueTrack,
  PoetryFrame,
  SongLibraryItem,
  TimedLyricLine,
} from "../../modules/render-core/src";

type ManifestSong = {
  id: string;
  title: string;
  artist: string;
  renderInputUrl: string;
  audioFeaturesUrl: string;
};

type WebManifest = {
  nickname: string;
  selectedPlaylistId: string | null;
  currentSongDirName: string;
  likedTrackIds: string[];
  customPlaylists: Array<{id: string; name: string; trackIds: string[] | "__ALL__"}>;
  songs: ManifestSong[];
};

type RenderInputPayload = {
  title: string;
  artist: string;
  audioSrc?: string;
  lyricOffsetMs?: number;
  renderTrimStartMs?: number;
  renderDurationInFrames?: number;
  durationInFrames: number;
  fps: number;
  background: {
    kind?: "image" | "video" | "color";
    src?: string;
    color?: string | null;
  };
  poetryFrame?: {
    nickname?: string | null;
    topLabel?: string | null;
    leftVertical?: string | null;
    rightVertical?: string | null;
    bottomLine?: string | null;
  };
  lyrics: TimedLyricLine[];
};

const ALL_TRACKS_SENTINEL = "__ALL__";
const DEFAULT_BACKGROUND: BackgroundAsset = {kind: "color", color: "#101828"};
const DEFAULT_POETRY_FRAME: PoetryFrame = {
  nickname: "CleanKsen",
  topLabel: "CLEANKSEN · AUDIO DIARY",
  leftVertical: "",
  rightVertical: "",
  bottomLine: "",
};

const buildQueue = (library: SongLibraryItem[]): QueueTrack[] =>
  library.map((song) => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    accent: "rgba(163, 206, 255, 0.7)",
  }));

const buildPlaylists = (
  library: SongLibraryItem[],
  manifest: WebManifest
): PlaylistSummary[] => {
  const libraryIds = library.map((song) => song.id);
  return [
    {id: "liked", name: "Liked Songs", count: manifest.likedTrackIds.length, accent: "rgba(255, 196, 170, 0.78)"},
    ...manifest.customPlaylists.map((playlist) => {
      const trackIds =
        playlist.trackIds === ALL_TRACKS_SENTINEL
          ? libraryIds
          : Array.isArray(playlist.trackIds)
            ? playlist.trackIds.filter((trackId) => libraryIds.includes(trackId))
            : [];

      return {
        id: playlist.id,
        name: playlist.name,
        count: trackIds.length,
        accent: "rgba(255,255,255,0.58)",
        trackIds,
      };
    }),
  ];
};

const normalizePoetryFrame = (
  poetryFrame: RenderInputPayload["poetryFrame"],
  nickname: string
) =>
  poetryFrame
    ? {
        nickname: poetryFrame.nickname ?? nickname,
        topLabel: poetryFrame.topLabel ?? `${nickname.toUpperCase()} · AUDIO DIARY`,
        leftVertical: poetryFrame.leftVertical ?? "",
        rightVertical: poetryFrame.rightVertical ?? "",
        bottomLine: poetryFrame.bottomLine ?? "",
      }
    : {
        nickname,
        topLabel: `${nickname.toUpperCase()} · AUDIO DIARY`,
        leftVertical: "",
        rightVertical: "",
        bottomLine: "",
      };

export const App: React.FC = () => {
  const [props, setProps] = useState<LyricVideoCompositionProps | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const renderInputCache = new Map<string, Promise<RenderInputPayload>>();
    const audioFeaturesCache = new Map<string, Promise<AudioFeatureTrack>>();
    const mediaPrefetchCache = new Set<string>();
    const songDataCache = new Map<string, Promise<SongLibraryItem>>();

    const createPlaceholderSong = (
      song: ManifestSong,
      nickname: string
    ): SongLibraryItem => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      lyricOffsetMs: 0,
      renderTrimStartMs: 0,
      renderDurationInFrames: 1,
      durationInFrames: 1,
      fps: 30,
      background: DEFAULT_BACKGROUND,
      poetryFrame: {
        ...DEFAULT_POETRY_FRAME,
        nickname,
        topLabel: `${nickname.toUpperCase()} · AUDIO DIARY`,
      },
        lyrics: [{startMs: 0, endMs: 1000, text: "Loading..."}],
    });

    const fetchJson = async <T,>(url: string): Promise<T> => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status}`);
      }
      return (await response.json()) as T;
    };

    const prefetchMedia = (url: string | undefined) => {
      if (!url || mediaPrefetchCache.has(url)) {
        return;
      }
      mediaPrefetchCache.add(url);
      void fetch(url, {cache: "force-cache"}).catch(() => {
        mediaPrefetchCache.delete(url);
      });
    };

    const prefetchRenderAssets = (renderInput: RenderInputPayload) => {
      prefetchMedia(renderInput.audioSrc);
      if (renderInput.background?.kind === "image" || renderInput.background?.kind === "video") {
        prefetchMedia(renderInput.background?.src);
      }
    };

    const loadSongData = async (
      song: ManifestSong,
      nickname: string
    ): Promise<SongLibraryItem> => {
      const existing = songDataCache.get(song.id);
      if (existing) {
        return existing;
      }

      const promise = (async () => {
        const renderInputPromise =
          renderInputCache.get(song.id) ?? fetchJson<RenderInputPayload>(song.renderInputUrl);
        renderInputCache.set(song.id, renderInputPromise);

        const audioFeaturesPromise =
          audioFeaturesCache.get(song.id) ?? fetchJson<AudioFeatureTrack>(song.audioFeaturesUrl);
        audioFeaturesCache.set(song.id, audioFeaturesPromise);

        const [renderInput, audioFeatures] = await Promise.all([renderInputPromise, audioFeaturesPromise]);
        prefetchRenderAssets(renderInput);

        return {
          id: song.id,
          title: renderInput.title,
          artist: renderInput.artist,
          audioSrc: renderInput.audioSrc,
          lyricOffsetMs: renderInput.lyricOffsetMs ?? 0,
          renderTrimStartMs: renderInput.renderTrimStartMs ?? 0,
          renderDurationInFrames: renderInput.renderDurationInFrames ?? renderInput.durationInFrames,
          durationInFrames: renderInput.durationInFrames,
          fps: renderInput.fps,
          background: {
            kind: renderInput.background?.kind ?? (renderInput.background?.src ? "image" : "color"),
            src: renderInput.background?.src,
            color: renderInput.background?.color ?? "#101828",
          },
          poetryFrame: normalizePoetryFrame(renderInput.poetryFrame, nickname),
          lyrics: renderInput.lyrics as TimedLyricLine[],
          audioFeatures,
        } satisfies SongLibraryItem;
      })();

      songDataCache.set(song.id, promise);
      return promise;
    };

    const load = async () => {
      try {
        const manifestResponse = await fetch("/library-manifest.json");
        if (!manifestResponse.ok) {
          throw new Error(`Failed to load library-manifest.json: ${manifestResponse.status}`);
        }

        const manifest = (await manifestResponse.json()) as WebManifest;
        const nickname = manifest.nickname ?? "CleanKsen";
        const placeholders = manifest.songs.map((song) => createPlaceholderSong(song, nickname));
        const initialManifestSong =
          manifest.songs.find((song) => song.id === manifest.currentSongDirName) ?? manifest.songs[0];

        if (!initialManifestSong) {
          throw new Error("No songs available in web manifest.");
        }

        const initialSong = await loadSongData(initialManifestSong, nickname);
        const initialLibrary = placeholders.map((song) => (song.id === initialSong.id ? initialSong : song));
        const queue = buildQueue(placeholders);
        const playlists = buildPlaylists(placeholders, manifest);
        const initialIndex = manifest.songs.findIndex((song) => song.id === initialSong.id);

        if (!initialSong) {
          throw new Error("No songs available in web manifest.");
        }

        if (!cancelled) {
          setProps({
            title: initialSong.title,
            artist: initialSong.artist,
            audioSrc: initialSong.audioSrc,
            interactivePreview: true,
            lyricOffsetMs: initialSong.lyricOffsetMs ?? 0,
            renderTrimStartMs: initialSong.renderTrimStartMs ?? 0,
            renderDurationInFrames: initialSong.renderDurationInFrames ?? initialSong.durationInFrames,
            durationInFrames: initialSong.durationInFrames,
            fps: initialSong.fps,
            background: initialSong.background,
            poetryFrame: initialSong.poetryFrame,
            lyrics: initialSong.lyrics,
            audioFeatures: initialSong.audioFeatures,
            library: initialLibrary,
            initialTrackId: initialSong.id,
            queue,
            playlists,
          });
        }

        const prioritySongs = [
          manifest.songs[initialIndex + 1],
          manifest.songs[initialIndex - 1],
        ].filter((song): song is ManifestSong => Boolean(song && song.id !== initialSong.id));

        await Promise.all(
          prioritySongs.map(async (song) => {
            try {
              const loadedSong = await loadSongData(song, nickname);
              if (!cancelled) {
                setProps((current) => {
                  if (!current?.library) {
                    return current;
                  }
                  return {
                    ...current,
                    library: current.library.map((item) => (item.id === loadedSong.id ? loadedSong : item)),
                  };
                });
              }
            } catch {
              // keep placeholder for failed neighbor prefetch
            }
          })
        );

        const remainingSongs = manifest.songs.filter(
          (song) => song.id !== initialSong.id && !prioritySongs.some((prioritySong) => prioritySong.id === song.id)
        );
        for (const song of remainingSongs) {
          if (cancelled) {
            break;
          }
          try {
            const loadedSong = await loadSongData(song, nickname);
            if (!cancelled) {
              setProps((current) => {
                if (!current?.library) {
                  return current;
                }
                return {
                  ...current,
                  library: current.library.map((item) => (item.id === loadedSong.id ? loadedSong : item)),
                };
              });
            }
          } catch {
            // keep placeholder song and continue loading the rest
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const body = useMemo(() => {
    if (error) {
      return <div className="web-status">Failed to load player assets: {error}</div>;
    }

    if (!props) {
      return <div className="web-status">Loading player library...</div>;
    }

    return (
      <Player
        component={MusicVideoComposition}
        inputProps={props}
        durationInFrames={props.durationInFrames}
        fps={props.fps}
        compositionWidth={1080}
        compositionHeight={1920}
        controls={false}
        autoPlay={false}
        loop={false}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#000",
        }}
      />
    );
  }, [error, props]);

  return (
    <div className="web-shell">
      <div className="web-stage-frame">{body}</div>
    </div>
  );
};
