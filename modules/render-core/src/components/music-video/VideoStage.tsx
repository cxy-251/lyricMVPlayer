import React, {useEffect, useState} from "react";
import {getRemotionEnvironment, useCurrentFrame} from "remotion";
import {ListMusic, Menu} from "lucide-react";

import type {LyricVideoCompositionProps} from "../../types";
import {formatDisplayTitle} from "../../domain/songs";
import {useAudioAnalyser} from "../../hooks/useAudioAnalyser";
import {usePlaybackController} from "../../hooks/usePlaybackController";
import {useReactiveSignals} from "../../hooks/useReactiveSignals";
import {useSongLibrary} from "../../hooks/useSongLibrary";
import {cn} from "../../lib/cn";
import {AddToPlaylistPanel} from "./library/AddToPlaylistPanel";
import {PlaylistDrawer} from "./library/PlaylistDrawer";
import {QueuePanel} from "./library/QueuePanel";
import {ControlBar} from "./player/ControlBar";
import {LyricCarousel} from "./player/LyricCarousel";
import {ProgressBar} from "./player/ProgressBar";
import {TopSongInfo} from "./player/TopSongInfo";
import {VisualEffectsStack} from "./visuals/VisualEffectsStack";

export const VideoStage: React.FC<LyricVideoCompositionProps> = (props) => {
  const frame = useCurrentFrame();
  const env = getRemotionEnvironment();
  const isInteractiveAudio = env.isStudio || props.interactivePreview === true;
  const [playlistDrawerOpen, setPlaylistDrawerOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);

  const {
    currentSong,
    currentTrack,
    filteredQueue,
    isCurrentLiked,
    library,
    playlists,
    queue,
    selectedPlaylistId,
    setCurrentTrackIndex,
    setSelectedPlaylistId,
    toggleCurrentLike,
    toggleCurrentSongInPlaylist,
    trackPlaylistIds,
  } = useSongLibrary({props, isInteractiveAudio});

  const playback = usePlaybackController({
    currentSong,
    filteredQueue,
    frame,
    isInteractiveAudio,
    library,
    setCurrentTrackIndex,
  });

  const {audioEnergy, resumeAudioContext} = useAudioAnalyser({
    audioRef: playback.audioRef,
    isInteractiveAudio,
    isPlaying: playback.isPlaying,
  });

  const effectiveLyricTimeMs = playback.currentTimeMs + (currentSong.lyricOffsetMs ?? 0);
  const {
    fallbackEnergy,
    lineProgress,
    reactiveBass,
    reactiveBeat,
    reactiveEnergy,
    reactiveHigh,
    reactiveMid,
    reactiveOnset,
    sampledFeature,
    waveformEnergy,
  } = useReactiveSignals({
    audioEnergy,
    currentSong,
    currentTimeMs: playback.currentTimeMs,
    effectiveLyricTimeMs,
    isInteractiveAudio,
  });

  useEffect(() => {
    if (!isInteractiveAudio || filteredQueue.length === 0) {
      return;
    }
    if (!filteredQueue.some((track) => track.id === currentSong.id)) {
      const nextTrack = filteredQueue[0];
      const nextLibraryIndex = library.findIndex((item) => item.id === nextTrack.id);
      if (nextLibraryIndex >= 0) {
        setCurrentTrackIndex(nextLibraryIndex);
        playback.performSeek(0);
      }
    }
  }, [currentSong.id, filteredQueue, isInteractiveAudio, library, playback, setCurrentTrackIndex]);

  const currentFrame = isInteractiveAudio ? playback.liveFrame : frame;
  const title = formatDisplayTitle(currentSong.title, currentSong.artist);

  const handleTogglePlay = async () => {
    await resumeAudioContext();
    await playback.togglePlay();
  };

  return (
    <div
      className="relative h-[1920px] w-[1080px] overflow-hidden bg-black font-serif"
      style={{
        position: "relative",
        width: 1080,
        height: 1920,
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      {isInteractiveAudio && currentSong.audioSrc ? (
        <audio ref={playback.audioRef} src={currentSong.audioSrc} preload="auto" />
      ) : null}

      <VisualEffectsStack
        currentFrame={currentFrame}
        currentSong={currentSong}
        currentTimeMs={playback.currentTimeMs}
        fallbackEnergy={fallbackEnergy}
        isPlaying={isInteractiveAudio ? playback.isPlaying : true}
        lineProgress={lineProgress}
        reactiveBass={reactiveBass}
        reactiveBeat={reactiveBeat}
        reactiveEnergy={reactiveEnergy}
        reactiveHigh={reactiveHigh}
        reactiveMid={reactiveMid}
        reactiveOnset={reactiveOnset}
        sampledFeature={sampledFeature}
        waveformEnergy={waveformEnergy}
      />

      <div
        className="absolute inset-0 z-40"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 40,
          pointerEvents: "auto",
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
          onSeek={isInteractiveAudio ? playback.performSeek : undefined}
        />

        <ProgressBar
          currentTimeMs={playback.currentTimeMs}
          durationMs={playback.durationMs}
          onSeek={isInteractiveAudio ? playback.performSeek : undefined}
        />

        <ControlBar
          isPlaying={isInteractiveAudio ? playback.isPlaying : true}
          liked={isCurrentLiked}
          repeatMode={playback.repeatMode}
          canGoPrevious={filteredQueue.length > 1}
          canGoNext={filteredQueue.length > 1}
          onTogglePlay={() => void handleTogglePlay()}
          onPrevious={playback.goPrevious}
          onNext={playback.goNext}
          onToggleLike={toggleCurrentLike}
          onToggleRepeatOne={() => playback.setRepeatMode((value) => (value === "one" ? "none" : "one"))}
          onToggleRepeatList={() => playback.setRepeatMode((value) => (value === "list" ? "none" : "list"))}
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
            playback.performSeek(0);
            setQueueOpen(false);
          }
        }}
      />

      <AddToPlaylistPanel
        open={addToPlaylistOpen}
        playlists={playlists.filter((playlist) => playlist.id !== "all")}
        trackPlaylistIds={trackPlaylistIds}
        onClose={() => setAddToPlaylistOpen(false)}
        onSelectPlaylist={toggleCurrentSongInPlaylist}
      />

      <div
        className={cn(
          "pointer-events-none absolute inset-0 transition-colors duration-300",
          playback.crossfadeOpacity > 0 ? "bg-black/20" : "bg-transparent"
        )}
      />
    </div>
  );
};
