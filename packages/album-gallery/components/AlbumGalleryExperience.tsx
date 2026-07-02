import React from "react";
import {ChevronLeft, ListMusic, Menu, Search} from "lucide-react";

import {CoverImage} from "./CoverImage";
import {GalleryEntry} from "./GalleryEntry";
import {VinylPlayer} from "./VinylPlayer";
import {clampIndex, playerThemes} from "../utils/visuals";
import {
  buildAlbumGalleryTimeline,
  clamp,
  easeInOutCubic,
  easeOutExpo,
  lerp,
  normalizeTrackIndex,
} from "../utils/timing";
import type {AlbumGalleryTrack} from "../types";
import "../styles/effects.css";

type AlbumGalleryExperienceProps = {
  tracks: AlbumGalleryTrack[];
  selectedTrackId: string;
  frame: number;
  fps?: number;
  showPreviewChrome?: boolean;
  galleryIndex?: number;
  playerOpen?: boolean;
  onGalleryIndexChange?: (index: number) => void;
  onSelectTrack?: (trackId: string) => void;
  onOpenTrack?: (trackId: string) => void;
  onBackToGallery?: () => void;
};

export const AlbumGalleryExperience: React.FC<AlbumGalleryExperienceProps> = ({
  tracks,
  selectedTrackId,
  frame,
  fps,
  showPreviewChrome = false,
  galleryIndex,
  playerOpen,
  onGalleryIndexChange,
  onSelectTrack,
  onOpenTrack,
  onBackToGallery,
}) => {
  const safeTracks = tracks.length > 0 ? tracks : [];
  const selectedIndex = normalizeTrackIndex(safeTracks, selectedTrackId);
  const selectedTrack = safeTracks[selectedIndex];
  const resolvedFps = fps ?? selectedTrack?.fps ?? 30;
  const timeline = selectedTrack
    ? buildAlbumGalleryTimeline(selectedTrack, resolvedFps)
    : buildAlbumGalleryTimeline({
        id: "empty",
        title: "No Track",
        artist: "Unknown Artist",
        audioSrc: "",
        durationInFrames: resolvedFps * 30,
        fps: resolvedFps,
        themeColor: "#83b7ff",
      });
  const interactive = typeof galleryIndex === "number";
  const slideProgress = easeInOutCubic((frame - timeline.galleryIntroFrames) / timeline.slideToTrackFrames);
  const enterProgress = easeOutExpo((frame - timeline.audioStartFrame + timeline.enterPlayerFrames) / timeline.enterPlayerFrames);
  const returnProgress = easeInOutCubic((frame - timeline.returnStartFrame) / timeline.returnGalleryFrames);
  const autoPlayerPresence = clamp(enterProgress * (1 - returnProgress));
  const playerPresence = interactive ? (playerOpen ? 1 : 0) : autoPlayerPresence;
  const initialGalleryIndex = clampIndex(Math.min(3, safeTracks.length - 1), safeTracks.length);
  const currentGalleryIndex = interactive ? clampIndex(galleryIndex, safeTracks.length) : lerp(initialGalleryIndex, selectedIndex, slideProgress);
  const activeIndex = clampIndex(Math.round(currentGalleryIndex), safeTracks.length);
  const accentTrack = playerPresence > 0.5 ? selectedTrack : (safeTracks[activeIndex] ?? selectedTrack);
  const playFrame = interactive
    ? (playerOpen ? frame : 0)
    : clamp((frame - timeline.audioStartFrame) / timeline.audioFrames) * timeline.audioFrames;
  const playProgress = interactive
    ? clamp(frame / timeline.audioFrames)
    : clamp((frame - timeline.audioStartFrame) / timeline.audioFrames);
  const playerThemeIndex = playerPresence > 0.5 ? Math.floor(playFrame / Math.max(1, resolvedFps * 8)) % playerThemes.length : 0;
  const playerTheme = playerThemes[playerThemeIndex];

  if (!selectedTrack || !accentTrack) {
    return (
      <div className="album-gallery-root flex h-screen min-h-[720px] w-full items-center justify-center bg-neutral-950 p-8 text-center text-sm font-semibold text-white">
        No album tracks loaded.
      </div>
    );
  }

  const topbarTop = showPreviewChrome ? "top-5" : "top-7";
  const playerChrome = playerPresence > 0.5;
  const topbarTextClass = playerChrome && playerTheme.ink === "light" ? "text-white" : "text-neutral-950";

  return (
    <div
      className="album-gallery-root relative isolate h-screen min-h-[720px] w-full overflow-hidden bg-[#f5f2ea] font-sans text-neutral-950"
      style={{
        "--album-accent": accentTrack.themeColor,
        "--player-bg": playerTheme.background,
        "--player-disc": playerTheme.disc,
        "--player-disc-core": playerTheme.discCore,
      } as React.CSSProperties}
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.96),rgba(238,232,219,0.82)_43%,rgba(218,211,198,1)_100%)]"
        style={{opacity: 1 - playerPresence}}
      />
      <div className="absolute inset-0" style={{background: "var(--player-bg)", opacity: playerPresence}} />
      <div className="absolute inset-0 opacity-20 blur-3xl" style={{opacity: lerp(0.1, 0.24, playerPresence)}}>
        <CoverImage track={accentTrack} className="h-full w-full scale-110 object-cover" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.32),rgba(255,255,255,0)_42%,rgba(0,0,0,0.08))]" />

      <header className={`absolute inset-x-0 ${topbarTop} z-40 mx-auto flex w-[min(1440px,calc(100%-48px))] items-center justify-between`}>
        {playerChrome ? (
          <button
            className={`grid h-11 w-11 place-items-center rounded-lg border shadow-sm backdrop-blur-xl ${
              playerTheme.ink === "light"
                ? "border-white/10 bg-white/10 text-white"
                : "border-black/10 bg-white/70 text-neutral-950"
            }`}
            type="button"
            aria-label="Back to gallery"
            onClick={onBackToGallery}
          >
            <ChevronLeft size={21} strokeWidth={2.1} />
          </button>
        ) : (
          <div className="h-11 w-11" />
        )}
        <div className={`min-w-0 text-center ${topbarTextClass}`}>
          <strong className="block truncate text-base font-semibold">{playerChrome ? "Now Playing" : "Album Gallery"}</strong>
          <span className={`mt-1 block truncate text-xs font-medium ${playerChrome && playerTheme.ink === "light" ? "text-white/60" : "text-neutral-500"}`}>
            {playerChrome ? selectedTrack.artist : `${safeTracks.length} albums`}
          </span>
        </div>
        <button
          className={`grid h-11 w-11 place-items-center rounded-lg border shadow-sm backdrop-blur-xl ${
            playerChrome && playerTheme.ink === "light"
              ? "border-white/10 bg-white/10 text-white"
              : "border-black/10 bg-white/70 text-neutral-950"
          }`}
          type="button"
          aria-label={playerChrome ? "Queue" : "Search"}
        >
          {playerChrome ? <ListMusic size={20} strokeWidth={2.1} /> : <Search size={20} strokeWidth={2.1} />}
        </button>
      </header>

      <GalleryEntry
        tracks={safeTracks}
        activeIndex={activeIndex}
        accentTrack={accentTrack}
        currentGalleryIndex={currentGalleryIndex}
        playerPresence={playerPresence}
        onGalleryIndexChange={onGalleryIndexChange}
        onSelectTrack={onSelectTrack}
        onOpenTrack={onOpenTrack}
      />

      <VinylPlayer
        track={selectedTrack}
        timeline={timeline}
        fps={resolvedFps}
        playFrame={playFrame}
        playProgress={playProgress}
        playerPresence={playerPresence}
        returnProgress={returnProgress}
        theme={playerTheme}
        themeIndex={playerThemeIndex}
        themes={playerThemes}
        interactive={interactive}
        onBackToGallery={onBackToGallery}
      />
    </div>
  );
};
