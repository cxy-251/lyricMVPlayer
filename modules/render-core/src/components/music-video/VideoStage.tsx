import React, {useEffect, useMemo, useRef, useState} from "react";
import {getRemotionEnvironment, useCurrentFrame} from "remotion";
import {ListMusic, Menu} from "lucide-react";

import type {
  LyricVideoCompositionProps,
  PlaylistSummary,
  QueueTrack
} from "../../types";
import {cn} from "../../lib/cn";
import {AddToPlaylistPanel} from "./AddToPlaylistPanel";
import {BackgroundLayer} from "./BackgroundLayer";
import {ControlBar} from "./ControlBar";
import {LyricCarousel} from "./LyricCarousel";
import {PlaylistDrawer} from "./PlaylistDrawer";
import {ProgressBar} from "./ProgressBar";
import {QueuePanel} from "./QueuePanel";
import {ReadabilityLayer} from "./ReadabilityLayer";
import {SafePoetryFrame} from "./SafePoetryFrame";
import {TopSongInfo} from "./TopSongInfo";
import {WaveformEnergyCanvas} from "./WaveformEnergyCanvas";

type RepeatMode = "none" | "one" | "list";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const formatDisplayTitle = (title: string, artist: string): string => {
  const strippedArtist = title.replace(new RegExp(`^${artist}\\s*-\\s*`, "i"), "");
  return strippedArtist.replace(/\s*\([^)]*\)/g, "").trim();
};

const findActiveLine = (lyrics: LyricVideoCompositionProps["lyrics"], currentMs: number) => {
  return lyrics.find((line) => currentMs >= line.startMs && currentMs < line.endMs) ?? lyrics[0];
};

export const VideoStage: React.FC<LyricVideoCompositionProps> = (props) => {
  const frame = useCurrentFrame();
  const env = getRemotionEnvironment();
  const isStudio = env.isStudio;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const energyRafRef = useRef<number | null>(null);
  const smoothedEnergyRef = useRef(0.16);
  const transitionGuardRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("list");
  const [previewTimeMs, setPreviewTimeMs] = useState(0);
  const [audioEnergy, setAudioEnergy] = useState(0.16);
  const [crossfadeOpacity, setCrossfadeOpacity] = useState(0);
  const [playlistDrawerOpen, setPlaylistDrawerOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>("liked");
  const [customPlaylists, setCustomPlaylists] = useState<string[]>([
    "Night Drive",
    "City Echoes",
    "Neon Pulse",
    "Soft Pages",
    "Afterglow"
  ]);

  const queue = props.queue ?? [
    {
      id: `${props.title}-${props.artist}`,
      title: props.title,
      artist: props.artist
    }
  ];
  const currentTrack = queue[currentTrackIndex] ?? queue[0];
  const title = formatDisplayTitle(currentTrack.title, currentTrack.artist);
  const currentTimeMs = isStudio ? previewTimeMs : (frame / props.fps) * 1000;
  const effectiveLyricTimeMs = currentTimeMs + (props.lyricOffsetMs ?? 0);
  const lyricsEndMs = props.lyrics[props.lyrics.length - 1]?.endMs ?? 0;
  const durationMs = Math.max((props.durationInFrames / props.fps) * 1000, lyricsEndMs);
  const activeLine = findActiveLine(props.lyrics, effectiveLyricTimeMs);
  const activeSpan = Math.max(1, activeLine.endMs - activeLine.startMs);
  const lineProgress = clamp((effectiveLyricTimeMs - activeLine.startMs) / activeSpan, 0, 1);
  const fallbackEnergy = 0.26 + Math.sin(lineProgress * Math.PI) * 0.74;

  const playlists: PlaylistSummary[] = useMemo(() => {
    const provided = props.playlists ?? [];
    const generated = customPlaylists
      .filter((name) => !provided.some((playlist) => playlist.name === name))
      .map((name, index) => ({
        id: `custom-${index}`,
        name,
        count: 0
      }));

    return [
      {id: "liked", name: "Liked Songs", count: liked ? 1 : 0},
      ...provided.filter((playlist) => playlist.id !== "liked"),
      ...generated
    ];
  }, [customPlaylists, liked, props.playlists]);

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
    if (!isStudio || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;
    let rafId = 0;

    const tick = () => {
      setPreviewTimeMs(audio.currentTime * 1000);
      if (isPlaying) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      if (repeatMode === "one" || repeatMode === "list") {
        if (repeatMode === "list" && queue.length > 1) {
          setCurrentTrackIndex((value) => (value + 1) % queue.length);
        }
        triggerCrossfadeRestart();
        setIsPlaying(true);
      }
    };

    audio.addEventListener("ended", onEnded);
    if (isPlaying) {
      rafId = window.requestAnimationFrame(tick);
    }

    return () => {
      audio.removeEventListener("ended", onEnded);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isPlaying, isStudio, queue.length, repeatMode]);

  useEffect(() => {
    if (!isStudio || !audioRef.current || !isPlaying) {
      return;
    }

    const tailMs = durationMs - lyricsEndMs;
    if (tailMs > 2200 && currentTimeMs >= lyricsEndMs + 240) {
      triggerCrossfadeRestart();
    } else if (currentTimeMs >= durationMs - 760) {
      triggerCrossfadeRestart();
    }
  }, [currentTimeMs, durationMs, isPlaying, isStudio, lyricsEndMs]);

  useEffect(() => {
    if (!isStudio || !audioRef.current || typeof window === "undefined") {
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
  }, [isPlaying, isStudio]);

  const togglePlay = async () => {
    if (!isStudio || !audioRef.current) {
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

    if (queue.length > 1) {
      setCurrentTrackIndex((value) => (value - 1 + queue.length) % queue.length);
    }
    performSeek(0);
  };

  const goNext = () => {
    if (queue.length > 1) {
      setCurrentTrackIndex((value) => (value + 1) % queue.length);
    }
    performSeek(0);
  };

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
      {isStudio && props.audioSrc ? <audio ref={audioRef} src={props.audioSrc} preload="auto" /> : null}
      <BackgroundLayer kind={props.background.kind} src={props.background.src} color={props.background.color} />
      <ReadabilityLayer />
      <WaveformEnergyCanvas
        currentTimeMs={currentTimeMs}
        energy={isStudio ? audioEnergy : fallbackEnergy}
        isPlaying={isStudio ? isPlaying : true}
      />
      <SafePoetryFrame nickname="@xcai43323" />

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

        <TopSongInfo label="NOW PLAYING" title={title} artist={currentTrack.artist} />

        <LyricCarousel
          lyrics={props.lyrics}
          fps={props.fps}
          currentTimeMs={effectiveLyricTimeMs}
          onSeek={isStudio ? performSeek : undefined}
        />

        <ProgressBar
          currentTimeMs={currentTimeMs}
          durationMs={durationMs}
          onSeek={isStudio ? performSeek : undefined}
        />

        <ControlBar
          isPlaying={isStudio ? isPlaying : true}
          liked={liked}
          repeatMode={repeatMode}
          canGoPrevious={queue.length > 0}
          canGoNext={queue.length > 0}
          onTogglePlay={() => void togglePlay()}
          onPrevious={goPrevious}
          onNext={goNext}
          onToggleLike={() => setLiked((value) => !value)}
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
        onCreatePlaylist={() => {
          const newName = `New Playlist ${customPlaylists.length + 1}`;
          setCustomPlaylists((value) => [...value, newName]);
        }}
        onSelectPlaylist={(playlistId) => {
          setSelectedPlaylistId(playlistId);
          setPlaylistDrawerOpen(false);
        }}
      />

      <QueuePanel
        open={queueOpen}
        queue={queue}
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
        playlists={playlists}
        selectedPlaylistId={selectedPlaylistId}
        onClose={() => setAddToPlaylistOpen(false)}
        onCreatePlaylist={() => {
          const newName = `New Playlist ${customPlaylists.length + 1}`;
          setCustomPlaylists((value) => [...value, newName]);
        }}
        onSelectPlaylist={(playlistId) => {
          setSelectedPlaylistId(playlistId);
          setAddToPlaylistOpen(false);
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
