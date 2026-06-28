import {useEffect, useRef, useState, type Dispatch, type SetStateAction} from "react";

import type {RepeatMode} from "../domain/playlists";
import {clamp} from "../lib/math";
import type {QueueTrack, SongLibraryItem} from "../types";

type UsePlaybackControllerOptions = {
  currentSong: SongLibraryItem;
  filteredQueue: QueueTrack[];
  frame: number;
  isInteractiveAudio: boolean;
  library: SongLibraryItem[];
  setCurrentTrackIndex: Dispatch<SetStateAction<number>>;
};

export const usePlaybackController = ({
  currentSong,
  filteredQueue,
  frame,
  isInteractiveAudio,
  library,
  setCurrentTrackIndex,
}: UsePlaybackControllerOptions) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transitionGuardRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("list");
  const [previewTimeMs, setPreviewTimeMs] = useState(0);
  const [loadedAudioDurationMs, setLoadedAudioDurationMs] = useState(0);
  const [crossfadeOpacity, setCrossfadeOpacity] = useState(0);

  const renderTrimStartMs = currentSong.renderTrimStartMs ?? 0;
  const liveFrame = Math.floor((previewTimeMs / 1000) * currentSong.fps);
  const currentTimeMs = isInteractiveAudio ? previewTimeMs : (frame / currentSong.fps) * 1000 + renderTrimStartMs;
  const lyricsEndMs = currentSong.lyrics[currentSong.lyrics.length - 1]?.endMs ?? 0;
  const fallbackDurationMs = Math.max((currentSong.durationInFrames / currentSong.fps) * 1000, lyricsEndMs);
  const durationMs = Math.max(loadedAudioDurationMs || 0, fallbackDurationMs);

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
  }, [currentSong.id, filteredQueue, isInteractiveAudio, isPlaying, library, repeatMode, setCurrentTrackIndex]);

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
    // We intentionally omit isPlaying from the dependency array because
    // we only want this effect to trigger when the song itself changes
    // or when the song's audio asset finishes loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong.id, currentSong.audioSrc, isInteractiveAudio]);

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

  return {
    audioRef,
    crossfadeOpacity,
    currentTimeMs,
    durationMs,
    goNext,
    goPrevious,
    isPlaying,
    liveFrame,
    performSeek,
    previewTimeMs,
    repeatMode,
    setIsPlaying,
    setRepeatMode,
    togglePlay,
  };
};
