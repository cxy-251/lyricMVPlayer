import React from "react";
import {Link} from "react-router";

import {AlbumGalleryExperience} from "./AlbumGalleryExperience";
import {loadAlbumTracksFromPublicManifest} from "./data";
import {buildAlbumGalleryTimeline, clamp, normalizeTrackIndex} from "./timing";
import type {AlbumGalleryTrack} from "./types";

export const AlbumGalleryStudioPage: React.FC = () => {
  const [tracks, setTracks] = React.useState<AlbumGalleryTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = React.useState("");
  const [galleryIndex, setGalleryIndex] = React.useState(0);
  const [playerOpen, setPlayerOpen] = React.useState(false);
  const [frame, setFrame] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const frameRef = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await loadAlbumTracksFromPublicManifest();
        if (cancelled) return;
        const initialIndex = normalizeTrackIndex(result.tracks, result.currentSongDirName);
        setTracks(result.tracks);
        setGalleryIndex(initialIndex);
        setSelectedTrackId(result.tracks[initialIndex]?.id || result.tracks[0]?.id || "");
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!tracks.length || !selectedTrackId) return undefined;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const selected = tracks[normalizeTrackIndex(tracks, selectedTrackId)] ?? tracks[0];
      const timeline = buildAlbumGalleryTimeline(selected, 30);
      const deltaFrames = ((now - last) / 1000) * 30;
      last = now;
      if (playerOpen) {
        frameRef.current = Math.min(frameRef.current + deltaFrames, timeline.audioFrames);
      }
      setFrame(Math.floor(frameRef.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playerOpen, selectedTrackId, tracks]);

  const updateGalleryIndex = React.useCallback((nextIndex: number) => {
    if (!tracks.length) return;
    const next = clamp(nextIndex, 0, tracks.length - 1);
    const rounded = Math.round(next);
    setGalleryIndex(next);
    setSelectedTrackId(tracks[rounded]?.id || tracks[0].id);
    setPlayerOpen(false);
    frameRef.current = 0;
    setFrame(0);
  }, [tracks]);

  const openTrack = React.useCallback((trackId: string) => {
    const index = normalizeTrackIndex(tracks, trackId);
    setGalleryIndex(index);
    setSelectedTrackId(trackId);
    setPlayerOpen(true);
    frameRef.current = 0;
    setFrame(0);
  }, [tracks]);

  const backToGallery = React.useCallback(() => {
    setPlayerOpen(false);
    frameRef.current = 0;
    setFrame(0);
  }, []);

  if (error) {
    return (
      <main className="relative min-h-screen bg-neutral-950 text-white">
        <Link className="absolute left-5 top-5 z-50 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-white/75 backdrop-blur-xl hover:text-white" to="/studio">Studio</Link>
        <div className="flex min-h-screen items-center justify-center p-8 text-center text-sm font-semibold text-white/75">
          Failed to load album gallery: {error}
        </div>
      </main>
    );
  }

  if (!tracks.length || !selectedTrackId) {
    return (
      <main className="relative min-h-screen bg-neutral-950 text-white">
        <Link className="absolute left-5 top-5 z-50 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-white/75 backdrop-blur-xl hover:text-white" to="/studio">Studio</Link>
        <div className="flex min-h-screen items-center justify-center p-8 text-center text-sm font-semibold text-white/75">
          Loading album gallery...
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950">
      <Link className="absolute left-5 top-5 z-50 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm backdrop-blur-xl hover:text-neutral-950" to="/studio">Studio</Link>
      <AlbumGalleryExperience
        tracks={tracks}
        selectedTrackId={selectedTrackId}
        frame={frame}
        fps={30}
        galleryIndex={galleryIndex}
        playerOpen={playerOpen}
        showPreviewChrome
        onGalleryIndexChange={updateGalleryIndex}
        onSelectTrack={setSelectedTrackId}
        onOpenTrack={openTrack}
        onBackToGallery={backToGallery}
      />
    </main>
  );
};
