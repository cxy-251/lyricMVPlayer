import React from "react";
import {Play, Volume2} from "lucide-react";

import {CoverImage} from "./CoverImage";
import {buildAlbumTransform, clampIndex} from "../utils/visuals";
import {formatDuration, lerp} from "../utils/timing";
import type {AlbumGalleryTrack} from "../types";

type GalleryEntryProps = {
  tracks: AlbumGalleryTrack[];
  activeIndex: number;
  accentTrack: AlbumGalleryTrack;
  currentGalleryIndex: number;
  playerPresence: number;
  onGalleryIndexChange?: (index: number) => void;
  onSelectTrack?: (trackId: string) => void;
  onOpenTrack?: (trackId: string) => void;
};

export const GalleryEntry: React.FC<GalleryEntryProps> = ({
  tracks,
  activeIndex,
  accentTrack,
  currentGalleryIndex,
  playerPresence,
  onGalleryIndexChange,
  onSelectTrack,
  onOpenTrack,
}) => {
  const dragRef = React.useRef({active: false, moved: false, startX: 0, startIndex: 0});
  const clickGuardRef = React.useRef(false);
  const interactive = Boolean(onGalleryIndexChange || onSelectTrack || onOpenTrack);

  const releaseClickGuard = React.useCallback(() => {
    clickGuardRef.current = true;
    window.setTimeout(() => {
      clickGuardRef.current = false;
    }, 0);
  }, []);

  const selectGalleryIndex = React.useCallback((nextIndex: number) => {
    if (!tracks.length) return;
    const next = clampIndex(nextIndex, tracks.length);
    onGalleryIndexChange?.(next);
    const rounded = clampIndex(Math.round(next), tracks.length);
    onSelectTrack?.(tracks[rounded].id);
  }, [onGalleryIndexChange, onSelectTrack, tracks]);

  const snapGalleryIndex = React.useCallback((nextIndex: number) => {
    if (!tracks.length) return;
    const rounded = clampIndex(Math.round(nextIndex), tracks.length);
    onGalleryIndexChange?.(rounded);
    onSelectTrack?.(tracks[rounded].id);
  }, [onGalleryIndexChange, onSelectTrack, tracks]);

  const openTrack = React.useCallback((track: AlbumGalleryTrack, index: number) => {
    if (!interactive) return;
    onGalleryIndexChange?.(index);
    onSelectTrack?.(track.id);
    onOpenTrack?.(track.id);
  }, [interactive, onGalleryIndexChange, onOpenTrack, onSelectTrack]);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!interactive || playerPresence > 0.2) return;
    dragRef.current = {active: true, moved: false, startX: event.clientX, startIndex: currentGalleryIndex};
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current.active || !interactive || playerPresence > 0.2) return;
    const delta = event.clientX - dragRef.current.startX;
    if (Math.abs(delta) > 6) dragRef.current.moved = true;
    selectGalleryIndex(dragRef.current.startIndex - delta / 184);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current.active || !interactive) return;
    const delta = event.clientX - dragRef.current.startX;
    const moved = dragRef.current.moved;
    const nextIndex = moved ? dragRef.current.startIndex - delta / 184 : currentGalleryIndex;
    dragRef.current.active = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    releaseClickGuard();
    if (moved) {
      snapGalleryIndex(nextIndex);
      return;
    }

    const albumButton = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(".album-gallery-album");
    const targetIndex = albumButton?.dataset.index ? Number(albumButton.dataset.index) : activeIndex;
    const clampedTargetIndex = clampIndex(Number.isFinite(targetIndex) ? targetIndex : activeIndex, tracks.length);
    const targetTrack = tracks[clampedTargetIndex];
    if (targetTrack) openTrack(targetTrack, clampedTargetIndex);
  };

  const handleWheel = (event: React.WheelEvent<HTMLElement>) => {
    if (!interactive || playerPresence > 0.2) return;
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    snapGalleryIndex(currentGalleryIndex + Math.sign(delta || 1) * 0.92);
  };

  const handleAlbumClick = (track: AlbumGalleryTrack, index: number) => {
    if (clickGuardRef.current) return;
    openTrack(track, index);
  };

  return (
    <>
      <section
        className="absolute inset-x-0 top-20 bottom-36 z-20 cursor-grab touch-pan-y select-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        style={{
          opacity: lerp(1, 0.08, playerPresence),
          pointerEvents: playerPresence > 0.3 ? "none" : "auto",
          transform: `translateY(${lerp(0, -104, playerPresence)}px) scale(${lerp(1, 0.9, playerPresence)})`,
        }}
      >
        <div className="album-gallery-perspective relative mx-auto h-full w-[min(1360px,calc(100%-48px))]">
          {tracks.map((track, index) => {
            const offset = index - currentGalleryIndex;
            const active = Math.abs(offset) < 0.5;
            const abs = Math.abs(offset);
            return (
              <button
                key={track.id}
                className={`album-gallery-album absolute left-1/2 top-1/2 w-[clamp(154px,17vw,286px)] border-0 bg-transparent p-0 text-left outline-none transition-[filter] duration-200 ${
                  active ? "brightness-105" : "brightness-90"
                }`}
                type="button"
                data-index={index}
                onClick={() => handleAlbumClick(track, index)}
                style={{
                  opacity: Math.max(0, 1 - abs * 0.18 - playerPresence * (active ? 0.08 : 0.32)),
                  pointerEvents: Math.abs(offset) > 4.4 ? "none" : "auto",
                  transform: `translate(-50%, -50%) ${buildAlbumTransform(offset, playerPresence)}`,
                  zIndex: 100 - Math.round(abs * 10),
                }}
              >
                <div className="album-gallery-album-case relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-900 shadow-[0_28px_70px_rgba(0,0,0,0.24)]">
                  <CoverImage track={track} className="h-full w-full object-cover" />
                  <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.42),transparent_32%,rgba(0,0,0,0.2)_100%)] opacity-70" />
                </div>
                <span
                  className={`mt-4 block min-w-0 text-center transition-opacity duration-200 ${
                    active ? "opacity-100" : "opacity-45"
                  }`}
                >
                  <strong className="block truncate text-base font-semibold text-neutral-950">{track.title}</strong>
                  <small className="mt-1 block truncate text-sm font-medium text-neutral-600">{track.artist}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <footer
        className="absolute inset-x-0 bottom-0 z-30 px-6 pb-6"
        style={{
          opacity: playerPresence < 0.6 ? 1 - playerPresence : 0,
          pointerEvents: playerPresence > 0.2 ? "none" : "auto",
          transform: `translateY(${lerp(0, 28, playerPresence)}px)`,
        }}
      >
        <div className="mx-auto flex w-[min(760px,100%)] flex-col items-center gap-4">
          <div className="flex items-center gap-2" aria-hidden="true">
            {tracks.map((track, index) => (
              <span
                key={track.id}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  index === activeIndex ? "w-8 bg-neutral-950" : "w-2 bg-neutral-400/70"
                }`}
              />
            ))}
          </div>
          <button
            className="grid w-full grid-cols-[56px_minmax(0,1fr)_40px_28px] items-center gap-4 rounded-lg border border-black/10 bg-white/75 p-3 text-left shadow-[0_20px_70px_rgba(30,24,18,0.18)] backdrop-blur-xl transition-transform duration-200 hover:scale-[1.01]"
            type="button"
            onClick={() => openTrack(accentTrack, activeIndex)}
          >
            <CoverImage track={accentTrack} className="aspect-square h-14 w-14 rounded-md object-cover shadow-md" />
            <span className="min-w-0">
              <strong className="block truncate text-base font-semibold text-neutral-950">{accentTrack.title}</strong>
              <small className="mt-1 block truncate text-sm font-medium text-neutral-500">
                {accentTrack.artist} · {formatDuration(accentTrack.durationInFrames, accentTrack.fps)}
              </small>
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-neutral-950 text-white">
              <Play size={16} fill="currentColor" strokeWidth={0} />
            </span>
            <Volume2 size={19} strokeWidth={2} className="text-neutral-500" />
          </button>
        </div>
      </footer>
    </>
  );
};
