import React, {useEffect, useMemo, useRef, useState} from "react";
import {getRemotionEnvironment, useCurrentFrame} from "remotion";
import {ListMusic, Menu} from "lucide-react";

import type {
  LyricVideoCompositionProps,
  PlaylistSummary,
  QueueTrack,
  SongLibraryItem
} from "../../types";
import {cn} from "../../lib/cn";
import {AddToPlaylistPanel} from "./AddToPlaylistPanel";
import {AudioReactiveBackground} from "./AudioReactiveBackground";
import {BackgroundLayer} from "./BackgroundLayer";
import {ControlBar} from "./ControlBar";
import {EnergyRing} from "./EnergyRing";
import {LyricCarousel} from "./LyricCarousel";
import {LyricShockwave} from "./LyricShockwave";
import {ParticleOrbit} from "./ParticleOrbit";
import {PlaylistDrawer} from "./PlaylistDrawer";
import {ProgressBar} from "./ProgressBar";
import {QueuePanel} from "./QueuePanel";
import {ReadabilityLayer} from "./ReadabilityLayer";
import {SafePoetryFrame} from "./SafePoetryFrame";
import {SparkleLayer} from "./SparkleLayer";
import {TopSongInfo} from "./TopSongInfo";
import {WaveformEnergyCanvas} from "./WaveformEnergyCanvas";

type RepeatMode = "none" | "one" | "list";
type StoredLibraryState = {
  likedTrackIds: string[];
  customPlaylists: Array<{id: string; name: string; trackIds: string[]}>;
  selectedPlaylistId: string | null;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const STORAGE_KEY = "lyricMVPlayer.libraryState.v1";
const DEFAULT_NICKNAME = "CleanKsen";
const LIBRARY_STATE_SYNC_URL = "http://127.0.0.1:3210/api/library-state";
const ALL_TRACKS_SENTINEL = "__ALL__";
const DEFAULT_CUSTOM_PLAYLISTS = [
  {id: "new-downloads", name: "New Downloads", trackIds: [] as string[]},
  {id: "lyrics-review", name: "Lyrics Review", trackIds: [] as string[]},
  {id: "alignment-error", name: "Alignment Error", trackIds: [] as string[]},
];

const formatDisplayTitle = (title: string, artist: string): string => {
  const strippedArtist = title.replace(new RegExp(`^${artist}\\s*-\\s*`, "i"), "");
  return strippedArtist.replace(/\s*\([^)]*\)/g, "").trim();
};

const findActiveLine = (lyrics: LyricVideoCompositionProps["lyrics"], currentMs: number) => {
  return lyrics.find((line) => currentMs >= line.startMs && currentMs < line.endMs) ?? lyrics[0] ?? null;
};

const sampleAudioFeature = (
  audioFeatures: LyricVideoCompositionProps["audioFeatures"] | undefined,
  currentMs: number
) => {
  if (!audioFeatures || audioFeatures.frames.length === 0) {
    return null;
  }

  const frameDurationMs = 1000 / audioFeatures.frameRate;
  const index = clamp(Math.round(currentMs / frameDurationMs), 0, audioFeatures.frames.length - 1);
  return audioFeatures.frames[index];
};

const normalizeTrackIds = (trackIds: unknown, libraryIds: string[]): string[] => {
  if (trackIds === ALL_TRACKS_SENTINEL) {
    return libraryIds;
  }

  if (!Array.isArray(trackIds)) {
    return [];
  }

  const libraryIdSet = new Set(libraryIds);
  return Array.from(
    new Set(trackIds.filter((trackId): trackId is string => typeof trackId === "string" && libraryIdSet.has(trackId)))
  );
};

const buildCustomPlaylists = (
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

  const mergedIds = Array.from(new Set([...basePlaylists.map((playlist) => playlist.id), ...persistedList.map((playlist) => playlist.id)]));

  return mergedIds.map((playlistId) => {
    const base = baseMap.get(playlistId);
    const persisted = persistedList.find((playlist) => playlist.id === playlistId);
    return {
      id: playlistId,
      name: persisted?.name ?? base?.name ?? playlistId,
      trackIds: normalizeTrackIds(persisted?.trackIds ?? base?.trackIds ?? [], libraryIds),
    };
  });
};

export const VideoStage: React.FC<LyricVideoCompositionProps> = (props) => {
  const frame = useCurrentFrame();
  const env = getRemotionEnvironment();
  const isStudio = env.isStudio;
  const isInteractiveAudio = isStudio || props.interactivePreview === true;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const energyRafRef = useRef<number | null>(null);
  const smoothedEnergyRef = useRef(0.16);
  const transitionGuardRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("list");
  const [previewTimeMs, setPreviewTimeMs] = useState(0);
  const [loadedAudioDurationMs, setLoadedAudioDurationMs] = useState(0);
  const [audioEnergy, setAudioEnergy] = useState(0.16);
  const [crossfadeOpacity, setCrossfadeOpacity] = useState(0);
  const [playlistDrawerOpen, setPlaylistDrawerOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
  const initialLibrary = useMemo<SongLibraryItem[]>(() => {
    if (props.library && props.library.length > 0) {
      return props.library;
    }

    return [
      {
        id: `${props.title}-${props.artist}`,
        title: props.title,
        artist: props.artist,
        audioSrc: props.audioSrc,
        lyricOffsetMs: props.lyricOffsetMs,
        durationInFrames: props.durationInFrames,
        fps: props.fps,
        background: props.background,
        poetryFrame: props.poetryFrame,
        lyrics: props.lyrics,
        audioFeatures: props.audioFeatures,
      },
    ];
  }, [props]);

  const initialTrackIndex = useMemo(() => {
    if (!props.initialTrackId) {
      return 0;
    }
    const foundIndex = initialLibrary.findIndex((item) => item.id === props.initialTrackId);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [initialLibrary, props.initialTrackId]);

  const initialCustomPlaylists = useMemo<
    Array<{id: string; name: string; trackIds: string[]}>
  >(() => {
    const defaults = (props.playlists ?? []).filter((playlist) => playlist.id !== "liked");
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
  }, [initialLibrary, props.playlists]);

  const initialStoredState = useMemo<StoredLibraryState>(() => {
    if (!isInteractiveAudio) {
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
  }, [initialCustomPlaylists, initialLibrary, isInteractiveAudio]);

  const [currentTrackIndex, setCurrentTrackIndex] = useState(initialTrackIndex);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    isInteractiveAudio ? initialStoredState.selectedPlaylistId ?? "new-downloads" : "all"
  );
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>(initialStoredState.likedTrackIds);
  const [customPlaylists, setCustomPlaylists] = useState<
    Array<{id: string; name: string; trackIds: string[]}>
  >(initialStoredState.customPlaylists);
  const [libraryStateReady, setLibraryStateReady] = useState(false);

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
  const library = initialLibrary;
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
  const title = formatDisplayTitle(currentSong.title, currentSong.artist);
  const renderTrimStartMs = currentSong.renderTrimStartMs ?? 0;
  const liveFrame = Math.floor((previewTimeMs / 1000) * currentSong.fps);
  const currentTimeMs = isInteractiveAudio ? previewTimeMs : (frame / currentSong.fps) * 1000 + renderTrimStartMs;
  const effectiveLyricTimeMs = currentTimeMs + (currentSong.lyricOffsetMs ?? 0);
  const lyricsEndMs = currentSong.lyrics[currentSong.lyrics.length - 1]?.endMs ?? 0;
  const fallbackDurationMs = Math.max((currentSong.durationInFrames / currentSong.fps) * 1000, lyricsEndMs);
  const durationMs = Math.max(loadedAudioDurationMs || 0, fallbackDurationMs);
  const activeLine = findActiveLine(currentSong.lyrics, effectiveLyricTimeMs);
  const activeSpan = activeLine ? Math.max(1, activeLine.endMs - activeLine.startMs) : 1;
  const lineProgress = activeLine ? clamp((effectiveLyricTimeMs - activeLine.startMs) / activeSpan, 0, 1) : 0;
  const fallbackEnergy = activeLine
    ? 0.26 + Math.sin(lineProgress * Math.PI) * 0.74
    : 0.2 + (Math.sin(currentTimeMs * 0.0016) * 0.5 + 0.5) * 0.08;
  const sampledFeature = sampleAudioFeature(currentSong.audioFeatures, currentTimeMs);
  const reactiveBass = sampledFeature?.bass ?? fallbackEnergy * 0.82;
  const reactiveMid = sampledFeature?.mid ?? fallbackEnergy * 0.72;
  const reactiveHigh = sampledFeature?.high ?? fallbackEnergy * 0.62;
  const reactiveEnergy = sampledFeature?.energy ?? fallbackEnergy;
  const reactiveBeat = sampledFeature?.beat ?? 0;
  const reactiveOnset = sampledFeature?.onset ?? 0;

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
  }, [customPlaylists, likedTrackIds.length]);

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
    if (!isInteractiveAudio) {
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
  }, [initialCustomPlaylists, initialLibrary, isInteractiveAudio]);

  useEffect(() => {
    if (!isInteractiveAudio || !libraryStateReady || typeof window === "undefined") {
      return;
    }

    if (typeof window === "undefined") {
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
  }, [customPlaylists, initialLibrary, isInteractiveAudio, libraryStateReady, likedTrackIds, selectedPlaylistId]);

  const performSeek = (targetMs: number) => {
    const nextMs = clamp(targetMs, 0, durationMs);
    setPreviewTimeMs(nextMs);
    if (audioRef.current) {
      audioRef.current.currentTime = nextMs / 1000;
    }
  };

  const triggerCrossfadeRestart = () => {
    if (!audioRef.current || transitionGuardRef.current) {
      return;
    }

    transitionGuardRef.current = true;
    setCrossfadeOpacity(1);
    audioRef.current.volume = 0.18;

    window.setTimeout(() => {
      if (!audioRef.current) {
        transitionGuardRef.current = false;
        return;
      }

      audioRef.current.currentTime = 0;
      setPreviewTimeMs(0);
      audioRef.current.volume = 1;
      if (isPlaying) {
        void audioRef.current.play().catch(() => undefined);
      }
      setCrossfadeOpacity(0);
      transitionGuardRef.current = false;
    }, 460);
  };

  useEffect(() => {
    if (!isInteractiveAudio || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;
    let rafId = 0;

    const syncDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setLoadedAudioDurationMs(audio.duration * 1000);
      }
    };

    const tick = () => {
      setPreviewTimeMs(audio.currentTime * 1000);
      if (isPlaying) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      if (repeatMode === "one") {
        triggerCrossfadeRestart();
        setIsPlaying(true);
        return;
      }
      if (repeatMode === "list" && filteredQueue.length > 0) {
        if (filteredQueue.length === 1) {
          triggerCrossfadeRestart();
          setIsPlaying(true);
          return;
        }
        const activeIndex = filteredQueue.findIndex((track) => track.id === currentSong.id);
        const nextTrack = filteredQueue[(activeIndex + 1) % filteredQueue.length];
        const nextLibraryIndex = library.findIndex((item) => item.id === nextTrack.id);
        if (nextLibraryIndex >= 0) {
          setCurrentTrackIndex(nextLibraryIndex);
          setIsPlaying(true);
        }
      }
    };

    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("ended", onEnded);
    if (isPlaying) {
      rafId = window.requestAnimationFrame(tick);
    }
    syncDuration();

    return () => {
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("ended", onEnded);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [currentSong.id, filteredQueue, isInteractiveAudio, isPlaying, library, repeatMode]);

  useEffect(() => {
    if (!isInteractiveAudio || !audioRef.current || !isPlaying) {
      return;
    }

    const tailMs = durationMs - lyricsEndMs;
    if (repeatMode === "one" && lyricsEndMs > 0 && tailMs > 2200 && currentTimeMs >= lyricsEndMs + 240) {
      triggerCrossfadeRestart();
    } else if (repeatMode === "one" && currentTimeMs >= durationMs - 760) {
      triggerCrossfadeRestart();
    }
  }, [currentTimeMs, durationMs, isInteractiveAudio, isPlaying, lyricsEndMs, repeatMode]);

  useEffect(() => {
    if (!isInteractiveAudio || !audioRef.current || typeof window === "undefined") {
      return;
    }

    const audio = audioRef.current;
    const AudioContextClass = window.AudioContext ?? (window as typeof window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const audioContext = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = audioContext;

    const analyser = analyserRef.current ?? audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.72;
    analyserRef.current = analyser;

    if (!mediaSourceRef.current) {
      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      mediaSourceRef.current = source;
    }

    const timeDomainData = new Uint8Array(analyser.fftSize);

    const updateEnergy = () => {
      analyser.getByteTimeDomainData(timeDomainData);

      let sumSquares = 0;
      for (let index = 0; index < timeDomainData.length; index += 1) {
        const normalized = (timeDomainData[index] - 128) / 128;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / timeDomainData.length);
      const boostedEnergy = clamp(rms * 4.8, 0, 1);
      const idlePhase = typeof performance !== "undefined" ? performance.now() * 0.0014 : Date.now() * 0.0014;
      const idleEnergy = 0.1 + (Math.sin(idlePhase) * 0.5 + 0.5) * 0.06;
      const currentEnergy = isPlaying ? boostedEnergy : idleEnergy;
      const nextSmoothed = smoothedEnergyRef.current * 0.85 + currentEnergy * 0.15;

      smoothedEnergyRef.current = nextSmoothed;
      setAudioEnergy(nextSmoothed);
      energyRafRef.current = window.requestAnimationFrame(updateEnergy);
    };

    if (audioContext.state === "suspended") {
      void audioContext.resume().catch(() => undefined);
    }

    energyRafRef.current = window.requestAnimationFrame(updateEnergy);

    return () => {
      if (energyRafRef.current) {
        window.cancelAnimationFrame(energyRafRef.current);
        energyRafRef.current = null;
      }
    };
  }, [isInteractiveAudio, isPlaying]);

  const togglePlay = async () => {
    if (!isInteractiveAudio || !audioRef.current) {
      setIsPlaying((value) => !value);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      if (audioContextRef.current?.state === "suspended") {
        await audioContextRef.current.resume();
      }
      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const goPrevious = () => {
    if (currentTimeMs > 3000) {
      performSeek(0);
      return;
    }

    if (filteredQueue.length > 1) {
      const activeIndex = filteredQueue.findIndex((track) => track.id === currentSong.id);
      const nextTrack = filteredQueue[(activeIndex - 1 + filteredQueue.length) % filteredQueue.length];
      const nextLibraryIndex = library.findIndex((item) => item.id === nextTrack.id);
      if (nextLibraryIndex >= 0) {
        setCurrentTrackIndex(nextLibraryIndex);
      }
    }
    performSeek(0);
  };

  const goNext = () => {
    if (filteredQueue.length > 1) {
      const activeIndex = filteredQueue.findIndex((track) => track.id === currentSong.id);
      const nextTrack = filteredQueue[(activeIndex + 1) % filteredQueue.length];
      const nextLibraryIndex = library.findIndex((item) => item.id === nextTrack.id);
      if (nextLibraryIndex >= 0) {
        setCurrentTrackIndex(nextLibraryIndex);
      }
    }
    performSeek(0);
  };

  useEffect(() => {
    setCurrentTrackIndex(initialTrackIndex);
  }, [initialTrackIndex]);

  useEffect(() => {
    if (!isInteractiveAudio) {
      return;
    }
    if (filteredQueue.length === 0) {
      return;
    }
    if (!filteredQueue.some((track) => track.id === currentSong.id)) {
      const nextTrack = filteredQueue[0];
      const nextLibraryIndex = library.findIndex((item) => item.id === nextTrack.id);
      if (nextLibraryIndex >= 0) {
        setCurrentTrackIndex(nextLibraryIndex);
        performSeek(0);
      }
    }
  }, [currentSong.id, filteredQueue, isInteractiveAudio, library]);

  useEffect(() => {
    if (!isInteractiveAudio) {
      return;
    }
    setPreviewTimeMs(0);
    setLoadedAudioDurationMs(0);
    if (!audioRef.current) {
      return;
    }
    audioRef.current.currentTime = 0;
    audioRef.current.load();
    if (isPlaying) {
      void audioRef.current.play().catch(() => undefined);
    }
  }, [currentTrackIndex, isInteractiveAudio]);

  return (
    <div
      className="relative h-[1920px] w-[1080px] overflow-hidden bg-black font-serif"
      style={{
        position: "relative",
        width: 1080,
        height: 1920,
        overflow: "hidden",
        backgroundColor: "#000"
      }}
    >
      {isInteractiveAudio && currentSong.audioSrc ? <audio ref={audioRef} src={currentSong.audioSrc} preload="auto" /> : null}
      <BackgroundLayer kind={currentSong.background.kind} src={currentSong.background.src} color={currentSong.background.color} />
      <AudioReactiveBackground bass={reactiveBass} energy={reactiveEnergy} onset={reactiveOnset} />
      <ReadabilityLayer />
      <EnergyRing
        currentFrame={isInteractiveAudio ? liveFrame : frame}
        bass={reactiveBass}
        mid={reactiveMid}
        energy={reactiveEnergy}
        beat={reactiveBeat}
        onset={reactiveOnset}
        lineProgress={lineProgress}
      />
      <ParticleOrbit
        currentFrame={isInteractiveAudio ? liveFrame : frame}
        energy={reactiveEnergy}
        high={reactiveHigh}
        beat={reactiveBeat}
        onset={reactiveOnset}
      />
      <LyricShockwave lineProgress={lineProgress} onset={reactiveOnset} />
      <SparkleLayer
        currentFrame={isInteractiveAudio ? liveFrame : frame}
        high={reactiveHigh}
        beat={reactiveBeat}
        onset={reactiveOnset}
      />
      <WaveformEnergyCanvas
        currentTimeMs={currentTimeMs}
        bass={sampledFeature ? reactiveBass : fallbackEnergy * 0.8}
        mid={sampledFeature ? reactiveMid : fallbackEnergy * 0.6}
        high={sampledFeature ? reactiveHigh : fallbackEnergy * 0.36}
        energy={sampledFeature ? reactiveEnergy : isInteractiveAudio ? audioEnergy : fallbackEnergy}
        onset={sampledFeature ? reactiveOnset : 0}
        isPlaying={isInteractiveAudio ? isPlaying : true}
      />
      <SafePoetryFrame
        nickname={currentSong.poetryFrame?.nickname ?? DEFAULT_NICKNAME}
        topLabel={currentSong.poetryFrame?.topLabel}
        leftVertical={currentSong.poetryFrame?.leftVertical}
        rightVertical={currentSong.poetryFrame?.rightVertical}
        bottomLine={currentSong.poetryFrame?.bottomLine}
      />

      <div
        className="absolute inset-0 z-40"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 40,
          pointerEvents: "auto"
        }}
      >
        <button
          className="absolute left-[120px] top-[126px] flex h-[64px] w-[64px] items-center justify-center rounded-full text-white/90 transition hover:text-white active:scale-95"
          onClick={() => setPlaylistDrawerOpen(true)}
          title="Playlists"
        >
          <Menu size={38} strokeWidth={1.8} />
        </button>
        <button
          className="absolute right-[120px] top-[126px] flex h-[64px] w-[64px] items-center justify-center rounded-full text-white/90 transition hover:text-white active:scale-95"
          onClick={() => setQueueOpen(true)}
          title="Queue"
        >
          <ListMusic size={38} strokeWidth={1.8} />
        </button>

        <TopSongInfo label="NOW PLAYING" title={title} artist={currentSong.artist} />

        <LyricCarousel
          lyrics={currentSong.lyrics}
          fps={currentSong.fps}
          currentTimeMs={effectiveLyricTimeMs}
          onSeek={isInteractiveAudio ? performSeek : undefined}
        />

        <ProgressBar
          currentTimeMs={currentTimeMs}
          durationMs={durationMs}
          onSeek={isInteractiveAudio ? performSeek : undefined}
        />

        <ControlBar
          isPlaying={isInteractiveAudio ? isPlaying : true}
          liked={isCurrentLiked}
          repeatMode={repeatMode}
          canGoPrevious={filteredQueue.length > 1}
          canGoNext={filteredQueue.length > 1}
          onTogglePlay={() => void togglePlay()}
          onPrevious={goPrevious}
          onNext={goNext}
          onToggleLike={() =>
            setLikedTrackIds((value) =>
              value.includes(currentSong.id)
                ? value.filter((id) => id !== currentSong.id)
                : [...value, currentSong.id]
            )
          }
          onToggleRepeatOne={() => setRepeatMode((value) => (value === "one" ? "none" : "one"))}
          onToggleRepeatList={() => setRepeatMode((value) => (value === "list" ? "none" : "list"))}
          onAddToPlaylist={() => setAddToPlaylistOpen(true)}
          addPanelOpen={addToPlaylistOpen}
        />
      </div>

        <PlaylistDrawer
          open={playlistDrawerOpen}
          playlists={playlists}
          selectedPlaylistId={selectedPlaylistId}
          onClose={() => setPlaylistDrawerOpen(false)}
          onSelectPlaylist={(playlistId) => {
            setSelectedPlaylistId((value) => (value === playlistId ? null : playlistId));
            setPlaylistDrawerOpen(false);
          }}
        />

      <QueuePanel
        open={queueOpen}
        queue={filteredQueue}
        currentTrackId={currentTrack.id}
        onClose={() => setQueueOpen(false)}
        onSelectTrack={(trackId) => {
          const nextIndex = queue.findIndex((track) => track.id === trackId);
          if (nextIndex >= 0) {
            setCurrentTrackIndex(nextIndex);
            performSeek(0);
            setQueueOpen(false);
          }
        }}
      />

        <AddToPlaylistPanel
          open={addToPlaylistOpen}
          playlists={playlists.filter((playlist) => playlist.id !== "all")}
          trackPlaylistIds={trackPlaylistIds}
          onClose={() => setAddToPlaylistOpen(false)}
          onSelectPlaylist={(playlistId) => {
            if (playlistId === "liked") {
              setLikedTrackIds((value) =>
                value.includes(currentSong.id)
                  ? value.filter((id) => id !== currentSong.id)
                  : [...value, currentSong.id]
              );
            } else {
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
            }
          }}
        />

      <div
        className={cn(
          "pointer-events-none absolute inset-0 transition-colors duration-300",
          crossfadeOpacity > 0 ? "bg-black/20" : "bg-transparent"
        )}
      />
    </div>
  );
};
