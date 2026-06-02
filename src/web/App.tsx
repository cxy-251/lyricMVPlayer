import React, {lazy, Suspense, useEffect, useMemo, useState} from "react";
import {Player} from "@remotion/player";

import {MusicVideoComposition} from "../../modules/render-core/src/compositions/MusicVideoComposition";
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

const EffectLabPage = lazy(() =>
  import("../../modules/render-core/src/visual-effects/lab/EffectLabPage").then((module) => ({
    default: module.EffectLabPage,
  })),
);

const PaperStudioPage = lazy(() =>
  import("./PaperStudioPage").then((module) => ({
    default: module.PaperStudioPage,
  })),
);

const StudioHomePage = lazy(() =>
  import("./StudioHomePage").then((module) => ({
    default: module.StudioHomePage,
  })),
);

type ManifestSong = {
  id: string;
  title: string;
  artist: string;
  renderInputUrl: string;
  audioFeaturesUrl: string;
  assetStatus?: QueueTrack["assetStatus"];
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
    assetStatus: song.assetStatus,
  }));

const normalizeManifestTrackIds = (trackIds: unknown): string[] =>
  Array.isArray(trackIds)
    ? Array.from(new Set(trackIds.filter((trackId): trackId is string => typeof trackId === "string")))
    : [];

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
            ? normalizeManifestTrackIds(playlist.trackIds)
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
  const [splashText, setSplashText] = useState<string>("LET THE WAVEFORM BREATHE BELOW THE SONG");
  const [showSplash, setShowSplash] = useState(true);
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const isStudioRoute = pathname === "/studio";
  const isLegacyPaperEffectRoute = pathname.startsWith("/paper/effects/");
  const isEffectLabRoute =
    pathname === "/effects" ||
    pathname.startsWith("/effects/") ||
    pathname === "/studio/effects" ||
    pathname.startsWith("/studio/effects/") ||
    isLegacyPaperEffectRoute;
  const isPaperStudioRoute =
    pathname === "/studio/papers" ||
    pathname.startsWith("/studio/papers/") ||
    (pathname === "/paper" || pathname.startsWith("/paper/")) && !isLegacyPaperEffectRoute ||
    pathname.startsWith("/templates/") ||
    pathname.startsWith("/previews/");
  const isNonLyricsRoute = isStudioRoute || isEffectLabRoute || isPaperStudioRoute;

  const preloadImage = async (src: string | undefined): Promise<void> => {
    if (!src) {
      return;
    }

    await new Promise<void>((resolve) => {
      const image = new Image();
      const settle = () => resolve();
      image.onload = settle;
      image.onerror = settle;
      image.src = src;
    });
  };

  useEffect(() => {
    if (isNonLyricsRoute) {
      return undefined;
    }

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
      assetStatus: song.assetStatus,
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
          assetStatus: song.assetStatus,
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
        setSplashText(initialSong.poetryFrame?.bottomLine?.trim() || "LET THE WAVEFORM BREATHE BELOW THE SONG");
        await preloadImage(initialSong.background?.kind === "image" ? initialSong.background.src : undefined);
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
          window.setTimeout(() => {
            if (!cancelled) {
              setShowSplash(false);
            }
          }, 260);
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
  }, [isNonLyricsRoute]);

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

  if (isStudioRoute) {
    return (
      <Suspense fallback={<div className="web-route-status">Loading studio...</div>}>
        <StudioHomePage />
      </Suspense>
    );
  }

  if (isEffectLabRoute) {
    return (
      <Suspense fallback={<div className="web-route-status">Loading effect lab...</div>}>
        <EffectLabPage />
      </Suspense>
    );
  }

  if (isPaperStudioRoute) {
    return (
      <Suspense fallback={<div className="web-route-status">Loading paper player...</div>}>
        <PaperStudioPage />
      </Suspense>
    );
  }

  return (
    <div className="web-shell">
      <div className="web-stage-frame">
        <a className="web-studio-link" href="/studio" title="Studio" aria-label="Open studio">
          <span>Lab</span>
        </a>
        {body}
        <div className={`web-splash ${showSplash ? "is-visible" : "is-hidden"}`}>
          <div className="web-splash__inner">
            <div className="web-splash__label">CLEANKSEN · AUDIO DIARY</div>
            <div className="web-splash__text">{splashText}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
